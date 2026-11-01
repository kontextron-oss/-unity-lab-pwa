'use strict';
/* Local-only hypothetical portfolio; transaction history is append-only with voids.
   Real broker holdings are NOT connected or inferred from screenshots. */
let depotSelectedId='',depotRange='1Y';
const depotActiveTrades=id=>[...cache.transactions].filter(t=>t.instrumentId===id&&!t.voidedAt&&(t.type==='BUY'||t.type==='SELL')).sort((a,b)=>a.executedAt.localeCompare(b.executedAt)||a.createdAt.localeCompare(b.createdAt));
function depotLedger(id,asOf=null){
  let qty=0,cost=0,realized=0,buys=0,sells=0;
  for(const t of depotActiveTrades(id)){
    if(asOf&&t.executedAt.slice(0,10)>asOf)break;
    const n=Number(t.quantity),amount=Number(t.amount),fx=Number(t.fx),fee=Number(t.fee)||0;
    if(!(n>0&&amount>0&&fx>0&&fee>=0))continue;
    if(t.type==='BUY'){qty+=n;cost+=amount*fx+fee;buys++}
    else{
      if(n>qty+1e-8)throw Error('Ungültige Verkaufshistorie: mehr Stücke verkauft als vorhanden.');
      const portion=qty>0?Math.min(1,n/qty):0;
      const basis=cost*portion;
      realized+=amount*fx-fee-basis;
      cost-=basis;qty-=n;sells++;
      if(qty<1e-8){qty=0;cost=0}
    }
  }
  return {qty,cost,realized,buys,sells,avg:qty>0?cost/qty:NaN};
}
function depotMarket(s){
  const item=typeof unityMarketItem==='function'?unityMarketItem(s.isin):null;
  const quality=item?unityDataQuality(item,s.isin):null;
  const display=typeof unityDisplayQuote==='function'?unityDisplayQuote(s):null;
  const fx=typeof unityEuroRate==='function'?unityEuroRate(s.currency):(s.currency==='EUR'?{rate:1,source:'EUR',date:new Date().toISOString().slice(0,10)}:null);
  if(item&&quality?.canCompare&&fx&&fx.rate>0){
    const market=display&&display.precision==='15m-bar'?display:item;
    return {price:market.price,fx:fx.rate,date:market.date,
      source:market.precision==='15m-bar'?'Inoffizieller 15-Minuten-Kursbalken · EZB-Referenz-FX':'Verzögerter Schlusskurs · EZB-Referenz-FX',
      fxSource:fx.source,fxDate:fx.date,item};
  }
  return null;
}

function depotPosition(s){
  const l=depotLedger(s.id),market=depotMarket(s);
  const value=l.qty>0&&market?l.qty*market.price*market.fx:NaN;
  return {s,...l,market,value,pnl:Number.isFinite(value)?value-l.cost:NaN};
}
function depotPositions(){return stocks().map(depotPosition).filter(p=>p.qty>1e-8)}
function depotMoney(v){return Number.isFinite(v)?euro(v):'–'}
function depotCapital(){const cfg=(cache.settings||[]).find(x=>x.id==='portfolio-capital'),opening=Number(cfg?.amount),moves=(cache.transactions||[]).filter(t=>!t.voidedAt&&(t.type==='DEPOSIT'||t.type==='WITHDRAW')),deposits=moves.filter(t=>t.type==='DEPOSIT').reduce((n,t)=>n+Number(t.amount||0),0),withdrawals=moves.filter(t=>t.type==='WITHDRAW').reduce((n,t)=>n+Number(t.amount||0),0);let buys=0,sells=0;for(const t of (cache.transactions||[]).filter(t=>!t.voidedAt&&(t.type==='BUY'||t.type==='SELL'))){const gross=Number(t.amount)*Number(t.fx),fee=Number(t.fee)||0;if(!Number.isFinite(gross)||!Number.isFinite(fee))continue;if(t.type==='BUY')buys+=gross+fee;else sells+=gross-fee}const positions=depotPositions(),invested=positions.reduce((n,p)=>n+p.cost,0),complete=positions.every(p=>Number.isFinite(p.value)),market=complete?positions.reduce((n,p)=>n+p.value,0):NaN,funded=(Number.isFinite(opening)&&opening>=0?opening:0)+deposits-withdrawals,free=funded+sells-buys,total=Number.isFinite(market)?free+market:NaN;return {configured:!!cfg||moves.length>0,opening:Number.isFinite(opening)&&opening>=0?opening:0,deposits,withdrawals,funded,buys,sells,invested,free,market,total};}
async function depotSaveCapital(value){const amount=Number(value);if(!(amount>=0&&Number.isFinite(amount)&&amount<=1000000000))throw Error('Bitte ein gültiges fiktives Startkapital in EUR eingeben.');await put('settings',{id:'portfolio-capital',amount,updatedAt:new Date().toISOString()});await audit('CAPITAL_SET','portfolio-capital','Fiktives Startkapital '+euro(amount));await refresh();}
async function depotAddCash(value,note=''){const amount=Number(value);if(!(amount>0&&Number.isFinite(amount)&&amount<=1000000000))throw Error('Bitte eine gültige fiktive Einzahlung in EUR eingeben.');const t={id:id(),type:'DEPOSIT',amount,executedAt:new Date().toISOString(),createdAt:new Date().toISOString(),note:String(note||'').trim(),source:'UNITY Lab · fiktive Einzahlung'};await put('transactions',t);await audit('CAPITAL_DEPOSIT',t.id,'Fiktive Einzahlung '+euro(amount));await refresh();}
function depotCashHistory(){const moves=[...(cache.transactions||[])].filter(t=>!t.voidedAt&&(t.type==='DEPOSIT'||t.type==='WITHDRAW')).sort((a,b)=>b.executedAt.localeCompare(a.executedAt));if(!moves.length)return '<p class="muted">Noch keine zusätzlichen fiktiven Einzahlungen.</p>';return '<div class="depot-history">'+moves.map(t=>'<div class="depot-history-row"><span class="depot-history-icon buy">+</span><span class="depot-history-desc"><b>Fiktive Einzahlung</b><small>'+esc(t.executedAt?.slice(0,10)||'')+(t.note?' · '+esc(t.note):'')+'</small></span><span class="depot-history-amount">+'+depotMoney(Number(t.amount))+'</span></div>').join('')+'</div>';}
function depotOverview(){
  const pos=depotPositions(),capital=depotCapital();
  const cost=pos.reduce((n,p)=>n+p.cost,0),complete=pos.every(p=>Number.isFinite(p.value));
  const value=complete?pos.reduce((n,p)=>n+p.value,0):NaN;
  const realized=stocks().reduce((n,s)=>n+depotLedger(s.id).realized,0);
  let h='<section class="panel depot-panel" id="depot-overview"><div class="depot-title"><h2>Mein Depot · Überblick</h2><span class="depot-sim">Simulation · lokal gespeichert</span></div>'+
    '<div class="depot-totals"><div><small>Aktueller Positionswert</small><strong>'+depotMoney(value)+'</strong></div><div><small>Einstand offener Positionen</small><strong>'+depotMoney(cost)+'</strong></div><div><small>Offener Gewinn / Verlust</small><strong>'+depotMoney(value-cost)+'</strong></div><div><small>Realisierter Gewinn / Verlust</small><strong>'+depotMoney(realized)+'</strong></div></div>';
  h+='<section class="panel" id="depot-capital"><h3>Fiktives Kapital</h3><div class="depot-totals"><div><small>Einzahlungen gesamt</small><strong>'+depotMoney(capital.funded)+'</strong></div><div><small>Frei verfügbar</small><strong>'+depotMoney(capital.free)+'</strong></div><div><small>Angelegt · offene Positionen</small><strong>'+depotMoney(capital.invested)+'</strong></div><div><small>Fiktives Gesamtvermögen</small><strong>'+depotMoney(capital.total)+'</strong></div></div><form id="capital-form"><label>Fiktives Startkapital in EUR<input name="capital" type="number" min="0" step="0.01" value="'+(capital.opening?String(capital.opening):'')+'" placeholder="z. B. 10000"></label><button class="secondary" type="submit">Startkapital speichern</button></form><form id="deposit-form"><label>Weitere fiktive Einzahlung in EUR<input name="amount" type="number" min="0.01" step="0.01" required placeholder="z. B. 500"></label><label>Notiz (optional)<input name="note" maxlength="120" placeholder="z. B. Monatsrate"></label><button class="primary" type="submit">Mehr Geld einzahlen</button></form><h3 style="margin-top:18px">Einzahlungsverlauf</h3>'+depotCashHistory()+'<p class="tiny muted">Testkäufe einschließlich Gebühren mindern das freie Kapital. Testverkäufe erhöhen es um den Nettoerlös. Ohne Startkapital oder Einzahlung bleibt das Simulationsdepot unbegrenzt.</p></section>';
  h+='<div class="depot-range" aria-label="Zeitraum der Depot-Kursverläufe">'+[['1W','Woche'],['1M','Monat'],['1Y','Jahr'],['3Y','3 Jahre'],['6Y','6 Jahre']].map(([r,label])=>'<button type="button" data-depot-range="'+r+'" class="'+(depotRange===r?'active':'')+'">'+label+'</button>').join('')+'</div>';
  if(!pos.length)h+='<p class="muted">Noch keine simulierten Depotpositionen. Deine tatsächlichen Depotbestände sind nicht verbunden. Du kannst Aktien im Simulationsdepot erfassen; vorhandene Daten bleiben unverändert.</p>';
  else{
    if(!complete)h+='<p class="depot-warning">Der Gesamtwert ist unvollständig: Für mindestens eine Position fehlt ein verwendbarer Kurs oder aktueller EUR-Wechselkurs. Es wird kein Gesamtwert geschätzt.</p>';
    h+='<div class="depot-rows">';
    for(const p of pos){
      const m=p.market?.item?unityMetrics(p.market.item):null;
      const segment=p.market?.item?unityChartData(p.market.item,depotRange):[];
      const segmentPct=segment.length>1?(segment.at(-1).close/segment[0].close-1)*100:NaN;
      h+='<button type="button" class="depot-row" data-depot-open="'+esc(p.s.id)+'"><span class="depot-row-top"><strong>'+esc(p.s.name)+'</strong><span class="'+(p.pnl>=0?'positive':'negative')+'">'+(Number.isFinite(p.pnl)&&p.cost>0?unityPct(p.pnl/p.cost*100):'Bewertung offen')+'</span></span>'+
        '<span class="depot-row-chart">'+(p.market?.item?unityChartSvg(p.market.item,depotRange,true,false):'<span class="chart-empty">Kursreihe nicht verfügbar</span>')+'</span>'+
        '<span class="depot-row-bottom"><span>'+number(p.qty,4)+' Stück · Einstand '+depotMoney(p.cost)+'</span><span>'+ (p.market?number(p.market.price,2)+' '+esc(p.s.currency):'Kurs fehlt')+' ›</span></span><span class="tiny muted">Kursentwicklung im Zeitraum: '+unityPct(segmentPct)+'</span></button>';
    }
    h+='</div>';
  }
  h+='<p class="tiny muted">Der Einstand enthält erfasste Kaufgebühren; realisierte Ergebnisse und Nettoerlöse berücksichtigen Verkaufsgebühren. Spread, Steuern und Fremdwährungskosten sind nur berücksichtigt, wenn sie als Gebühr erfasst wurden.</p><p class="tiny muted">Kurse: zeitgestempelte Pilotbalken oder verzögerte Tagesschlusskurse; keine garantierte Echtzeit. EUR-Umrechnung: EZB-Referenzkurs, kein handelbarer Bankenkurs. Der Depotwert berücksichtigt nur erfasste Simulationstransaktionen. Ohne historische EUR-Wechselkurse wird keine erfundene Gesamtdepotkurve gezeichnet.</p>'+
    '<div class="actions"><button type="button" class="secondary" data-tab-target="trades">Käufe und Verkäufe ansehen</button></div></section>';
  if(depotSelectedId)h+=depotDetail(depotSelectedId);
  return h;
}
function depotDetail(id){
  const s=stocks().find(x=>x.id===id);if(!s)return '';
  const p=depotPosition(s),item=p.market?.item||(typeof unityMarketItem==='function'?unityMarketItem(s.isin):null);
  let h='<section class="panel depot-detail" id="depot-detail"><div class="depot-title"><h2>'+esc(s.name)+' · Depotdetails</h2><button type="button" class="secondary" id="depot-close">Schließen</button></div>'+
    '<div class="depot-totals"><div><small>Stückzahl</small><strong>'+number(p.qty,4)+'</strong></div><div><small>Offener Einstand</small><strong>'+depotMoney(p.cost)+'</strong></div><div><small>Marktwert</small><strong>'+depotMoney(p.value)+'</strong></div><div><small>Realisierte Gewinne</small><strong>'+depotMoney(p.realized)+'</strong></div></div>';
  if(item)h+=unityChartPanel(item);else h+='<p class="muted">Kein historischer Börsenkurs verfügbar. Der Kursverlauf wird nicht geschätzt.</p>';
  h+='<h3>Käufe und Verkäufe</h3>'+depotTradeHistory(id);
  h+='<p class="tiny muted">Die Kurve zeigt den Börsenkurs der Aktie, nicht die Entwicklung deines persönlichen Depotwerts. Käufe und Verkäufe werden unten separat aufgeführt.</p></section>';
  return h;
}
function depotTradeHistory(id=null){
  const ts=[...cache.transactions].filter(t=>(!id||t.instrumentId===id)&&(t.type==='BUY'||t.type==='SELL')).sort((a,b)=>b.executedAt.localeCompare(a.executedAt));
  if(!ts.length)return '<p class="muted">Noch keine Käufe oder Verkäufe erfasst.</p>';
  let h='<div class="depot-history">';
  let lastDate='';
  for(const t of ts){
    const date=t.executedAt?.slice(0,10)||'unbekannt',s=cache.instruments.find(x=>x.id===t.instrumentId);
    if(date!==lastDate){h+='<div class="depot-history-date">'+esc(date)+'</div>';lastDate=date}
    const sell=t.type==='SELL',amount=Number(t.amount)*Number(t.fx),fee=Number(t.fee)||0,net=amount+(sell?-fee:fee);
    h+='<div class="depot-history-row"><span class="depot-history-icon '+(sell?'sell':'buy')+'">'+(sell?'−':'+')+'</span>'+
      '<span class="depot-history-desc"><b>'+esc(s?.name||'Unbekannt')+'</b><small>'+esc(sell?'Verkauf':'Kauf')+' · '+number(t.quantity,4)+' Stück · '+number(t.price,2)+' '+esc(s?.currency||'')+' · Gebühr '+depotMoney(fee)+'</small>'+(t.note?'<small>'+esc(t.note)+'</small>':'')+(t.decisionSnapshot?'<small class="depot-decision-at-trade">UNITY-Befund bei Testhandel: '+esc(t.decisionSnapshot.action)+' · Technikindex '+(Number.isFinite(t.decisionSnapshot.technicalIndex)?t.decisionSnapshot.technicalIndex+'/100':'nicht verfügbar')+' · Kursdaten '+esc(t.decisionSnapshot.quoteDate||'nicht verfügbar')+'</small>':'')+'</span>'+
      '<span class="depot-history-amount">'+(sell?'+':'−')+depotMoney(net)+(t.voidedAt?'<small>Storniert</small>':'')+'</span></div>';
  }
  return h+'</div>';
}
function depotSellForm(){
  const pos=depotPositions();
  if(!pos.length)return '<div class="panel"><h2>Simulierter Verkauf</h2><p>Für einen Verkauf muss zunächst eine simulierte Position vorhanden sein.</p></div>';
  return '<div class="panel"><h2>Simulierten Verkauf erfassen</h2><p class="tiny muted">Nur Stückzahl und Aktie auswählen. Referenzkurs und EUR-Umrechnung werden automatisch geladen und vor dem Speichern bestätigt. Keine echte Order.</p>'+
    '<form id="sell-form"><label>Aktie<select name="instrumentId" required>'+pos.map(p=>'<option value="'+esc(p.s.id)+'">'+esc(p.s.name)+' · '+number(p.qty,4)+' Stück verfügbar</option>').join('')+'</select></label>'+
    '<label>Stückzahl<input type="number" name="quantity" step="any" min="0.000001" required></label>'+
    '<label class="full">Notiz (optional)<textarea name="note" maxlength="1000"></textarea></label>'+
    '<button class="primary" type="submit">Testverkauf prüfen</button></form></div>';
}

document.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.dataset.depotRange){depotRange=b.dataset.depotRange;render();return}
  if(b.dataset.depotOpen){depotSelectedId=b.dataset.depotOpen;render();document.getElementById('depot-detail')?.scrollIntoView({behavior:'smooth',block:'start'})}
  if(b.id==='depot-close'){depotSelectedId='';render()}
  if(b.dataset.tabTarget){activeTab=b.dataset.tabTarget;render();document.getElementById('app')?.scrollIntoView({block:'start'})}
});
document.addEventListener('submit',async e=>{
  if(!['sell-form','capital-form','deposit-form'].includes(e.target.id))return;
  e.preventDefault();
  try{
    const d=Object.fromEntries(new FormData(e.target));
    if(e.target.id==='capital-form'){await depotSaveCapital(d.capital);return}if(e.target.id==='deposit-form'){await depotAddCash(d.amount,d.note);return}
    const saved=await unityHomeSaveTrade({...d,type:'SELL'});
    if(saved){depotSelectedId=d.instrumentId;render()}
  }catch(err){alert(err.message||String(err))}
});
