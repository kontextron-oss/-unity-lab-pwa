'use strict';
/* UNITY 0.15.2 – transaction-safe local paper-order execution.
 * 1. Confirm a strategy signal using an already published EOD snapshot.
 * 2. Store a trigger in the user's local IndexedDB, without a transaction.
 * 3. Only when a strictly LATER EOD snapshot is observed, simulate a fill
 *    with explicit spread/slippage and fee. The fill is a modelling estimate,
 *    NEVER an observed executable trade or next-session opening quote.
 * 4. Complete order, trade and audit in ONE IndexedDB transaction.
 * All records stay local. No broker or asynchronous iOS background trader. */
const UNITY_PAPER_POLICY_KEY='unity-paper-fill-assumptions-v1';
const UNITY_PAPER_DEFAULTS={spreadBps:10,slippageBps:15,feeEur:1};
function unityPaperCents(value){return Math.round(Number(value)*100)}
function unityPaperPolicy(){
  const stored=(typeof cache!=='undefined'?cache.settings||[]:[]).find(x=>x.id===UNITY_PAPER_POLICY_KEY);
  const v=stored||UNITY_PAPER_DEFAULTS;
  const safe=(n,min,max,defaultValue)=>Number.isFinite(Number(n))&&Number(n)>=min&&Number(n)<=max?
    Number(n):defaultValue;
  return {spreadBps:safe(v.spreadBps,0,200,10),slippageBps:safe(v.slippageBps,0,200,15),
    feeEur:safe(v.feeEur,0,100,1)};
}
function unityPaperPolicyValidate(input){
  const spreadBps=Number(input?.spreadBps),slippageBps=Number(input?.slippageBps),feeEur=Number(input?.feeEur);
  if(!Number.isFinite(spreadBps)||spreadBps<0||spreadBps>200||
     !Number.isFinite(slippageBps)||slippageBps<0||slippageBps>200||
     !Number.isFinite(feeEur)||feeEur<0||feeEur>100||Math.round(feeEur*100)!==feeEur*100)
    throw Error('Spread und Slippage müssen zwischen 0 und 200 Basispunkten liegen, Gebühr zwischen 0 und 100 €.');
  return {spreadBps,slippageBps,feeEur};
}
async function unityPaperSavePolicy(input){
  const settings=unityPaperPolicyValidate(input);
  if(typeof put!=='function')throw Error('Lokale Datenspeicherung nicht verfügbar.');
  await put('settings',{id:UNITY_PAPER_POLICY_KEY,kind:'paper-fill-assumptions',
    ...settings,updatedAt:new Date().toISOString()});
  if(typeof audit==='function')await audit('PAPER_FILL_ASSUMPTIONS',UNITY_PAPER_POLICY_KEY,
    'Spread '+settings.spreadBps+' bps, Slippage '+settings.slippageBps+
    ' bps, fiktive Gebühr '+settings.feeEur.toFixed(2)+' €');
  if(typeof refresh==='function')await refresh();
  return settings;
}
function unityPaperFillModel(close,side,fx,policy,budgetEur=NaN,positionQty=NaN){
  const px=Number(close),rate=Number(fx);
  if(!(Number.isFinite(px)&&px>0&&Number.isFinite(rate)&&rate>0))return null;
  const assumption=unityPaperPolicyValidate(policy);
  const bps=assumption.spreadBps/2+assumption.slippageBps;
  const executionPrice=px*(1+(side==='BUY'?1:-1)*bps/10000);
  if(!(executionPrice>0))return null;
  const fee=assumption.feeEur;
  let quantity;
  if(side==='BUY'){
    const budgetCents=unityPaperCents(budgetEur),feeCents=unityPaperCents(fee);
    if(!(budgetCents>feeCents&&budgetCents>=100))return null;
    quantity=(budgetCents-feeCents)/100/(executionPrice*rate);
  }else if(side==='SELL'){
    quantity=Number(positionQty);
    if(!(Number.isFinite(quantity)&&quantity>0&&quantity*executionPrice*rate>fee))return null;
  }else return null;
  const amount=quantity*executionPrice;
  return {quantity,price:executionPrice,amount,fee,fx:rate,
    totalEur:side==='BUY'?amount*rate+fee:amount*rate-fee,
    referenceClose:px,spreadBps:assumption.spreadBps,slippageBps:assumption.slippageBps,
    priceSource:'UNITY Simulation · nächster beobachteter Schlusskurs mit Modell-Spread/Slippage'};
}
function unityPaperFillId(order){
  return 'unity-auto-fill-v1:'+encodeURIComponent(String(order?.id||''))+':'+
    encodeURIComponent(String(order?.createdAt||''));
}
function unityPaperQuoteValid(s,quote,fx){
  const x=quote?.x,rate=Number(fx?.rate);
  return !!x&&quote?.valid===true&&quote?.technical===true&&quote?.quality?.canCompare===true&&
    !x.dynamicExperimental&&x.currency===s.currency&&!!String(x.exchange||'')&&
    /^\d{4}-\d{2}-\d{2}$/.test(String(x.date||''))&&Number.isFinite(Number(x.price))&&Number(x.price)>0&&
    Number.isFinite(rate)&&rate>0&&
    (s.currency==='EUR'||!!String(fx?.date||''));
}
function unityPaperCashFromRows(settings,transactions){
  const cfg=settings.find(x=>x.id==='portfolio-capital');
  const opening=cfg?.amount===undefined?0:Number(cfg.amount);
  let cash=Number.isFinite(opening)&&opening>=0?opening:0;
  for(const t of transactions){
    if(t.voidedAt)continue;
    const fx=Number(t.fx),fee=Number(t.fee)||0,amount=Number(t.amount)||0;
    if(t.type==='DEPOSIT')cash+=amount;
    else if(t.type==='WITHDRAW')cash-=amount;
    else if(t.type==='BUY'&&fx>0)cash-=amount*fx+fee;
    else if(t.type==='SELL'&&fx>0)cash+=amount*fx-fee;
  }
  return cash;
}
function unityPaperQtyFromRows(rows,stockId){
  return rows.filter(t=>!t.voidedAt&&t.instrumentId===stockId&&(t.type==='BUY'||t.type==='SELL'))
    .reduce((q,t)=>q+(t.type==='BUY'?1:-1)*Number(t.quantity||0),0);
}
function unityPaperSpendFromRows(rows){
  return rows.filter(t=>!t.voidedAt&&t.type==='BUY'&&t.source==='UNITY Lab · Auto-Testkauf')
    .reduce((v,t)=>v+(Number(t.amount)||0)*(Number(t.fx)||0)+(Number(t.fee)||0),0);
}
// Transaction-safe trigger; only the currently active unique order may change.
async function unityPaperArmOrder(order,trigger){
  if(typeof db==='undefined'||!db||!order?.id||!order?.createdAt||!trigger?.quoteDate)
    return {status:'blocked',reason:'Auftrag/Datenbank fehlen'};
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(['settings','audit'],'readwrite'),os=tx.objectStore('settings'),
      logs=tx.objectStore('audit');
    let result={status:'unchanged'};
    os.get(order.id).onsuccess=e=>{
      const current=e.target.result;
      if(!current||!current.active||current.executedAt||current.createdAt!==order.createdAt)return;
      if(current.triggerQuoteDate){result={status:'already-triggered'};return;}
      const at=new Date().toISOString(),next={...current,triggerQuoteDate:String(trigger.quoteDate),
        triggeredAt:at,triggerLimit:Number(trigger.limit)||null,
        triggerRefPrice:Number(trigger.price)||null,triggerMode:current.mode||'strict',
        state:'triggered'};
      os.put(next);
      logs.put({id:'paper-signal:'+unityPaperFillId(order),at,type:'PAPER_ORDER_TRIGGER',
        ref:order.id,detail:'Signal '+trigger.quoteDate+' · nächster beobachteter Tageskurs wird als Modell-Fill verwendet'});
      result={status:'triggered',order:next};
    };
    tx.oncomplete=()=>resolve(result);
    tx.onerror=()=>reject(tx.error||Error('Trigger-Speicherung fehlgeschlagen'));
    tx.onabort=()=>reject(tx.error||Error('Trigger-Speicherung abgebrochen'));
  });
}
async function unityPaperClearTrigger(order,reason){
  if(typeof db==='undefined'||!db||!order?.id)return false;
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(['settings','audit'],'readwrite'),os=tx.objectStore('settings');
    let cleared=false;
    os.get(order.id).onsuccess=e=>{
      const current=e.target.result;
      if(!current?.active||!current.triggerQuoteDate||current.createdAt!==order.createdAt)return;
      const {triggerQuoteDate,triggeredAt,triggerLimit,triggerRefPrice,triggerMode,...base}=current;
      const next={...base,state:'waiting',lastBlockedReason:String(reason||'Limit verändert'),
        lastBlockedAt:new Date().toISOString()};
      os.put(next);tx.objectStore('audit').put({id:'paper-trigger-clear:'+unityPaperFillId(order)+':'+
        Date.now(),at:next.lastBlockedAt,type:'PAPER_ORDER_TRIGGER_EXPIRED',ref:order.id,
        detail:next.lastBlockedReason});cleared=true;
    };
    tx.oncomplete=()=>resolve(cleared);
    tx.onerror=()=>reject(tx.error||Error('Trigger-Reset fehlgeschlagen'));
    tx.onabort=()=>reject(tx.error||Error('Trigger-Reset abgebrochen'));
  });
}
/* Read and validate ALL wallet transactions under the SAME write lock which
   commits the order state, exact-once trade ID and audit event. Concurrent tabs
   serialize in IndexedDB; an abort leaves none of the three records committed. */
async function unityPaperAtomicFill(order,s,side,quote,fx,approval){
  if(typeof db==='undefined'||!db)return {status:'blocked',reason:'Keine lokale Datenbank'};
  if(!order?.triggerQuoteDate||!order.createdAt||!unityPaperQuoteValid(s,quote,fx))
    return {status:'blocked',reason:'Kurs, Wechselkurs oder Auslöser nicht überprüfbar'};
  const quoteDate=quote.x.date;
  if(!(quoteDate>order.triggerQuoteDate))
    return {status:'waiting',reason:'Nächster Tageskurs nach dem Signal noch nicht vorhanden'};
  const policy=unityPaperPolicy(),fillId=unityPaperFillId(order),now=new Date().toISOString();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(['settings','transactions','audit'],'readwrite'),
      settings=tx.objectStore('settings'),trades=tx.objectStore('transactions'),
      logs=tx.objectStore('audit');
    let result={status:'blocked',reason:'Auftrags- oder Kapitalprüfung nicht bestanden'};
    const settingsReq=settings.getAll(),txReq=trades.getAll();
    let settingsRows=null,tradeRows=null;
    const process=()=>{
      if(!settingsRows||!tradeRows)return;
      const current=settingsRows.find(x=>x.id===order.id);
      if(!current||current.active!==true||current.executedAt||
         current.createdAt!==order.createdAt||current.triggerQuoteDate!==order.triggerQuoteDate){
        result={status:'already-settled',reason:'Auftrag nicht mehr unverändert aktiv'};return;
      }
      if(tradeRows.some(t=>t.id===fillId)){
        // Recover inconsistent legacy states without creating another trade.
        const prior=tradeRows.find(t=>t.id===fillId);
        settings.put({...current,active:false,state:'filled',executedAt:prior.executedAt,
          executionTradeId:fillId});
        result={status:'already-settled',reason:'Bereits verbucht'};return;
      }
      const rate=Number(fx.rate),close=Number(quote.x.price),modelQty=side==='SELL'?
        unityPaperQtyFromRows(tradeRows,s.id):NaN;
      const budget=Number(current.allocationEur),model=unityPaperFillModel(close,side,rate,policy,
        budget,modelQty);
      if(!model){
        result={status:'blocked',reason:'Fester Betrag/Bestand reicht nicht für modellierte Gebühr'};return;
      }
      if(side==='BUY'){
        const limit=Number(current.triggerLimit);
        if(limit>0&&model.price>limit){
          result={status:'limit-exceeded',reason:'Nächster Modellkurs liegt über der ursprünglichen Kaufgrenze'};return;
        }
        const cash=unityPaperCashFromRows(settingsRows,tradeRows);
        const budgetSetting=settingsRows.find(x=>x.id==='auto-test-buy-total-budget');
        const ceiling=Number(budgetSetting?.limitEur),spent=unityPaperSpendFromRows(tradeRows);
        if(!(Number.isFinite(ceiling)&&ceiling>0)){
          result={status:'blocked',reason:'Gesamtbudget nicht definiert'};return;
        }
        const required=unityPaperCents(model.totalEur),
          remaining=Math.floor((ceiling-spent)*100+1e-7),wallet=Math.floor(cash*100+1e-7);
        if(required>remaining||required>wallet){
          result={status:'blocked',reason:'Budgetrest oder freies Testkapital reicht nicht aus'};return;
        }
      }
      const d=approval||{};
      const reason=side==='BUY'?'Automatischer Testkauf nach bestätigtem Einstiegssignal':
        'Automatischer Testverkauf nach bestätigtem Ausstiegssignal';
      const trade={id:fillId,instrumentId:s.id,type:side,quantity:model.quantity,
        amount:model.amount,price:model.price,fx:model.fx,fee:model.fee,decidedAt:current.triggeredAt,
        executedAt:now,createdAt:now,
        source:side==='BUY'?'UNITY Lab · Auto-Testkauf':'UNITY Lab · Auto-Testverkauf',
        note:reason+' · modellierter Folgetagesschlusskurs',
        priceSource:model.priceSource,fxSource:String(fx.source||'EUR Referenz'),
        decisionSnapshot:{action:reason,quoteDate,quotePrice:close,referenceClose:close,
          triggerQuoteDate:current.triggerQuoteDate,orderId:current.id,orderCreatedAt:current.createdAt,
          simulatedModel:true,spreadBps:model.spreadBps,slippageBps:model.slippageBps,
          modeledFeeEur:model.fee,modeledTotalEur:model.totalEur,
          unityDecision:{version:d.version||'',action:side,mode:current.mode||'strict',
            reasonCode:d.reasonCode||'',signalAt:d.signalAt||current.triggerQuoteDate,
            priceRef:d.priceRef||null,veto:d.veto||[],sourceRefs:d.sourceRefs||[]}}};
      trades.put(trade);
      settings.put({...current,active:false,state:'filled',executedAt:now,
        executionTradeId:fillId,executionQuoteDate:quoteDate,
        executionModel:{referenceClose:close,price:model.price,spreadBps:model.spreadBps,
          slippageBps:model.slippageBps,feeEur:model.fee}});
      logs.put({id:'paper-fill-audit:'+fillId,at:now,
        type:side==='BUY'?'AUTO_TEST_BUY':'AUTO_TEST_SELL',ref:fillId,
        detail:s.ticker+' · '+model.quantity+' Stück · '+model.totalEur.toFixed(2)+
          ' EUR (modellierter Schlusskurs '+quoteDate+')'});
      result={status:'filled',trade};
    };
    settingsReq.onsuccess=e=>{settingsRows=e.target.result;process()};
    txReq.onsuccess=e=>{tradeRows=e.target.result;process()};
    tx.oncomplete=()=>resolve(result);
    tx.onerror=()=>reject(tx.error||Error('Atomare Testbuchung fehlgeschlagen'));
    tx.onabort=()=>reject(tx.error||Error('Atomare Testbuchung abgebrochen'));
  });
}
function unityPaperCostsPanel(){
  const p=unityPaperPolicy();
  return '<details class="home-paper-costs"><summary>Modellkosten und Ausführungsannahmen</summary>'+
    '<p class="tiny muted">Ein Signal am Börsentag D wird NICHT zum bereits bekannten Schlusskurs von D gebucht. Erst der nächste später beobachtete Tages-Schlusskurs dient als Schätzwert. Auf- und Abschläge sowie Gebühren sind ausdrücklich Simulationen, keine handelbaren Kurse.</p>'+
    '<div class="home-paper-cost-inputs">'+
    '<label>Gesamt-Spread (Basispunkte)<input id="paper-spread-bps" type="number" min="0" max="200" step="1" value="'+p.spreadBps+'"></label>'+
    '<label>Slippage (Basispunkte)<input id="paper-slippage-bps" type="number" min="0" max="200" step="1" value="'+p.slippageBps+'"></label>'+
    '<label>Fiktive Gebühr je Order (€)<input id="paper-fee-eur" type="number" min="0" max="100" step="0.01" value="'+p.feeEur.toFixed(2)+'"></label>'+
    '</div><button type="button" class="secondary" data-paper-costs-save>Kostenannahmen speichern</button>'+
    '<small class="paper-costs-status" role="status" aria-live="polite">Kaufpreis = Referenz × (1 + halber Spread + Slippage); Verkaufspreis entsprechend mit Abschlag. Gebühren werden beim Kauf innerhalb des festen Eurobetrags abgezogen.</small></details>';
}
