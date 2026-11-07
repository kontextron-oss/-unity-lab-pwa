'use strict';
/* Home-first selected watchlist. Source: delayed market.json daily closes.
   This is not a live broker account, nor a real-time trading signal. */
function unitySetReleaseLabel(){
  if(typeof document==='undefined'||typeof document.querySelector!=='function')return;
  const badge=document.querySelector('header h1 span');if(badge)badge.textContent='0.16.5';
  const footer=document.querySelector('.footer');if(footer)footer.textContent=footer.textContent.replace(/Unity Lab 0\.13\.97|Unity Lab 0\.13\.98/,'Unity Lab 0.16.5');
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',unitySetReleaseLabel,{once:true});else unitySetReleaseLabel();
let unityHomeRange='1D',unityHomeSelected='',unityHomeTradeMode='',unityHomeDrag=null,unityHomeSort='observe';
let unityHomeSortLoaded=false;
const UNITY_HOME_SORT_SETTING='watchlist-sort-preference';
function unityHomeRestoreSort(){
  if(unityHomeSortLoaded||typeof cache==='undefined'||!Array.isArray(cache.settings))return;
  const record=cache.settings.find(x=>x.id===UNITY_HOME_SORT_SETTING);
  if(['manual','entry','observe','sell'].includes(record?.mode))unityHomeSort=record.mode;
  unityHomeSortLoaded=true;
}
async function unityHomeSelectSort(mode,rerender=true){
  if(!['manual','entry','observe','sell'].includes(mode))return false;
  unityHomeSort=mode;unityHomeSortLoaded=true;
  await put('settings',{id:UNITY_HOME_SORT_SETTING,mode,updatedAt:new Date().toISOString()});
  if(rerender)await refresh();
  return true;
}
const UNITY_FIRST_TWENTY=['ABBN','SU','ETN','ENR','VRT','NDX1','PRY','LR','SIE','BEAN','GEV','NVT','HUBB','PWR','NEX','IFX','JEN','AMD','DWS','TKA'];
const unityPilotStocks=()=>stocks().filter(s=>UNITY_FIRST_TWENTY.includes(String(s.ticker||'').toUpperCase())).sort((a,b)=>UNITY_FIRST_TWENTY.indexOf(String(a.ticker||'').toUpperCase())-UNITY_FIRST_TWENTY.indexOf(String(b.ticker||'').toUpperCase()));
async function unityEnsurePilotTwenty(){
  const missing=(typeof CATALOG==='undefined'?[]:CATALOG).filter(ref=>UNITY_FIRST_TWENTY.includes(String(ref.ticker||'').toUpperCase())&&!(cache.instruments||[]).some(s=>String(s.ticker||'').toUpperCase()===String(ref.ticker||'').toUpperCase()&&String(s.exchange||'').toLowerCase()===String(ref.exchange||'').toLowerCase()));
  for(const ref of missing){
    const stock={id:id(),name:ref.name,ticker:ref.ticker,isin:ref.isin||'',exchange:ref.exchange,currency:ref.currency,providerSymbol:ref.providerSymbol||'',createdAt:new Date().toISOString(),catalogSource:'UNITY erste Analysegruppe'};
    await put('instruments',stock);await audit('STOCK_PILOT_ADD',stock.id,stock.ticker);
  }
  if(missing.length)await refresh();
  return unityPilotStocks();
}
const unityHomeStocks=()=>stocks().filter(s=>!s.watchHidden).sort((a,b)=>{
  const aa=Number.isFinite(Number(a.watchOrder))&&a.watchOrder!==undefined?Number(a.watchOrder):Infinity;
  const bb=Number.isFinite(Number(b.watchOrder))&&b.watchOrder!==undefined?Number(b.watchOrder):Infinity;
  return aa-bb||String(a.createdAt||'').localeCompare(String(b.createdAt||''))||a.name.localeCompare(b.name);
});
async function unityHomeReorder(sourceId,targetId){
  const ordered=unityHomeStocks(),from=ordered.findIndex(s=>s.id===sourceId),to=ordered.findIndex(s=>s.id===targetId);
  if(from<0||to<0||from===to)return false;
  const moved=ordered.splice(from,1)[0];ordered.splice(to,0,moved);
  // Atomic update: either all new positions are persisted or none are.
  await new Promise((resolve,reject)=>{
    const tx=db.transaction('instruments','readwrite'),store=tx.objectStore('instruments');
    ordered.forEach((s,i)=>store.put({...s,watchOrder:i}));
    tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
  });
  await audit('WATCHLIST_REORDER',sourceId,'Neue Position: '+(to+1));
  await refresh();return true;
}
async function unityHomeShift(sid,delta){
  const ordered=unityHomeStocks(),i=ordered.findIndex(s=>s.id===sid);
  if(i<0||i+delta<0||i+delta>=ordered.length)return false;
  return unityHomeReorder(sid,ordered[i+delta].id);
}
const unityHomePeriods=[['1D','Aktuell'],['1W','Woche'],['1M','Monat'],['3M','3 Monate'],['1Y','Jahr']];
function unityHomeQuote(s){
  const crypto=typeof unityIsCryptoAsset==='function'&&unityIsCryptoAsset(s);
  const verified=crypto&&typeof unityCryptoMarketOverride==='function'?unityCryptoMarketOverride(s):null;
  const full=crypto?verified:(typeof unityMarketForStock==='function'?unityMarketForStock(s):unityMarketItem(s.isin)),x=full||(crypto?null:(typeof unityReferenceQuoteItem==='function'?unityReferenceQuoteItem(s):null)),m=x?unityMetrics(x):null;
  const quality=x?unityDataQuality(x,s.isin):null;
  const technical=!!m&&!m.stale&&Array.isArray(x?.points)&&x.points.length>=200;
  return {x,m,quality,technical,valid:!!m&&!m.stale&&!!quality?.canCompare};
}
function unityHomeDataState(s){
  const crypto=typeof unityIsCryptoAsset==='function'&&unityIsCryptoAsset(s);
  if(crypto){
    const verified=typeof unityCryptoMarketOverride==='function'?unityCryptoMarketOverride(s):null;
    const loading=typeof unityCryptoMarketLoading!=='undefined'&&unityCryptoMarketLoading.has(s?.id);
    const error=typeof unityCryptoMarketErrors!=='undefined'?unityCryptoMarketErrors.get(s?.id):'';
    if(verified&&Array.isArray(verified.points)&&verified.points.length>=200)return {kind:'ready',label:'Kryptoquelle bestätigt'};
    if(loading)return {kind:'loading',label:'Krypto-Marktdaten werden geprüft'};
    if(error)return {kind:'failed',label:'Kryptoquelle nicht erreichbar',detail:error};
    return {kind:'waiting',label:'Kryptoquelle wird geprüft'};
  }
  const symbol=String(s?.providerSymbol||'').toUpperCase();
  const dynamic=typeof unityDynamicItems!=='undefined'&&unityDynamicItems.has(symbol);
  const loading=!!(symbol&&typeof unityDynamicPending!=='undefined'&&unityDynamicPending.has(symbol));
  const error=symbol&&typeof unityDynamicErrors!=='undefined'?unityDynamicErrors.get(symbol):'';
  const technical=unityHomeQuote(s).technical;
  if(loading)return {kind:'loading',label:'wird ausgelesen'};
  if(error)return {kind:'failed',label:'Quelle nicht erreichbar',detail:error};
  if(technical)return {kind:'ready',label:dynamic?'technisch ausgewertet':'Kursreihe vorhanden'};
  if(!symbol)return {kind:'missing',label:'keine Kursquelle zugeordnet'};
  return {kind:'waiting',label:'noch nicht geprüft'};
}
function unityPreAnalysis(s){
  if(typeof unityIsCryptoAsset==='function'&&unityIsCryptoAsset(s)){
    const d=typeof unityCryptoAnalysis==='function'?unityCryptoAnalysis(s):null;
    if(d?.loading)return {kind:'data',label:'Krypto-Daten werden erfasst',score:NaN,rank:5,detail:'Kursquelle und Tageshistorie werden geprüft.'};
    if(d?.loadError)return {kind:'data',label:'Kryptoquelle prüfen',score:NaN,rank:5,detail:d.loadError};
    return {kind:'data',label:'Kryptoanalyse ergänzen',score:NaN,rank:5,detail:d?.priceReady?'Preis und Liquidität sind belegt; Trend, Netzwerk, Tokenökonomie und Ereignisse werden getrennt geprüft.':'Für diese Kryptoanalyse fehlt noch eine bestätigte Kursquelle.'};
  }
  const state=unityHomeDataState(s),{x,m,technical}=unityHomeQuote(s);
  if(state.kind==='loading')return {kind:'data',label:'Daten werden erfasst',score:NaN,rank:5,detail:'Kursreihe wird geladen.'};
  if(state.kind==='failed')return {kind:'data',label:'Daten prüfen',score:NaN,rank:5,detail:state.detail||'Keine Kursreihe abrufbar.'};
  if(state.kind==='missing')return {kind:'data',label:'Daten prüfen',score:NaN,rank:5,detail:'Für diesen Wert fehlt eine Kursquelle.'};
  if(!technical||!m||!x)return {kind:'data',label:'Daten prüfen',score:NaN,rank:5,detail:'Für die Vorauswahl fehlen noch ausreichende Kursdaten.'};
  const report=typeof unityFundPilotItem==='function'?unityFundPilotItem(s):null;
  const required=['revenue','netIncome','assets','equity','operatingCashFlow'];
  const reportEnd=String(report?.latestFiling?.periodEnd||'');
  const reportFresh=Number.isFinite(Date.parse(reportEnd))&&Date.now()-Date.parse(reportEnd+'T12:00:00Z')<=550*86400000;
  const reportComplete=!!report&&reportFresh&&required.every(key=>Number.isFinite(Number(report.metrics?.[key]?.value)));
  if(!reportComplete)return {kind:'data',label:'Technischer Radar · Unternehmensdaten offen',score:NaN,rank:5,detail:'Der Kursverlauf ist technisch auswertbar, aber geprüfte Unternehmenszahlen, Bewertung, Guidance oder Ergebnisrisiko reichen noch nicht für eine Investment-Rangfolge.'};
  const rsi=Number(m.rsi),index=Number(m.technicalIndex),m1=unityHomeMovement(x,'1M'),m3=unityHomeMovement(x,'3M');
  const macdAvailable=Number.isFinite(Number(m.macd))&&Number.isFinite(Number(m.signal))&&m.macd!==undefined&&m.signal!==undefined;
  const macdUp=macdAvailable?Number(m.macd)>=Number(m.signal):false;
  const score=Math.max(0,Math.min(100,Math.round((Number.isFinite(index)?index:0)*.60+(Number.isFinite(m1)?Math.max(-20,Math.min(20,m1))*0.75:0)+(Number.isFinite(m3)?Math.max(-30,Math.min(30,m3))*0.35:0)+(macdUp?8:0))));
  const improving=Number.isFinite(m1)&&m1>0&&(macdAvailable?macdUp:Number.isFinite(m3)&&m3>0);
  if(m.trend==='Aufwärtstrend'&&rsi>=38&&rsi<=67&&score>=65&&(improving||m3>0))return {kind:'research',label:'Recherche lohnt sich',score,rank:0,detail:'Aufwärtstrend bestätigt, Dynamik positiv und Kurs nicht überhitzt. Details zu Unternehmen, Bewertung und Risiko prüfen.'};
  if(rsi>=68)return {kind:'wait',label:'Abwarten',score,rank:3,detail:'Der Kurs ist kurzfristig weit gelaufen. Erst einen Rücksetzer oder eine neue stabile Zone abwarten.'};
  if(m.trend==='Abwärtstrend'||score<35)return {kind:'weak',label:'Technisch schwach',score,rank:4,detail:'Negativer Trend oder noch keine bestätigte Bodenbildung. Derzeit keine weitere Recherche priorisieren.'};
  if(improving||score>=55)return {kind:'improving',label:'Entwicklung verbessert sich',score,rank:1,detail:'Technik und Dynamik verbessern sich. In Beobachtung halten; bei weiterer Bestätigung Details öffnen.'};
  return {kind:'observe',label:'Beobachten',score,rank:2,detail:'Die technische Lage ist noch nicht eindeutig. Erst bei klarerer Trendbewegung vertiefen.'};
}
/* Research priority is deliberately separate from price movement and trade approval.
   Missing historical/quality inputs get DATA, not a negative investment rating. */
function unityResearchIndicator(s){
  const pre=unityPreAnalysis(s);
  if(pre.kind==='research')return {kind:'research',label:'Analyse sinnvoll',detail:pre.detail,score:pre.score};
  if(pre.kind==='weak')return {kind:'weak',label:'Derzeit nachrangig',detail:pre.detail,score:pre.score};
  if(pre.kind==='data')return {kind:'data',label:pre.label||'Daten prüfen',detail:pre.detail,score:NaN};
  return {kind:'observe',label:'Beobachten',detail:pre.detail,score:pre.score};
}
/* Daily pullback monitor for the SAME SMA50 ±2% setup used by unityCandidate.
   It is recalculated from valid dated closes when the PWA opens/refreshes.
   An EOD technical zone is NEVER a recommendation or a real-time alert. */
function unityPullbackAlert(s){
  const {x,m,quality,technical}=unityHomeQuote(s);
  if(!technical||!x||!quality?.canCompare||x.dynamicExperimental||
     x.currency!==s.currency||!Number.isFinite(Number(m?.ma50))||
     !Number.isFinite(Number(m?.ma200))||!Number.isFinite(Number(m?.rsi))||
     !(Number(x.price)>0))return {kind:'data',label:'',detail:'Für die Rücksetzer-Überwachung fehlen geprüfte, aktuelle und vollständige Tageskursdaten.'};
  const close=Number(x.price),low=m.ma50*.98,high=m.ma50*1.02;
  const validTrend=m.trend==='Aufwärtstrend'&&close>=m.ma200&&m.ma50>=m.ma200;
  if(!validTrend)return {kind:'none',label:'',detail:'Langfristiger Aufwärtstrend nicht mehr bestätigt.'};
  const inRsi=m.rsi>=40&&m.rsi<=68;
  if(!inRsi)return {kind:'none',label:'',detail:'Technische RSI-Bedingung nicht erfüllt.'};
  let kind='none',label='',detail='';
  if(close>high){
    kind='watch';label='Rücksetzer abwarten';
    detail='Schlusskurs noch über der technischen Einstiegszone. Kursrückgang abwarten, dann Kriterien erneut prüfen.';
  }else if(close>=low&&close<=high){
    const p=x.points,prev50=p.slice(-51,-1);
    const before=Number(p.at(-2)?.close);
    const previousSma=prev50.length===50?prev50.reduce((n,v)=>n+Number(v.close),0)/50:NaN;
    const entered=Number.isFinite(previousSma)&&before>previousSma*1.02;
    kind='reached';label=entered?'Rücksetzer eingetreten':'Einstiegszone erreicht';
    detail='Der zuletzt verfügbare Tages-Schlusskurs liegt in der SMA50-Zone. Trend und RSI passen technisch; Bilanz, Bewertung, Earnings und Risiko bleiben gesondert zu prüfen.';
  }else{
    // Too deep a drop must not be celebrated as a successful entry.
    return {kind:'broken',label:'Zone unterschritten',detail:'Der Kurs liegt bereits unter der technischen Einstiegszone; nicht automatisch nachkaufen.',
      close,low,high,date:x.date,currency:s.currency};
  }
  // Confirmed event and documented RR veto suppress a positive-looking flag.
  const f=typeof cache!=='undefined'?(cache.fundamentals||[]).find(v=>v.id===s.id):null;
  let issuerEvent=null;
  try{issuerEvent=typeof unityIssuerDecisionEvidence==='function'?unityIssuerDecisionEvidence(s):null}catch(_){}
  const earningsDate=f?.earningsDate||(issuerEvent?.earnings?.confirmed?issuerEvent.earnings.date:'');
  const event=Date.parse(earningsDate||'');
  const near=(!!f?.earningsConfirmed||issuerEvent?.earnings?.confirmed===true)&&Number.isFinite(event)&&
    event>=Date.now()-86400000&&event<Date.now()+7*86400000;
  const stop=Number(f?.stop),target=Number(f?.target);
  const rr=stop>0&&stop<close&&target>close?(target-close)/(close-stop):NaN;
  if(kind==='reached'&&(near||(Number.isFinite(rr)&&rr<2))){
    kind='blocked';label='Zone erreicht · Risiko prüfen';
    detail=near?'Bestätigter Earnings-Termin innerhalb sieben Tagen. Technische Zone erreicht, aber Ereignisrisiko geht vor.':
      'Chance-Risiko-Verhältnis unter 2:1. Technische Zone erreicht, aber die UNITY-Hard-Rule verhindert eine positive Einstiegsaussage.';
  }
  return {kind,label,detail,close,low,high,date:x.date,currency:s.currency};
}
function unityPullbackLabel(s,signal=unityPullbackAlert(s)){
  if(!['reached','blocked','watch'].includes(signal.kind))return '';
  return '<span class="home-pullback-flag home-pullback-'+signal.kind+'">'+
    (signal.kind==='reached'?'◆ ':signal.kind==='blocked'?'! ':'○ ')+esc(signal.label)+'</span>';
}
/* Personal price zones are deliberately a local watcher, not a broker order.
   It checks the last available reference price when UNITY is opened/refreshed. */
const unityZonePlanId=s=>'zone-plan:'+s.id;
const unityAutoBuyId=s=>'auto-test-buy:'+s.id;
const unityAutoSellId=s=>'auto-test-sell:'+s.id;
function unityZonePlan(s){return ((typeof cache!=='undefined'&&cache.settings)||[]).find(x=>x.id===unityZonePlanId(s)&&!x.deletedAt)||null}
function unityAutoBuy(s){return ((typeof cache!=='undefined'&&cache.settings)||[]).find(x=>x.id===unityAutoBuyId(s)&&x.active&&!x.executedAt)||null}
function unityAutoSell(s){return ((typeof cache!=='undefined'&&cache.settings)||[]).find(x=>x.id===unityAutoSellId(s)&&x.active&&!x.executedAt)||null}
function unityAutoExitZone(s){
  const {m,technical}=unityHomeQuote(s);if(!technical||!m||!Number.isFinite(Number(m.ma50))||!Number.isFinite(Number(m.ma200)))return null;
  return Math.max(Number(m.ma200)*.99,Number(m.ma50)*.96);
}
function unityCalculatedEntry(s){
  const decision=typeof unityDeepDecision==='function'?unityDeepDecision(s):null,a=typeof unityCalc==='function'?unityCalc(s):null;
  const fair=Number(a?.f?.fairValue),technical=Number(decision?.entryUpper),stop=Number(a?.f?.stop);
  if(!decision?.investmentReady||decision.kind!=='positive'||!(fair>0)||!(technical>0))return {ready:false,decision,a,price:NaN,stop:NaN};
  const lower=Number(decision?.entryLower),raw=Math.min(technical,fair*.90); // 10 % safety margin, then technical timing
  const price=Number.isFinite(lower)?Math.max(lower,raw):raw;
  return {ready:Number.isFinite(price)&&price>0,decision,a,price,stop:stop>0?stop:NaN};
}
function unityTechnicalTestEntry(s){
  const signal=unityPullbackAlert(s);
  const price=Number(signal.high);
  return {ready:signal.kind==='reached'&&Number.isFinite(price)&&price>0,price,signal};
}
function unityAutoBuyEntry(s,mode){return mode==='technical'?unityTechnicalTestEntry(s):unityCalculatedEntry(s)}
function unityAutoBuyModeLabel(mode){return mode==='technical'?'Technischer Testkauf':'Strenge UNITY-Freigabe'}
/* Auto-test buys use fixed EUR amounts only. Existing active percentage
   orders are converted ONCE from the current free-capital snapshot before UI
   rendering or simulated execution. Historic executed/closed records remain
   untouched; no old percentage rule participates in the order runner. */
const UNITY_AUTO_EUR_MIGRATION_VERSION=1;
function unityAutoMigrationPlan(settings,freeCash,alreadySpent,at){
  const records=Array.isArray(settings)?settings:[];
  const available=Number.isFinite(Number(freeCash))?Math.max(0,Math.floor(Number(freeCash)*100+1e-7)/100):0;
  const changes=[],pending=[];
  for(const order of records){
    if(order?.kind!=='auto-test-buy'||!order.active||order.executedAt)continue;
    const current=unityAutoEurAmount(order);
    if(Number.isFinite(current)&&current>0){
      pending.push(current);
      continue;
    }
    const raw=Number(order.allocationPct);
    const percentage=[2,5,10,15,20,25,50].includes(raw)?raw:2;
    const cents=Math.round(available*percentage); // percentage of EUR * 100 cents
    const amount=cents/100;
    const updated={...order,allocationEur:amount,updatedAt:at,
      euroMigration:{version:UNITY_AUTO_EUR_MIGRATION_VERSION,baseEur:available,
        previousPercent:percentage,convertedAt:at,needsReview:amount<1}};
    delete updated.allocationPct;
    changes.push(updated);
    if(amount>=1)pending.push(amount);
  }
  const priorBudget=records.find(r=>r.id===UNITY_AUTO_BUDGET_KEY);
  let budget=null;
  if(changes.length&&!priorBudget&&available>=1){
    const totalPending=pending.reduce((n,a)=>n+a,0);
    const limit=Math.round((Math.max(0,alreadySpent)+Math.min(available,totalPending))*100)/100;
    if(limit>=1)budget={id:UNITY_AUTO_BUDGET_KEY,kind:'auto-test-budget',
      limitEur:limit,updatedAt:at,
      migrationSetup:true,migrationBaseEur:available};
  }
  return {changes,budget,available,count:changes.length};
}
async function unityAutoMigrateLegacy(){
  if(typeof db==='undefined'||!db||typeof cache==='undefined'||!Array.isArray(cache.settings))return false;
  const capital=typeof depotCapital==='function'?depotCapital():null,now=new Date().toISOString();
  const plan=unityAutoMigrationPlan(cache.settings,capital?.free,unityAutoBudgetSpent(),now);
  if(!plan.count)return false;
  // One settings+audit transaction: either every pending order is converted,
  // or none is. A retry/reopen cannot accidentally reconvert EUR orders.
  await new Promise((resolve,reject)=>{
    const tx=db.transaction(['settings','audit'],'readwrite');
    const store=tx.objectStore('settings'),aud=tx.objectStore('audit');
    for(const o of plan.changes)store.put(o);
    if(plan.budget)store.put(plan.budget);
    aud.put({id:id(),at:now,type:'AUTO_EURO_MIGRATION',ref:'auto-test-buy',
      detail:plan.count+' offene Prozentaufträge aus freiem Testkapital '+
        depotMoney(plan.available)+' in feste Eurobeträge umgerechnet'+
        (plan.budget?'; Budget '+depotMoney(plan.budget.limitEur):'; Budget manuell festlegen')});
    tx.oncomplete=()=>resolve();
    tx.onerror=()=>reject(tx.error||new Error('Auftragsmigration fehlgeschlagen'));
    tx.onabort=()=>reject(tx.error||new Error('Auftragsmigration abgebrochen'));
  });
  return true;
}
const UNITY_AUTO_BUDGET_KEY='auto-test-buy-total-budget';
const UNITY_AUTO_FIXED_DEFAULT=100;
function unityAutoEurAmount(order){
  const value=order?.allocationEur;
  return value===null||value===undefined||value===''?NaN:Number(value);
}
function unityAutoValidateEur(value){
  const amount=Number(value);
  if(!(Number.isFinite(amount)&&amount>=1&&amount<=1000000000&&Math.round(amount*100)/100===amount))
    throw Error('Bitte einen festen Betrag von mindestens 1,00 € mit höchstens zwei Nachkommastellen eingeben.');
  return amount;
}
function unityAutoBudgetSetting(){return (cache?.settings||[]).find(x=>x.id===UNITY_AUTO_BUDGET_KEY)||null}
function unityAutoBudgetSpent(){
  // Count only active-run auto buys. Test sales do NOT replenish a spending cap.
  return Math.round((cache?.transactions||[]).filter(t=>!t.voidedAt&&t.type==='BUY'&&
    t.source==='UNITY Lab · Auto-Testkauf').reduce((n,t)=>n+(Number(t.amount)||0)*(Number(t.fx)||0)+
      (Number(t.fee)||0),0)*100)/100;
}
function unityAutoBudgetStatus(){
  const setting=unityAutoBudgetSetting(),limit=Number(setting?.limitEur);
  const configured=!!setting&&Number.isFinite(limit)&&limit>0;
  const spent=unityAutoBudgetSpent();
  return {configured,limit:configured?limit:NaN,spent,
    remaining:configured?Math.max(0,Math.round((limit-spent)*100)/100):NaN,
    updatedAt:setting?.updatedAt||''};
}
async function unityAutoSetBudget(value){
  const limit=unityAutoValidateEur(value),old=unityAutoBudgetSetting();
  if(old&&Number(old.limitEur)===limit)return false;
  await put('settings',{id:UNITY_AUTO_BUDGET_KEY,kind:'auto-test-budget',
    limitEur:limit,updatedAt:new Date().toISOString()});
  await audit('AUTO_TEST_BUDGET_CHANGED',UNITY_AUTO_BUDGET_KEY,
    'Grenze '+(old?.limitEur?depotMoney(Number(old.limitEur)):'nicht festgelegt')+
    ' → '+depotMoney(limit)+'; bisher eingesetzt '+depotMoney(unityAutoBudgetSpent()));
  await refresh();return true;
}
async function unityAutoBuyChangeAllocation(s,allocation){
  if(!s)throw Error('Aktie nicht gefunden.');
  const existing=unityAutoBuy(s);
  if(!existing)throw Error('Kein offener automatischer Testkauf vorhanden. Bitte zuerst einen Auftrag aktivieren.');
  if(!unityAutoBudgetStatus().configured)throw Error('Bitte zunächst das Gesamtbudget für automatische Testkäufe festlegen.');
  const amount=unityAutoValidateEur(allocation),old=unityAutoEurAmount(existing);
  if(Number.isFinite(old)&&old===amount)return false;
  // Editing a pending fill clears its trigger. Otherwise a user could increase
  // spending after the price signal while a previous quote is already known.
  const {triggerQuoteDate,triggeredAt,triggerLimit,triggerRefPrice,triggerMode,...rest}=existing;
  const updated={...rest,allocationEur:amount,updatedAt:new Date().toISOString(),
    state:'waiting',lastBlockedReason:triggerQuoteDate?'Kaufbetrag verändert · neuer Einstieg erforderlich':
      rest.lastBlockedReason||''};
  delete updated.allocationPct;
  // Preserve order identity, mode, and activation date; never change transactions.
  await put('settings',updated);
  await audit('AUTO_TEST_BUY_AMOUNT_CHANGED',s.id,
    (Number.isFinite(old)?depotMoney(old):'noch kein Eurobetrag')+
    ' → '+depotMoney(amount)+' · '+unityAutoBuyModeLabel(existing.mode));
  await refresh();return true;
}
function unityAutoBuyControls(s,queued,mode){
  const fixed=unityAutoEurAmount(queued),amount=Number.isFinite(fixed)&&fixed>0?fixed:UNITY_AUTO_FIXED_DEFAULT;
  const input='<label class="tiny">Fester Betrag je Testkauf (€)<input id="auto-buy-amount-'+esc(s.id)+'" type="number" inputmode="decimal" min="1" max="1000000000" step="0.01" value="'+amount.toFixed(2)+'"></label>';
  if(queued){
    const stamp=queued.updatedAt&&Number.isFinite(Date.parse(queued.updatedAt))?
      ' · '+new Date(queued.updatedAt).toLocaleString('de-DE',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'';
    const saved=!(fixed>=1)?'Noch kein ausführbarer Eurobetrag · bitte Betrag festlegen.':
      queued.updatedAt?'✓ Betrag gespeichert: '+depotMoney(fixed)+stamp:
      'Aktiver Auftrag · fester Betrag '+depotMoney(fixed);
    return '<div class="home-auto-allocation"><span class="actions">'+input+
      '<button type="button" class="primary" data-home-auto-buy-save="'+esc(s.id)+'">Betrag speichern</button>'+
      '<button type="button" class="secondary" data-home-auto-buy="'+esc(s.id)+'">Auto-Testkauf ausschalten</button></span>'+
      '<small class="home-auto-save-state" role="status" aria-live="polite">'+esc(saved)+'</small></div>';
  }
  return '<span class="actions">'+input+
    '<button type="button" class="primary" data-home-auto-buy="'+esc(s.id)+'" data-auto-mode="technical">Technisch aktivieren</button>'+
    '<button type="button" class="secondary" data-home-auto-buy="'+esc(s.id)+'" data-auto-mode="strict">Streng aktivieren</button></span>';
}
function unityAutoBuyRecommendation(s){
  const entry=unityCalculatedEntry(s),decision=entry.decision;
  if(entry.ready)return {kind:'buy',title:'UNITY empfiehlt: Auto-Testkauf möglich',text:'Berechneter Einstiegspreis bis '+number(entry.price,2)+' '+s.currency+'. Unternehmenswert, Sicherheitsmarge, Risiko und technisches Timing sind im Modell erfüllt.'};
  if(decision?.kind==='wait'||decision?.kind==='no')return {kind:'wait',title:'UNITY empfiehlt: Abwarten',text:decision.reason||'Die Voraussetzungen für einen Einstieg sind derzeit nicht erfüllt.'};
  return {kind:'open',title:'UNITY empfiehlt: Noch nicht entscheiden',text:decision?.reason||'Für eine belastbare Empfehlung fehlen noch Unternehmens-, Bewertungs-, Earnings- oder Risikodaten.'};
}
function unityZonePlanState(s){
  const plan=unityZonePlan(s),quote=typeof unityDisplayQuote==='function'?unityDisplayQuote(s):null,price=Number(quote?.price);
  if(!plan)return {plan:null,price,kind:'none',label:''};
  const entryLow=Number(plan.entryLow),entryHigh=Number(plan.entryHigh),exitLow=Number(plan.exitLow),exitHigh=Number(plan.exitHigh);
  if(!(price>0))return {plan,price,kind:'waiting',label:'Kurs prüfen'};
  if(exitLow>0&&price<=exitLow)return {plan,price,kind:'exit',label:'Verkaufszone unten erreicht'};
  if(exitHigh>0&&price>=exitHigh)return {plan,price,kind:'exit',label:'Verkaufszone oben erreicht'};
  if(entryLow>0&&entryHigh>=entryLow&&price>=entryLow&&price<=entryHigh)return {plan,price,kind:'entry',label:'Eigene Kaufzone erreicht'};
  return {plan,price,kind:'watch',label:'Zonenwächter aktiv'};
}

/* Simulation order desk. Local controls are independent of the strict
   valuation gate: missing valuation must not hide cancellation or sell controls. */
function unityAutoStockBadge(s){
  const settings=typeof cache==='undefined'?[]:(cache.settings||[]);
  const trades=typeof cache==='undefined'?[]:(cache.transactions||[]);
  const buy=settings.some(x=>x.id===unityAutoBuyId(s)&&x.active&&!x.executedAt);
  const sell=settings.some(x=>x.id===unityAutoSellId(s)&&x.active&&!x.executedAt);
  const booked=trades.some(t=>t.instrumentId===s.id&&!t.voidedAt&&
    (t.source==='UNITY Lab · Auto-Testkauf'||t.source==='UNITY Lab · Auto-Testverkauf'));
  return (buy?'<small class="home-auto-mark">● Auto-Testkauf vorgemerkt</small>':'')+
    (sell?'<small class="home-auto-mark">● Auto-Testverkauf vorgemerkt</small>':'')+
    (booked?'<small class="home-auto-booked">✓ Automatischer Testhandel gebucht</small>':'');
}
function unityAutoOrdersSummary(){
  if(typeof cache==='undefined')return '';
  const orders=(cache.settings||[]).filter(x=>x.active&&!x.executedAt&&
    (x.kind==='auto-test-buy'||x.kind==='auto-test-sell'));
  const trades=(cache.transactions||[]).filter(t=>!t.voidedAt&&
    (t.source==='UNITY Lab · Auto-Testkauf'||t.source==='UNITY Lab · Auto-Testverkauf'));
  const buy=trades.filter(t=>t.type==='BUY').reduce((n,t)=>n+
    (Number(t.amount)||0)*(Number(t.fx)||0)+(Number(t.fee)||0),0);
  const sell=trades.filter(t=>t.type==='SELL').reduce((n,t)=>n+
    (Number(t.amount)||0)*(Number(t.fx)||0)-(Number(t.fee)||0),0);
  const capital=typeof depotCapital==='function'?depotCapital():null;
  const budget=unityAutoBudgetStatus();
  let h='<section class="panel home-auto-desk" aria-label="Automatisierung im Simulationsdepot">'+
    '<h2>Automatik · Testdepot</h2>'+
    '<p class="tiny muted">Nur fiktive Käufe und Verkäufe; keine Brokerverbindung oder Hintergrundausführung. Jeder Auftrag bekommt zuerst ein bestätigtes Signal und wird frühestens mit einem SPÄTER beobachteten Tageskurs modelliert – niemals rückwirkend zum auslösenden Schlusskurs. Kaufbudget wird nicht vorab reserviert; Verkäufe füllen es nicht wieder auf.</p>'+
    '<div class="home-auto-totals">'+
      '<div><small>Vorgemerkte Aufträge</small><b>'+orders.length+'</b></div>'+
      '<div><small>Automatisch für Testkäufe eingesetzt</small><b>'+depotMoney(buy)+'</b></div>'+
      '<div><small>Automatische Testverkaufserlöse</small><b>'+depotMoney(sell)+'</b></div>'+
      '<div><small>Freies Testkapital</small><b>'+(capital?.configured?depotMoney(capital.free):'Noch nicht festgelegt')+'</b></div>'+
      '</div>';
  const budgetStamp=budget.updatedAt&&Number.isFinite(Date.parse(budget.updatedAt))?
    ' · gespeichert '+new Date(budget.updatedAt).toLocaleString('de-DE',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'';
  h+='<div class="home-auto-budget"><h3>Gesamtbudget für automatische Testkäufe</h3>'+
    '<div class="home-auto-budget-metrics"><span><small>Budgetgrenze</small><b>'+
    (budget.configured?depotMoney(budget.limit):'Noch nicht festgelegt')+'</b></span>'+
    '<span><small>Bereits automatisch gekauft</small><b>'+depotMoney(budget.spent)+'</b></span>'+
    '<span><small>Verfügbarer Budgetrest</small><b>'+(budget.configured?depotMoney(budget.remaining):'–')+'</b></span></div>'+
    '<div class="actions"><label class="tiny">Gesamtlimit in EUR<input id="auto-total-budget" inputmode="decimal" type="number" min="1" max="1000000000" step="0.01" value="'+
    (budget.configured?Number(budget.limit).toFixed(2):'')+'" placeholder="z. B. 2000"></label>'+
    '<button type="button" class="primary" data-home-auto-budget-save>Budget speichern</button></div>'+
    '<small class="home-auto-budget-state" role="status" aria-live="polite">'+
    esc(budget.configured?'✓ Budget gespeichert'+budgetStamp+'. Neue Testkäufe dürfen die Grenze nicht überschreiten.':
      'Bitte Gesamtbudget festlegen; ohne Budget führt UNITY keine automatischen Käufe aus.')+
    '</small></div>';
  if(!orders.length)h+='<p class="tiny muted">Keine Aufträge aktiv. Aktie öffnen und dort zwischen technischem und strengem UNITY-Testkauf wählen.</p>';
  for(const order of orders){
    const stock=(cache.instruments||[]).find(s=>s.id===order.instrumentId);
    const kind=order.kind==='auto-test-buy'?'Kauf':'Verkauf';
    const euro=unityAutoEurAmount(order);
    const label=order.kind==='auto-test-buy'?unityAutoBuyModeLabel(order.mode||'strict')+' · '+
      (Number.isFinite(euro)&&euro>=1?depotMoney(euro):'Betrag noch festzulegen'):
      'Technische Verkaufszone · gesamter Testbestand';
    const signal=stock&&order.kind==='auto-test-buy'?unityAutoBuyEntry(stock,order.mode||'strict'):null;
    const status=!stock||stock.watchArchivedAt?'Aktie archiviert · Auftrag beenden':
      order.triggerQuoteDate?'Signal vom '+esc(order.triggerQuoteDate)+' · wartet auf späteren Tageskurs':
      order.kind==='auto-test-buy'&&!(euro>=1)?'Eurobetrag bitte auf mindestens 1 € setzen':
      order.kind==='auto-test-buy'&&budget.configured&&budget.remaining<
        (Number.isFinite(euro)?euro:0.01)?'Budgetrest reicht nicht aus · Budget oder Betrag ändern':
      order.kind==='auto-test-buy'&&signal?.ready?'Kriterium erreicht · auf neuen Tageskurs nach Aktivierung prüfen':
      order.kind==='auto-test-buy'?'Wartet auf berechnete Kaufbedingung':'Wartet auf Verkaufsbedingung';
    h+='<div class="home-auto-task"><div><strong>'+esc(stock?.name||order.instrumentId)+' · '+kind+'</strong>'+
      '<small>'+esc(label)+'</small><small>'+esc(status)+'</small></div>'+
      '<span class="actions">'+
      (kind==='Kauf'&&stock?'<button type="button" class="primary" data-home-auto-edit="'+esc(order.instrumentId)+'">Betrag ändern</button>':'')+
      '<button type="button" class="secondary" data-home-'+(kind==='Kauf'?'auto-buy':'auto-sell')+'="'+esc(order.instrumentId)+'">Auftrag stoppen</button></span></div>';
  }
  h+=typeof unityPaperCostsPanel==='function'?unityPaperCostsPanel():'';
  if(trades.length){
    const newest=[...trades].sort((a,b)=>String(b.executedAt||'').localeCompare(String(a.executedAt||''))).slice(0,3);
    h+='<details class="home-auto-history"><summary>Letzte automatische Testbuchungen ('+trades.length+')</summary>';
    for(const t of newest){
      const stock=(cache.instruments||[]).find(s=>s.id===t.instrumentId);
      h+='<p class="tiny">'+esc(String(t.executedAt||'').slice(0,10))+' · '+esc(stock?.name||t.instrumentId)+
        ' · '+(t.type==='BUY'?'Kauf':'Verkauf')+' · '+depotMoney((Number(t.amount)||0)*(Number(t.fx)||0)+(t.type==='BUY'?1:-1)*(Number(t.fee)||0))+
        (t.decisionSnapshot?.simulatedModel?' · Modellschlusskurs '+esc(t.decisionSnapshot.quoteDate||'')+
          ' · Gebühr '+depotMoney(Number(t.fee)||0):'')+'</p>';
    }
    h+='</details>';
  }
  return h+'</section>';
}
function unityZonePlanPanel(s){
  const signal=unityPullbackAlert(s),entry=unityCalculatedEntry(s),recommendation=unityAutoBuyRecommendation(s);
  const fmt=v=>Number.isFinite(Number(v))&&Number(v)>0?number(Number(v),2)+' '+s.currency:'–';
  let h='<section class="home-zone-plan home-auto-limit"><h3>Berechneter Einstiegspreis</h3>'+
    '<div class="home-limit-current"><small>Letzter Referenzkurs</small><strong>'+esc(fmt(signal.close))+'</strong></div>'+
    '<div class="home-recommendation home-recommendation-'+esc(recommendation.kind)+'"><b>'+esc(recommendation.title)+'</b><small>'+esc(recommendation.text)+'</small></div>';
  if(Number.isFinite(signal.low)&&Number.isFinite(signal.high)){
    h+='<div class="home-limit-range"><div><small>Technische Rücksetzerzone</small><strong>'+esc(fmt(signal.low))+' – '+esc(fmt(signal.high))+'</strong></div>'+
      '<div><small>UNITY-Kauflimit</small><strong>'+(entry.ready?'bis '+esc(fmt(entry.price)):'Noch nicht freigegeben')+'</strong></div></div>';
  }else h+='<p class="tiny muted">Eine technische Einstiegszone lässt sich mit den vorhandenen Daten noch nicht verlässlich berechnen.</p>';
  return h+'<p class="tiny muted">Eine technische Zone ist keine fundamentale Kaufempfehlung. Automatisierte Tests lassen sich unten unabhängig davon verwalten.</p></section>';
}
function unityAutoStockPanel(s){
  const buy=unityAutoBuy(s),sell=unityAutoSell(s),position=depotPosition(s);
  const entry=unityAutoBuyEntry(s,buy?.mode||'technical'),exit=unityAutoExitZone(s),signal=unityPullbackAlert(s);
  const buyEur=unityAutoEurAmount(buy);
  const status=buy?(unityAutoBuyModeLabel(buy.mode||'strict')+' · '+
    (Number.isFinite(buyEur)&&buyEur>=1?depotMoney(buyEur):'Betrag noch festzulegen')+' aktiv · '+
    (buy.triggerQuoteDate?'Signal '+buy.triggerQuoteDate+' gesichert · wartet auf späteren Tageskurs':
      buy.mode==='technical'?(signal.kind==='reached'?'Technische Zone erreicht · Signal wird gesichert':'Technische Zone wird beobachtet'):
    entry.ready?'UNITY-Kauflimit berechnet · auf bestätigtes Signal warten':'Strenge Freigabe noch offen')):'Kein automatischer Testkauf aktiv';
  const maySell=position.qty>0&&Number.isFinite(exit)&&exit>0;
  const fmt=n=>Number.isFinite(n)&&n>0?number(n,2)+' '+s.currency:'–';
  return '<section class="panel home-auto-stock" aria-label="Automatik für diese Aktie">'+
    '<h3>Automatik einstellen · nur Testdepot</h3>'+
    '<p class="tiny muted">Wähle einen festen Eurobetrag je Aktie und den technischen oder strengen UNITY-Testkauf. Bei aktivem Auftrag lässt sich der Betrag ohne Abbruch ändern. Das gemeinsame Budget ist in „Automatik · Testdepot“ einstellbar. Bereits ausgeführte Käufe bleiben unverändert.</p>'+
    '<div class="home-auto-task"><div><b>Automatischer Testkauf</b><small>'+esc(status)+'</small></div>'+unityAutoBuyControls(s,buy,buy?.mode||'technical')+'</div>'+
    '<div class="home-auto-task"><div><b>Automatischer Testverkauf</b><small>'+
      (sell?(sell.triggerQuoteDate?'Signal '+esc(sell.triggerQuoteDate)+' gesichert · wartet auf späteren Tageskurs':
        'Aktiv · Abbruch jederzeit möglich'):maySell?'Verkaufsgrenze: unter '+esc(fmt(exit)):'Erst bei Testbestand und gültigen technischen Kursdaten verfügbar')+
      '</small></div><button type="button" class="'+(sell?'secondary':'primary')+'" data-home-auto-sell="'+esc(s.id)+'" '+
      (sell||maySell?'':'disabled')+'>'+(sell?'Auftrag stoppen':'Auto-Testverkauf aktivieren')+'</button></div>'+
    '<p class="tiny muted">Prüfung nur mit gültigen Schlusskursen, frühestens ab dem nächsten Handelstag nach Aktivierung. Keine Echtzeitorder und keine garantierte Ausführung zum angezeigten Preis.</p></section>';
}
let unityAutoTestRunBusy=false;
/* Every confirmed trigger is recorded BEFORE any modeled fill. A signal on
   close D must never be booked at D's already observed price. Filled orders
   require a later independently observed EOD and a transaction-safe writer. */
async function unityRunAutoTestBuys(){
  if(unityAutoTestRunBusy||typeof cache==='undefined'||!Array.isArray(cache.settings)||
     typeof unityPaperAtomicFill!=='function'||typeof depotCapital!=='function')return;
  unityAutoTestRunBusy=true;
  try{
    for(const s of stocks()){
      const order=unityAutoBuy(s);if(!order)continue;
      const mode=order.mode||'strict',quote=unityHomeQuote(s);
      const fx=typeof unityEuroRate==='function'?unityEuroRate(s.currency):null;
      if(!unityPaperQuoteValid(s,quote,fx))continue;
      const date=String(quote.x.date||'');
      if(order.triggerQuoteDate){
        if(!(date>order.triggerQuoteDate))continue;
        // The next observed bar is an estimated market-on-close fill, NOT a
        // real fill or a look-ahead purchase at the triggering day's close.
        const current=typeof unityDecisionForStock==='function'?unityDecisionForStock(s,mode):null;
        if(!current||current.reasonCode==='missing-data'||current.reasonCode==='risk-veto'||
           current.reasonCode==='event-veto'||current.action==='BLOCKED')continue;
        const result=await unityPaperAtomicFill(order,s,'BUY',quote,fx,current);
        if(result.status==='limit-exceeded'){
          await unityPaperClearTrigger(order,result.reason);
          await refresh();
          continue;
        }
        if(result.status==='filled'){
          await refresh();
          if(typeof unityDecisionLedgerCapture==='function')try{
            await unityDecisionLedgerCapture(s,mode,current)
          }catch(e){console.warn('UNITY Decision Ledger:',e)}
        }
        continue;
      }
      const entry=unityAutoBuyEntry(s,mode);
      const approval=typeof unityDecisionForStock==='function'?unityDecisionForStock(s,mode):null;
      if(!entry.ready||approval?.action!=='BUY'||approval.testActionEligible!==true)continue;
      const signal=unityPullbackAlert(s);
      if(signal.kind!=='reached'||Number(signal.close)>entry.price||!signal.date||
         signal.date<=String(order.createdAt||'').slice(0,10))continue;
      const capital=depotCapital(),budget=unityAutoBudgetStatus(),euros=unityAutoEurAmount(order),
        fee=unityPaperPolicy().feeEur;
      if(!capital.configured||!budget.configured||!(euros>=1)||!(euros>fee)||
         !(capital.free>=euros&&budget.remaining>=euros))continue;
      const result=await unityPaperArmOrder(order,{quoteDate:signal.date,
        limit:entry.price,price:Number(signal.close)});
      if(result.status==='triggered')await refresh();
    }
    for(const s of stocks()){
      const order=unityAutoSell(s);if(!order)continue;
      const quote=unityHomeQuote(s),fx=typeof unityEuroRate==='function'?unityEuroRate(s.currency):null;
      if(!unityPaperQuoteValid(s,quote,fx))continue;
      const date=String(quote.x.date||'');
      if(order.triggerQuoteDate){
        if(!(date>order.triggerQuoteDate))continue;
        const current=typeof unityDecisionForStock==='function'?unityDecisionForStock(s,'technical'):null;
        if(!current||current.reasonCode==='missing-data'||current.action==='BLOCKED')continue;
        const result=await unityPaperAtomicFill(order,s,'SELL',quote,fx,current);
        if(result.status==='filled'){
          await refresh();
          if(typeof unityDecisionLedgerCapture==='function')try{
            await unityDecisionLedgerCapture(s,'technical',current)
          }catch(e){console.warn('UNITY Decision Ledger:',e)}
        }
        continue;
      }
      const exit=unityAutoExitZone(s),position=depotPosition(s);
      const approval=typeof unityDecisionForStock==='function'?unityDecisionForStock(s,'technical'):null;
      if(approval?.action!=='SELL'||approval.testActionEligible!==true||!(position.qty>0)||
         !(approval.reasonCode==='verified-exit'||(exit>0&&Number(quote.x.price)<=exit))||
         date<=String(order.createdAt||'').slice(0,10))continue;
      const result=await unityPaperArmOrder(order,{quoteDate:date,
        limit:exit||null,price:Number(quote.x.price)});
      if(result.status==='triggered')await refresh();
    }
  }finally{unityAutoTestRunBusy=false;}
}

function unityHomeVerdict(s){return unityResearchIndicator(s);}
function unityPreAnalysisSummary(selected){
  const items=selected.map(unityResearchIndicator),count=k=>items.filter(x=>x.kind===k).length;
  return '<section class="home-pre-summary" aria-label="Technischer Recherche-Indikator"><strong>Recherche-Indikator · technische Vorauswahl</strong>'+
    '<span class="pre-research">● '+count('research')+' Analyse sinnvoll</span>'+
    '<span class="pre-observe">● '+count('observe')+' Beobachten</span>'+
    '<span class="pre-weak">● '+count('weak')+' Derzeit nachrangig</span>'+
    '<span class="pre-data">● '+count('data')+' Daten prüfen</span>'+
    '<small>Die Einstufung basiert auf technischen Kursindikatoren. Bewertung, Bilanz, Branchenlage und Ereignisse sind damit noch nicht geprüft. Keine Kaufempfehlung. Aktie antippen für Begründung.</small></section>';
}
function unityPilotDecision(s){
  const state=unityHomeDataState(s),{m,technical}=unityHomeQuote(s);
  if(state.kind==='loading')return {kind:'loading',label:'Daten werden erfasst',detail:'Kursreihe wird geladen.'};
  if(state.kind==='failed')return {kind:'blocked',label:'Datenquelle prüfen',detail:state.detail||'Keine Kursreihe abrufbar.'};
  if(state.kind==='missing')return {kind:'blocked',label:'Kursquelle ergänzen',detail:'Für diesen Wert fehlt eine Kursquelle.'};
  if(!technical||!m)return {kind:'waiting',label:'Daten prüfen',detail:'Für eine technische Auswertung fehlen noch Kursdaten.'};
  const rsi=Number(m.rsi),index=Number(m.technicalIndex);
  const favorable=m.trend==='Aufwärtstrend'&&rsi>=38&&rsi<=67&&index>=55;
  if(favorable)return {kind:'interesting',label:'Technisch interessant',detail:'Trend und technische Kennzahlen sind positiv. Unternehmensprüfung und Risiko-/Bewertungscheck stehen noch aus.'};
  if(m.trend==='Abwärtstrend')return {kind:'watch',label:'Beobachten',detail:'Der technische Trend ist abwärts gerichtet; kein simulierter Einstieg.'};
  if(rsi>67)return {kind:'watch',label:'Beobachten',detail:'Technik ist bereits weit gelaufen; Rücksetzer oder Unternehmensprüfung abwarten.'};
  return {kind:'watch',label:'Beobachten',detail:'Technische Lage noch nicht ausreichend eindeutig.'};
}
function unityPilotDecisionSummary(){
  const decisions=unityPilotStocks().map(unityPilotDecision),count=k=>decisions.filter(d=>d.kind===k).length;
  return '<div class="home-decision-summary" aria-label="Entscheidungsstufe erste Analysegruppe"><strong>Entscheidungsstufe · erste 20</strong><span class="decision-interesting">● '+count('interesting')+' technisch interessant</span><span class="decision-watch">● '+count('watch')+' beobachten</span><span class="decision-open">● '+(count('waiting')+count('loading')+count('blocked'))+' Daten-/Quellenprüfung</span><small>Ein simulierter Kaufkandidat wird erst nach zusätzlicher Unternehmens-, Bewertungs- und Risiko-Prüfung freigegeben.</small></div>';
}
function unityHomeAnalysisStatus(selected){
  const states=selected.map(unityHomeDataState),count=k=>states.filter(x=>x.kind===k).length;
  const p=typeof unityDynamicProgress!=='undefined'?unityDynamicProgress:{total:0,done:0,ok:0,failed:0,active:''};
  const live=p.total?'Auslesen '+p.done+'/'+p.total+(p.active?' · '+p.active:''):'Bereit – alle beobachteten Werte prüfen';
  const busy=!!p.active;
  return '<section class="home-analysis-status" aria-live="polite"><strong>Analyse-Datenstatus · alle beobachteten Werte</strong><span class="home-analysis-live">'+esc(live)+'</span><small>'+selected.length+' Aktien · '+count('ready')+' technisch ausgewertet · '+count('loading')+' wird geladen · '+count('waiting')+' noch nicht geprüft · '+count('failed')+' Quelle nicht erreichbar · '+count('missing')+' ohne Kursquelle</small><button type="button" class="home-analysis-start" data-home-reload '+(busy?'disabled':'')+'>'+ (busy?'Analyse läuft …':'Alle Kursreihen prüfen')+'</button></section>';
}
function unityHomeMovement(x,range){
  const a=unityChartData(x,range);
  return a.length>=2?(Number(a.at(-1).close)/Number(a[0].close)-1)*100:NaN;
}
function unityHomeDisplayedChange(s,x,display,range){
  // A simple percentage change needs only two dated prices, not 200 days
  // of history, an RSI or a complete investment analysis.
  if(!x||typeof unityChartData!=='function')return NaN;
  const points=unityChartData(x,range);
  if(!Array.isArray(points)||points.length<2)return NaN;
  const latest=Number(display?.price??x.price);
  const prior=range==='1D'&&display?.precision==='15m-bar'&&String(display.date||'')>String(x.date||'')
    ? Number(x.price) : Number(points[0].close);
  return latest>0&&prior>0?(latest/prior-1)*100:NaN;
}
function unityHomeDecision(s){
  const {x,m,quality,technical,valid}=unityHomeQuote(s);
  if(!x||!m)return {action:'Nicht bewertbar',buy:'Nicht entscheidbar',sell:'Nicht entscheidbar',reason:'Für diese Aktie fehlen ausreichend belastbare Kursdaten.',technical:'Keine Daten',confidence:'Keine ausreichende Datenbasis'};
  const a=unityCalc(s),gaps=a.veto||[],candidate=typeof unityCandidate==='function'?unityCandidate(s):null;
  if(!valid){
    if(technical)return {action:'Technische Voranalyse',buy:candidate?.buy||'Technik prüfen',sell:'Keine operative Entscheidung',reason:(candidate?.reason||'Trend, gleitende Durchschnitte, RSI und MACD wurden aus der lokalen Kursreihe berechnet.')+' Die Kursquelle ist noch nicht unabhängig verifiziert; Fundamentaldaten und Ereignisdaten bleiben offen.',technical:m.trend,confidence:'Technische Voranalyse · keine vollständige UNITY-Freigabe',index:candidate?.score??m.technicalIndex,rsi:m.rsi,condition:candidate?.condition||'Weitere Datenprüfung erforderlich'};
    return {action:'Daten prüfen',buy:'Nicht freigegeben',sell:'Nicht entscheidbar',reason:'Der Kursstand ist nicht aktuell genug oder die Datenprüfung ist fehlgeschlagen.',technical:m.trend,confidence:'Datenqualität unzureich'};
  }if(candidate?.status==='candidate')return {action:candidate.action,buy:candidate.buy,sell:'Individuell prüfen',reason:candidate.reason,technical:m.trend,confidence:'Kandidatenmodus · vollständige operative Freigabe steht noch aus',index:candidate.score,gaps:gaps.slice(0,5),rsi:m.rsi,condition:candidate.condition};
  const positive=m.trend==='Aufwärtstrend';
  const negative=m.trend==='Abwärtstrend';
  const risk=m.rsi>=70?'Der RSI ist hoch; Rückschlagrisiko beachten.':m.rsi<35?'Der RSI ist niedrig; eine Bodenbildung ist nicht bestätigt.':'';
  const reason=(positive?'Der langfristige Kurstrend ist positiv. ':negative?'Der langfristige Kurstrend ist negativ. ':'Der langfristige Trend ist uneinheitlich. ')+risk+
    (gaps.length?' Für eine belastbare Kauf- oder Verkaufsentscheidung fehlen geprüfte Bewertung, Unternehmensdaten oder Ereignistermine.':'');
  return {action:positive?'Technisch positiv':negative?'Technisch schwach':'Technisch uneinheitlich',
    buy:'Noch nicht freigegeben',sell:'Individuell prüfen',reason,technical:m.trend,
    confidence:'Technischer Befund · keine vollständige UNITY-Freigabe',index:m.technicalIndex,
    gaps:gaps.slice(0,5),rsi:m.rsi};
}
/* Decision colours are NOT price colours. Only a fully verified UNITY verdict may
   turn a row green/red; delayed EOD technical trends never authorize a trade. */
function unityHomeSignal(s){
  const {x,m,valid,technical,quality}=unityHomeQuote(s);
  const state=unityHomeDataState(s);
  // Confirmed issuer-calendar dates are an event veto everywhere in the home
  // view, not only inside the deep analysis. A chart signal must not hide an
  // imminent earnings or guidance risk.
  let issuerEvent=null;
  try{issuerEvent=typeof unityIssuerDecisionEvidence==='function'?unityIssuerDecisionEvidence(s):null}catch(_){}
  const earningsDate=issuerEvent?.earnings?.confirmed?issuerEvent.earnings.date:'';
  const eventTime=Date.parse(earningsDate);
  if(Number.isFinite(eventTime)&&eventTime>=Date.now()-86400000&&eventTime<Date.now()+7*86400000)
    return {kind:'wait',label:'Earnings abwarten',icon:'!',detail:'Offiziell bestätigter Ergebnis-Termin am '+String(earningsDate).slice(0,10)+'. Neue Testkäufe bleiben bis danach gesperrt.',rank:0};
  if(!x||!m){
    if(state.kind==='loading')return {kind:'technical',label:'Kursreihe wird geladen',icon:'…',detail:'Sechs Jahre Tageskurse werden abgerufen und danach technisch ausgewertet.',rank:2};
    if(state.kind==='failed')return {kind:'warning',label:'Kursquelle nicht erreichbar',icon:'!',detail:state.detail||'Die externe Quelle hat keine Daten geliefert.',rank:3};
    if(state.kind==='missing')return {kind:'warning',label:'Kursquelle fehlt',icon:'!',detail:'Für diese Aktie ist noch keine kostenlose Kursquelle zugeordnet.',rank:3};
    return {kind:'warning',label:'Daten noch nicht geprüft',icon:'!',detail:'Mit „Kursdaten erneut prüfen“ wird die Kursreihe geladen.',rank:3};
  }
  const a=unityCalc(s),veto=a.veto||[],candidate=typeof unityCandidate==='function'?unityCandidate(s):null;
  if(!valid){
    if(technical)return {kind:'technical',label:candidate?.status==='candidate'?'Technik: '+candidate.buy:'Technische Voranalyse',icon:'≈',detail:(candidate?.reason||'Trend, SMA50/SMA200, RSI und MACD wurden berechnet.')+' Quelle und Fundamentaldaten sind noch nicht vollständig geprüft.',rank:2};
    return {kind:'warning',label:'Daten prüfen',icon:'!',detail:quality?.detail||'Kursdaten nicht aktuell oder unplausibel.',rank:3};
  }
  if(candidate?.status==='candidate')return {kind:'buy',label:candidate.buy,icon:'+',detail:candidate.reason+' '+candidate.condition,rank:0};
  if(veto.length)return {kind:'warning',label:'Analyse offen',icon:'!',detail:'Technik: '+m.trend+'. '+veto.length+' Prüfbedingungen für eine Handelsentscheidung noch offen.',rank:3};
  // Future fully sourced evaluation can explicitly emit these actions after all vetoes clear.
  const action=String(a.action||'').trim();
  if(action==='Kaufen – freigegeben')return {kind:'buy',label:'Kaufen prüfen',icon:'+',detail:'Alle verbindlichen UNITY-Datenprüfungen bestanden.',rank:0};
  if(action==='Verkaufen – freigegeben')return {kind:'sell',label:'Verkauf prüfen',icon:'−',detail:'Verkaufssignal nach vollständiger UNITY-Prüfung.',rank:1};
  if(action==='Halten – freigegeben')return {kind:'hold',label:'Halten',icon:'=',detail:'Bestand nach vollständiger UNITY-Prüfung halten.',rank:2};
  return {kind:'wait',label:'Abwarten',icon:'·',detail:'Keine bestätigte Kauf- oder Verkaufsfreigabe.',rank:4};
}
function unityHomeActionSortMatch(s,mode){
  // Keep the watchlist lightweight: calculate only the condition requested.
  const entry=unityPullbackAlert(s).kind==='reached'&&unityHomeSignal(s).kind!=='wait';
  if(mode==='entry')return entry;
  if(mode==='sell')return unityHomeSignal(s).kind==='sell';
  if(mode==='observe')return !entry&&unityHomeSignal(s).kind!=='sell';
  return false;
}
function unityHomeDisplayedStocks(){
  const list=unityHomeStocks();
  if(unityHomeSort==='manual')return list;
  // The manual order is retained inside every group.  Sorting only brings the
  // requested existing UNITY action/status to the front; it never writes a new
  // order and never invents a second buy/sell model.
  return list.map((s,index)=>({s,index,match:unityHomeActionSortMatch(s,unityHomeSort)}))
    .sort((a,b)=>Number(b.match)-Number(a.match)||a.index-b.index).map(row=>row.s);
}

function unityHome(){
  unityHomeRestoreSort();
  const selected=unityHomeDisplayedStocks(),pos=typeof depotPositions==='function'?depotPositions():[],capital=typeof depotCapital==='function'?depotCapital():null;
  const allValid=pos.length>0&&pos.every(p=>Number.isFinite(p.value));
  const value=allValid?pos.reduce((n,p)=>n+p.value,0):NaN;
  const gainClass=Number.isFinite(capital?.gain)?(capital.gain>0?'home-profit-up':capital.gain<0?'home-profit-down':'home-profit-flat'):'home-profit-flat';
  const nUp=selected.filter(s=>unityHomeQuote(s).valid&&unityHomeQuote(s).m.trend==='Aufwärtstrend').length;
  const nDown=selected.filter(s=>unityHomeQuote(s).valid&&unityHomeQuote(s).m.trend==='Abwärtstrend').length;
  let h='<section class="home-hero" id="unity-home"><div class="home-hero-title"><span class="home-hero-mark" aria-hidden="true">↗</span><div><h2>Mein Depot</h2><small>UNITY Lab · persönliche Aktienübersicht</small></div><button type="button" class="home-hero-menu" data-home-add title="Aktien auswählen">＋</button></div>'+
    '<div class="home-periods" aria-label="Kurszeitraum">'+unityHomePeriods.map(([r,label])=>'<button type="button" data-home-range="'+r+'" class="'+(r===unityHomeRange?'active':'')+'">'+label+'</button>').join('')+'</div>';
  if(capital?.configured){
    const complete=Number.isFinite(capital.total),shownTotal=complete?capital.total:capital.displayTotal;
    h+='<p class="home-wealth-kicker">'+(complete?'Gesamtvermögen · Testdepot':'Gesamtvermögen vorläufig · Testdepot')+'</p>'+
      '<div class="home-big-number" aria-label="'+(complete?'Fiktives Gesamtvermögen':'Vorläufiges fiktives Gesamtvermögen')+'">'+depotMoney(shownTotal)+'</div>'+
      '<p class="home-value-label">'+(complete?(capital.indicative?'Indikativer Depotstand · nicht börslich verifizierte Kurse':'Freies Kapital + aktueller Depotwert · Simulation'):'Vorläufiger Gesamtwert · fehlende Kurse zum Einstand bewertet')+'</p>';
    if(complete){
      h+='<div class="home-wealth-profit '+gainClass+'"><b>Gewinn / Verlust gesamt: '+depotSignedMoney(capital.gain)+'</b>'+
        '<span>'+depotSignedPct(capital.gainPct)+' auf Nettoeinzahlungen</span></div>';
    }else{
      h+='<p class="home-wealth-warning">Für '+capital.missingCount+' gekaufte Position'+(capital.missingCount===1?'':'en')+
        ' ('+esc(capital.missingNames.join(', '))+') fehlen verwendbare aktuelle Kursdaten oder EUR-Wechselkurse. <b>Der oben gezeigte Gesamtwert ist vorläufig.</b> Für nicht bewertbare Positionen wird nur ihr erfasster Einstand angesetzt. Ein aktueller Marktwert oder eine belastbare Gesamtrendite ist so nicht bestimmbar.</p>';
    }
    h+='<div class="home-wealth-grid">'+
      '<div><small>Einzahlungen netto</small><b>'+depotMoney(capital.funded)+'</b></div>'+
      '<div><small>Frei verfügbar</small><b>'+depotMoney(capital.free)+'</b></div>'+
      '<div><small>Depotwert '+(complete?'aktuell':'vorläufig')+'</small><b>'+depotMoney(complete?capital.market:capital.displayMarket)+'</b></div>'+
      '<div><small>Einstand offener Aktien</small><b>'+depotMoney(capital.invested)+'</b></div>'+
      '<div><small>Buchgewinn / -verlust</small><b class="'+((complete?capital.unrealized:capital.displayUnrealized)>0?'home-profit-up':(complete?capital.unrealized:capital.displayUnrealized)<0?'home-profit-down':'')+'">'+depotSignedMoney(complete?capital.unrealized:capital.displayUnrealized)+'</b></div>'+
      '<div><small>Realisierter Gewinn / Verlust</small><b class="'+(capital.realized>0?'home-profit-up':capital.realized<0?'home-profit-down':'')+'">'+depotSignedMoney(capital.realized)+'</b></div>'+
      '</div>';
  }else if(pos.length&&allValid){
    h+='<div class="home-big-number">'+euro(value)+'</div><p class="home-value-label">Simulierter Positionswert · Startkapital noch nicht festgelegt</p>';
  }else h+='<p class="home-value-label home-value-prompt">Beobachtungsliste · Testdepot kann bei Bedarf angelegt werden</p>';
  const pullbackResults=selected.map(s=>({s,signal:unityPullbackAlert(s)}));
  const reachedPullbacks=pullbackResults.filter(x=>x.signal.kind==='reached');
  const blockedPullbacks=pullbackResults.filter(x=>x.signal.kind==='blocked');
  const pilotCount=selected.filter(s=>typeof unityDisplayQuote==='function'&&unityDisplayQuote(s)?.precision==='15m-bar').length;
  h+='<div class="home-hero-summary"><span>↗ '+nUp+' Aufwärtstrend</span><span>↘ '+nDown+' Abwärtstrend</span><span>'+selected.length+' beobachtet</span></div>'+
    '<p class="home-feed-note">'+(pilotCount?'Pilot: '+pilotCount+' zeitgestempelte 15-Minuten-Kursbalken · ':'')+'Automatische Tageskurse · <b>keine garantierten Echtzeitkurse</b> · Datenabruf '+esc(unityMarket?.generatedAt?.slice(0,16).replace('T',' ')||'noch nicht geladen')+'</p><details class="home-status-fold"><summary>Kursdaten & Analysefortschritt anzeigen</summary>'+unityHomeAnalysisStatus(selected)+'</details>'+
    (capital?'<details class="home-capital-fold"><summary>'+(capital.configured?'Startkapital ändern':'Startkapital festlegen')+'</summary><form class="home-capital-entry" id="home-capital-form"><label for="home-capital-input">Fiktives Grundkapital in EUR<input id="home-capital-input" name="capital" type="number" min="0" step="0.01" inputmode="decimal" placeholder="z. B. 10.000" value="'+(capital.configured?String(Number(capital.opening).toFixed(2)):'')+'"></label><button type="submit">Speichern</button></form><small>Ändert nur das fiktive Startkapital, nicht deine bisherigen Käufe und Verkäufe.</small></details>':'')+'</section>';
  h+=unityAutoOrdersSummary();
  if(typeof unityReadinessOverview==='function')h+=unityReadinessOverview(typeof stocks==='function'?stocks():selected);
  if(typeof unityResearchLifecyclePanel==='function')h+=unityResearchLifecyclePanel();
  if(pos.length){
    h+='<section class="home-holdings" aria-label="Gekaufte Aktien im Testdepot"><div class="home-holdings-head"><h2>Gekaufte Aktien <span>'+pos.length+'</span></h2><small>Deine simulierten Positionen · Gewinn/Verlust seit Kauf</small></div>';
    for(const p of pos){
      const valid=Number.isFinite(p.value)&&Number.isFinite(p.pnl);
      const cl=valid?(p.pnl>0?'home-profit-up':p.pnl<0?'home-profit-down':'home-profit-flat'):'home-profit-flat';
      const pct=valid&&p.cost>0?p.pnl/p.cost*100:NaN;
      const unit=p.market?.price>0?number(p.market.price,2)+' '+esc(p.s.currency):'Kurs fehlt';
      const monitor=typeof unityPositionMonitor==='function'?unityPositionMonitor(p.s):null;
      const monitorText=monitor?'<span class="home-position-monitor home-position-'+esc(monitor.kind)+'">'+esc(monitor.label)+'</span>':'';
      h+='<div class="home-holding-entry"><button type="button" class="home-holding-card" data-home-open="'+esc(p.s.id)+'" aria-label="'+esc(p.s.name)+': Depotposition und Analyse ansehen">'+
        '<span class="home-holding-top"><strong>'+esc(p.s.name)+unityAutoStockBadge(p.s)+monitorText+'</strong><b class="'+cl+'">'+(valid?depotSignedMoney(p.pnl):'Bewertung offen')+'</b></span>'+
        '<span class="home-holding-sub"><span>'+number(p.qty,4)+' Stk · Ø Einstand '+(Number.isFinite(p.avg)?depotMoney(p.avg):'–')+'</span>'+
        '<b class="'+cl+'">'+(valid?depotSignedPct(pct):'–')+'</b></span>'+
        '<span class="home-holding-sub"><span>Kurs: '+unit+'</span><span>Wert: <b>'+depotMoney(p.value)+'</b></span></span>'+
        '<span class="home-holding-stamp">'+(p.market?'Kurs '+esc(p.market.date)+(p.market.indicative?' · indikativ':''):'Kurs-/FX-Prüfung offen')+' · Zur Analyse ›</span>'+
        '</button><button type="button" class="home-position-reset" data-home-reset-position="'+esc(p.s.id)+'">Diese Position auf null setzen</button></div>';
    }
    h+='<p class="home-holdings-note">Positionsgewinne berücksichtigen die erfassten Kaufgebühren und werden in EUR bewertet. Gesamtvermögen und Depotwerte sind Simulationen.</p><section class="home-depot-reset"><h3>Testdepot verwalten</h3><p>Ein Reset betrifft nur den aktiven Testlauf. Aktienauswahl, Kurse, Analysen und frühere Testbuchungen bleiben erhalten.</p><button type="button" class="home-depot-reset-all" data-home-reset-all>Aktives Simulationsdepot auf null setzen</button></section></section>';
  }

    if(reachedPullbacks.length||blockedPullbacks.length){
    h+='<section class="home-pullback-summary" aria-label="Rücksetzerbeobachtung">'+
      '<strong>◆ Rücksetzer-Radar · '+reachedPullbacks.length+' technische Einstiegszone'+(reachedPullbacks.length===1?'':'n')+' erreicht</strong>'+
      (blockedPullbacks.length?'<small>'+blockedPullbacks.length+' weitere Zone'+(blockedPullbacks.length===1?'':'n')+' mit aktivem Risikohinweis.</small>':'')+
      '<small>Zuletzt verfügbare Tages-Schlusskurse, keine Echtzeit-Meldung und keine Kaufempfehlung. Betroffene Aktie antippen und Tiefenanalyse neu prüfen.</small></section>';
  }
h+='<section class="home-list"><div class="home-list-head"><h2>Meine Aktien</h2><button type="button" class="secondary" data-home-add>＋ Aktie hinzufügen</button></div>'+
    '<div class="home-sort-controls"><button type="button" data-home-sort="manual" class="'+(unityHomeSort==='manual'?'active':'')+'">Eigene Reihenfolge</button><button type="button" data-home-sort="entry" class="'+(unityHomeSort==='entry'?'active':'')+'">Einstieg</button><button type="button" data-home-sort="observe" class="'+(unityHomeSort==='observe'?'active':'')+'">Beobachten</button><button type="button" data-home-sort="sell" class="'+(unityHomeSort==='sell'?'active':'')+'">Verkauf prüfen</button></div>'+
    '<p class="home-sort-hint">'+(unityHomeSort==='manual'?'Mit ☰ ziehen oder ↑ ↓ verschieben. Deine Reihenfolge wird beim nächsten Öffnen wiederhergestellt.':'Einstieg, Beobachten oder Verkauf prüfen stehen vorn. Für dauerhaft eigene Anordnung „Eigene Reihenfolge“ wählen.')+'</p>';
  if(!selected.length)h+='<div class="home-empty"><p>Du hast noch keine Aktien ausgewählt. Wähle deine Werte aus dem vorhandenen UNITY-Katalog. Die App zeigt sie danach automatisch beim Öffnen an.</p><button type="button" class="primary" data-home-add>Aktien auswählen</button></div>';
  for(const [i,s] of selected.entries()){
    const {x}=unityHomeQuote(s);
    const dq=typeof unityDisplayQuote==='function'?unityDisplayQuote(s):null;
    const quoteItem=dq||(x&&Number(x.price)>0?{price:x.price,date:x.date,precision:'day'}:null);
    const price=Number(quoteItem?.price);
    const change=unityHomeDisplayedChange(s,x,dq,unityHomeRange);
    const rising=Number.isFinite(change)&&change>0,falling=Number.isFinite(change)&&change<0;
    const cls=rising?'home-up':falling?'home-down':'home-flat';
    const rate=typeof unityEuroRate==='function'?unityEuroRate(s.currency):null;
    const eur=s.currency!=='EUR'&&rate&&Number(rate.rate)>0&&price>0?price*Number(rate.rate):NaN;
    const position=depotPosition(s),research=unityResearchIndicator(s),pullback=unityPullbackAlert(s),issuerBadge=typeof unityResearchBadge==='function'?unityResearchBadge(s):'';
    const stamp=dq?.precision==='15m-bar'&&dq.quotedAt
      ?'15m-Referenz · '+new Date(dq.quotedAt).toLocaleString('de-DE',{timeZone:'Europe/Berlin',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})
      :quoteItem?.date?String(quoteItem.date)+' · Schluss':'Keine Kursdaten';
    h+='<div class="home-stock-item" data-home-row="'+esc(s.id)+'"><div class="home-reorder-tools"><button type="button" class="home-drag-handle" data-home-drag="'+esc(s.id)+'" title="Aktie ziehen" aria-label="'+esc(s.name)+' durch Ziehen verschieben">☰</button><button type="button" class="home-shift-btn" data-home-shift="'+esc(s.id)+'" data-direction="-1" '+(i===0?'disabled':'')+' aria-label="'+esc(s.name)+' nach oben verschieben">↑</button><button type="button" class="home-shift-btn" data-home-shift="'+esc(s.id)+'" data-direction="1" '+(i===selected.length-1?'disabled':'')+' aria-label="'+esc(s.name)+' nach unten verschieben">↓</button><button type="button" class="home-remove-btn" data-watch-remove="'+esc(s.id)+'" title="Aus Liste entfernen" aria-label="'+esc(s.name)+' aus aktiver Aktienliste entfernen">×</button></div>'+
      '<button type="button" class="home-stock-row" data-home-open="'+esc(s.id)+'" aria-label="'+esc(s.name)+': Kurs und Analyse öffnen"><span class="home-trend-icon '+cls+'" aria-hidden="true">'+(rising?'↗':falling?'↘':'–')+'</span>'+
      '<span class="home-stock-main"><strong>'+esc(s.name)+'</strong>'+issuerBadge+unityAutoStockBadge(s)+unityPullbackLabel(s,pullback)+'<span class="home-research-flag home-research-'+research.kind+'">'+esc(research.label)+'</span><small>'+esc(s.ticker)+' · '+esc(s.exchange)+'</small>'+(position.qty>0?'<small class="home-position-label">● Im Testdepot · '+number(position.qty,4)+' Stück</small><small class="home-position-profit '+(position.pnl>0?'home-profit-up':position.pnl<0?'home-profit-down':'')+'">Depotwert '+depotMoney(position.value)+' · '+depotSignedMoney(position.pnl)+'</small>':'')+'</span>'+
      '<span class="home-stock-right"><strong class="'+cls+'">'+unityPct(change)+'</strong><small class="home-quote-price">'+(price>0?number(price,2)+' '+esc(s.currency):'Kurs fehlt')+'</small>'+
      (s.currency!=='EUR'?'<small class="home-eur-price">'+(Number.isFinite(eur)?'≈ '+euro(eur):'EUR-Kurs fehlt')+'</small>':'')+
      '<small class="home-quote-date">'+esc(stamp)+'</small></span><span class="home-chevron" aria-hidden="true">›</span></button></div>';
  }
  h+='</section>';
  h+=unityPreAnalysisSummary(selected);
  if(unityHomeSelected)h+=unityHomeDetail(unityHomeSelected);
  h+='<section class="home-bottom-actions"><button type="button" class="secondary" data-home-reload '+(unityMarketLoading?'disabled':'')+'>'+(unityMarketLoading?'Kursdaten werden geladen …':'Kursdaten erneut prüfen')+'</button><button type="button" class="secondary" data-home-all>Alle UNITY-Kandidaten vergleichen</button><button type="button" class="secondary" data-home-trades>Käufe / Verkäufe</button></section>';
  h+='<p class="home-disclaimer">Die Pfeile und Prozentwerte zeigen die Kursänderung im gewählten Zeitraum, nicht den persönlichen Depotgewinn. Die Trendbewertung nutzt gleitende Durchschnitte. Die App gibt ohne geprüfte Fundamentaldaten, Earnings und aktuelle Handelskurse keine Kauf- oder Verkaufsfreigabe.</p>';
  return h;
}
function unityHomeDetail(sid){
  const s=stocks().find(x=>x.id===sid);
  if(!s)return '';
  const {x,m,valid}=unityHomeQuote(s),d=unityHomeDecision(s),signal=unityHomeSignal(s),research=unityResearchIndicator(s),pullback=unityPullbackAlert(s);
  const isCrypto=typeof unityIsCryptoAsset==='function'&&unityIsCryptoAsset(s);
  let h='<section class="home-detail" id="home-stock-detail"><div class="home-detail-title"><div><small>'+(isCrypto?'Kryptoanalyse':'Aktienansicht')+'</small><h2>'+esc(s.name)+'</h2><p>'+esc(s.ticker)+' · '+esc(s.exchange)+' · '+esc(s.currency)+'</p></div><button type="button" class="secondary" data-home-close>Schließen</button></div>';
  const dq=typeof unityDisplayQuote==='function'?unityDisplayQuote(s):null;
  if(isCrypto){
    if(typeof unityCryptoAnalysisPanel==='function')h+=unityCryptoAnalysisPanel(s);
    if(x)h+=unityChartPanel(x);else h+='<p class="home-missing">Kein überprüfbarer Krypto-Kursverlauf vorhanden. Es wird keine Kurve und keine technische Zone erfunden.</p>';
    if(dq)h+='<p class="home-price-time">'+esc(dq.label)+': <b>'+number(dq.price,6)+' '+esc(s.currency)+'</b> · '+(dq.quotedAt?esc(new Date(dq.quotedAt).toLocaleString('de-DE',{timeZone:'Europe/Berlin'}))+' MEZ/MESZ':esc(dq.date))+' · '+esc(dq.exchange)+'</p>';
    h+='<p class="tiny muted">Krypto handelt rund um die Uhr. Der aktuelle Kurs ist nur eine Referenz, solange Quelle und Zeitstempel nicht als belastbare Krypto-Marktdaten bestätigt sind.</p>';
    h+=unityHomeTradeActions(s);return h+'</section>';
  }
  if(['reached','blocked','watch'].includes(pullback.kind)){
    h+='<section class="home-pullback-detail home-pullback-'+pullback.kind+'"><strong>'+esc(pullback.label)+'</strong>'+
      '<p>'+esc(pullback.detail)+'</p>'+
      '<small>Technische SMA50-Zone: '+number(pullback.low,2)+'–'+number(pullback.high,2)+' '+esc(s.currency)+
      ' · Schlusskurs '+number(pullback.close,2)+' '+esc(s.currency)+' ('+esc(pullback.date)+')</small></section>';
  }
  h+='<section class="home-research-detail home-research-'+research.kind+'"><strong>Recherche-Indikator: '+esc(research.label)+'</strong><p>'+esc(research.detail)+'</p><small>Technische Vorauswahl, keine Kauf- oder Verkaufsfreigabe.</small></section>';
  if(typeof unityDecisionReadinessPanel==='function')h+=unityDecisionReadinessPanel(s);
  if(typeof unityDecisionPanel==='function')h+=unityDecisionPanel(s);
  if(typeof unityReadinessDetail==='function')h+=unityReadinessDetail(s);
  if(typeof unityForesightPanel==='function')h+=unityForesightPanel(s);
  h+=unityZonePlanPanel(s);
  h+=unityAutoStockPanel(s);
  if(typeof unityPositionMonitorPanel==='function')h+=unityPositionMonitorPanel(s);
  if(typeof unityDeepDecisionPanel==='function')h+='<details class="unity-secondary-check"><summary>Vertiefte UNITY-Bewertung und Kennzahlen</summary>'+unityDeepDecisionPanel(s)+'</details>';
  if(typeof unityDecisionResultPanel==='function')h+='<details class="unity-secondary-check"><summary>Weitere technische Prüfbedingungen anzeigen</summary>'+unityDecisionResultPanel(s)+'</details>';
  if(x)h+=unityChartPanel(x);
  else h+='<p class="home-missing">'+(s.providerSymbol?(typeof unityDynamicErrors!=='undefined'&&unityDynamicErrors.get(s.providerSymbol.toUpperCase())?'Kursquelle derzeit nicht erreichbar: '+esc(unityDynamicErrors.get(s.providerSymbol.toUpperCase())):'Internationale Kursreihe wird geladen, sofern die externe Quelle erreichbar ist.'):'Kein überprüfbarer Tageskursverlauf vorhanden. Es wird keine Kurve erfunden.')+'</p>';
  if(dq)h+='<p class="home-price-time">'+esc(dq.label)+': <b>'+number(dq.price,2)+' '+esc(s.currency)+'</b> · '+(dq.quotedAt?esc(new Date(dq.quotedAt).toLocaleString('de-DE',{timeZone:'Europe/Berlin'}))+' MEZ/MESZ':esc(dq.date))+' · '+esc(dq.exchange)+'</p>';
  if(s.providerSymbol)h+='<p class="tiny muted">Weltweiter Kursabruf: inoffizielle Yahoo-Daten über cors.dev, nicht börslich geprüft. Keine Handelsfreigabe; Suchanfrage und Symbol werden an externe Dienste übertragen.</p>';
  if(s.note)h+='<p><b>Unternehmensbereich:</b> '+esc(s.note)+'</p>';
  if(typeof unityMarketContextPanel==='function')h+=unityMarketContextPanel(s);
  h+=unityHomeSecurityDetails(s,x);
  if(typeof unityFundPilotPanel==='function')h+=unityFundPilotPanel(s);
  if(typeof unityResearchPanel==='function')h+=unityResearchPanel(s);
  h+=unityHomeTradeActions(s);
  h+='<div class="home-decision home-decision-'+signal.kind+'"><div class="home-decision-head"><span>UNITY-Entscheidung: <b class="home-signal home-signal-'+signal.kind+'">'+signal.icon+' '+esc(signal.label)+'</b></span><strong>'+esc(d.action)+'</strong></div><p class="home-signal-reason">'+esc(signal.detail)+'</p>'+
    '<div class="home-decision-grid"><div><small>Kauf</small><b>'+esc(d.buy)+'</b></div><div><small>Verkauf</small><b>'+esc(d.sell)+'</b></div><div><small>Technischer Trend</small><b>'+esc(d.technical)+'</b></div><div><small>Technikindex</small><b>'+(valid&&Number.isFinite(d.index)?d.index+'/100':'–')+'</b></div></div>'+
    '<p><b>Begründung:</b> '+esc(d.reason)+'</p><p class="tiny muted">'+esc(d.confidence)+'</p></div>'+
    '<button type="button" class="home-analyze-btn" data-home-analyze="'+esc(s.id)+'">Vollständige UNITY-Analyse & Datenlage ansehen <span aria-hidden="true">›</span></button>'+
    (typeof unityNewsPanel==='function'?unityNewsPanel(s):'')+
    '<p><a href="https://news.google.com/search?q='+encodeURIComponent(s.name+' Aktie')+'&amp;hl=de&amp;gl=DE&amp;ceid=DE%3Ade" target="_blank" rel="noopener noreferrer">Aktuelle Meldungen zu '+esc(s.name)+' extern ansehen</a></p>'+
    '<p class="tiny muted">Externe Nachrichten sind noch nicht automatisch auf Relevanz und Auswirkungen auf die UNITY-Entscheidung geprüft.</p>'+
    '<p class="tiny muted">Die Analyse berechnet vorhandene Kennzahlen automatisch. Fehlende Bilanz-, Bewertungs- und Ereignisdaten werden als offene Prüfpunkte angezeigt, nicht geschätzt.</p></section>';
  return h;
}


function unityHomeSecurityDetails(s,x){
  const p=depotPosition(s),dq=typeof unityDisplayQuote==='function'?unityDisplayQuote(s):null,rows=[
    ['Kursdaten',dq?number(Number(dq.price),2)+' '+s.currency:'Nicht verfügbar',dq?.precision==='15m-bar'?'Inoffizieller 15-Minuten-Kursbalken, kein Echtzeitversprechen':'Letzter verfügbarer Börsenschlusskurs'],
    ['Kursdatum',dq?.quotedAt?new Date(dq.quotedAt).toLocaleString('de-DE',{timeZone:'Europe/Berlin'}):dq?.date||'–','Beobachtungszeitpunkt, nicht Downloadzeitpunkt'],
    ['Börsenplatz',dq?.exchange||s.exchange,'Referenzmarkt'],
    ['ISIN',s.isin||'–','Wertpapierkennung'],
    ['Bestand',number(p.qty,4)+' Stück','Nur simulierte Transaktionen'],
    ['Einstand',p.qty>0?depotMoney(p.cost):'–','Simulierter Kaufwert offener Positionen'],
    ['Offener Erfolg',Number.isFinite(p.pnl)?depotMoney(p.pnl):'–','Marktwert abzüglich Einstand, sofern Kurs und EUR-FX verfügbar']
  ];
  let h='<section class="home-security-data"><h3>Wertpapierdetails & Testdepot</h3>';
  for(const [key,value,help] of rows)h+='<div class="home-data-line"><div><b>'+esc(value)+'</b><small>'+esc(help)+'</small></div><span>'+esc(key)+'</span></div>';
  h+='<p class="tiny muted">BID/ASK werden ohne verifizierte Geld-/Briefkurse bewusst nicht angezeigt.</p></section>';
  if(p.buys||p.sells)h+='<section class="home-trade-history"><h3>Simulierte Käufe und Verkäufe</h3>'+depotTradeHistory(s.id)+'</section>';
  return h;
}
function unityHomeTradeActions(s){
  const p=depotPosition(s),eod=typeof unityMarketForStock==='function'?unityMarketForStock(s):unityMarketItem(s.isin),display=typeof unityDisplayQuote==='function'?unityDisplayQuote(s):null,market=display&&Number(display.price)>0?display:eod,mode=unityHomeTradeMode,rate=typeof unityEuroRate==='function'?unityEuroRate(s.currency):null;
  let h='<div class="home-trade-actions"><button type="button" class="home-buy-button" data-home-trade="BUY">＋ Kaufen · Simulation</button><button type="button" class="home-sell-button" data-home-trade="SELL" '+(p.qty>0?'':'disabled')+'>− Verkaufen · Simulation</button></div>';
  if(!p.qty)h+='<p class="tiny muted">Für einen Testverkauf zunächst eine simulierte Position kaufen.</p>';
  if(mode!=='BUY'&&mode!=='SELL')return h;
  const sell=mode==='SELL',initialPrice=Number(market?.price),initialFx=Number(rate?.rate)||(s.currency==='EUR'?1:NaN);
  h+='<form class="home-trade-form" id="home-trade-form"><h3>'+(sell?'Testverkauf':'Testkauf')+' · '+esc(s.name)+'</h3><p class="tiny muted">Nur Simulation, kein echter Börsenauftrag. Du kannst den vorgeschlagenen Kurs und Wechselkurs jederzeit überschreiben. Eine offene Tiefenanalyse blockiert diese Testbuchung nicht.</p><input type="hidden" name="instrumentId" value="'+esc(s.id)+'"><input type="hidden" name="type" value="'+mode+'">'+
    '<label>Stückzahl<input type="number" name="quantity" step="any" min="0.000001" '+(sell?'max="'+String(Number(p.qty.toFixed(6)))+'"':'')+' required placeholder="'+(sell?'Maximal '+number(p.qty,4):'z. B. 5')+'"></label>'+
    '<label>Gebühr in EUR<input type="number" name="fee" step="0.01" min="0" value="1.00" required><small>Standard: 1,00 € je Simulation.</small></label>'+
    '<label>Simulierter Kurs in '+esc(s.currency)+'<input type="number" name="price" step="any" min="0.000001" required value="'+(Number.isFinite(initialPrice)?String(initialPrice):'')+'" placeholder="Kurs eingeben"><small>'+(market?'Vorschlag: '+esc(market.source||'Tageskurs')+' · '+esc(market.date||''): 'Kein Kurs vorhanden – bitte selbst einen Testkurs eingeben.')+'</small></label>'+
    '<label>EUR je 1 '+esc(s.currency)+'<input type="number" name="fx" step="any" min="0.000001" required value="'+(Number.isFinite(initialFx)?String(initialFx):'')+'" placeholder="'+(s.currency==='EUR'?'1':'Wechselkurs eingeben')+'"><small>'+(rate?'Vorschlag: '+esc(rate.source||'Referenzkurs')+' · '+esc(rate.date||''):'Kein automatischer Wechselkurs vorhanden – bitte Testwert eingeben.')+'</small></label>'+
    '<div class="home-trade-total full" id="home-trade-estimate" aria-live="polite">Voraussichtlicher Testbetrag: –</div><label class="full">Notiz (optional)<textarea name="note" maxlength="1000" placeholder="Eigene Beobachtung oder Grund der Simulation"></textarea></label><div class="full home-trade-confirm"><button class="primary" type="submit">'+(sell?'Testverkauf speichern':'Testkauf speichern')+'</button><button type="button" class="secondary" data-home-trade-cancel>Abbrechen</button></div></form>';
  return h;
}
function unityHomeUpdateTradeEstimate(form){
  const el=form.querySelector('#home-trade-estimate');if(!el)return;
  const n=Number(form.elements.quantity?.value),fee=Number(form.elements.fee?.value)||0,price=Number(form.elements.price?.value),fx=Number(form.elements.fx?.value),amount=n*price*fx;
  if(!(fee>=0&&Number.isFinite(fee)))return el.textContent='Gebühr prüfen';
  const net=amount+(form.elements.type?.value==='SELL'?-fee:fee);
  el.textContent=n>0&&price>0&&fx>0?'Voraussichtlicher '+(form.elements.type?.value==='SELL'?'Nettoerlös':'Gesamtaufwand')+': '+euro(net)+' · Gebühr '+euro(fee)+' · Spread nicht enthalten':'Bitte Stückzahl, Kurs und EUR-Wechselkurs eingeben.';
}
async function unityHomeSaveTrade(data){
  const s=stocks().find(x=>x.id===data.instrumentId);if(!s)throw Error('Aktie nicht gefunden.');
  const type=data.type;if(type!=='BUY'&&type!=='SELL')throw Error('Ungültige Buchungsart.');
  const quantity=Number(data.quantity),fee=Number(data.fee??1),price=Number(data.price),fx=Number(data.fx),at=new Date();
  if(!(quantity>0&&Number.isFinite(quantity)))throw Error('Bitte eine gültige Stückzahl eingeben.');
  if(!(price>0&&Number.isFinite(price)))throw Error('Bitte einen gültigen simulierten Kurs eingeben.');
  if(!(fx>0&&Number.isFinite(fx)))throw Error('Bitte einen gültigen EUR-Wechselkurs eingeben.');
  if(!(fee>=0&&Number.isFinite(fee)&&fee<=100000))throw Error('Bitte eine gültige Gebühr in EUR eingeben.');
  if(type==='BUY'&&typeof depotCapital==='function'){const capital=depotCapital(),needed=quantity*price*fx+fee;if(capital.configured&&needed>capital.free+1e-8)throw Error('Nicht genug fiktives Kapital. Verfügbar: '+euro(capital.free)+' · benötigt inklusive Gebühr: '+euro(needed));}
  if(type==='SELL'){const available=depotLedger(s.id,at.toISOString().slice(0,10)).qty;if(quantity>available+1e-8)throw Error('Nicht genügend simulierte Aktien am gewählten Datum. Verfügbar: '+number(available,4));}
  const decision=unityHomeDecision(s),autoRate=typeof unityEuroRate==='function'?unityEuroRate(s.currency):null,market=(typeof unityDisplayQuote==='function'?unityDisplayQuote(s):null)||(typeof unityMarketForStock==='function'?unityMarketForStock(s):unityMarketItem(s.isin));
  const manualPrice=!market||Math.abs(Number(market.price)-price)>1e-8,manualFx=!autoRate||Math.abs(Number(autoRate.rate)-fx)>1e-8;
  const trade={id:id(),instrumentId:s.id,type,quantity,price,fx,amount:quantity*price,fee,decidedAt:at.toISOString(),executedAt:at.toISOString(),note:String(data.note||'').trim(),fxSource:manualFx?'Manuell eingegebener Simulationswechselkurs':autoRate.source,fxReferenceDate:manualFx?at.toISOString().slice(0,10):autoRate.date,priceSource:manualPrice?'Manuell eingegebener Simulationskurs':market?.source||'Lokaler Referenzkurs',decisionSnapshot:{action:decision.action,buy:decision.buy,sell:decision.sell,technicalIndex:Number.isFinite(decision.index)?decision.index:null,quoteDate:market?.date||null,quoteObservedAt:market?.quotedAt||null,quotePrecision:market?.precision||'manual',quotePrice:market&&Number.isFinite(Number(market.price))?Number(market.price):null,reason:decision.reason,source:'UNITY Analyse · keine Handelsfreigabe'},source:'UNITY Lab · Testhandel',createdAt:new Date().toISOString()};
  let running=0;for(const item of [...depotActiveTrades(s.id),trade].sort((a,b)=>a.executedAt.localeCompare(b.executedAt)||a.createdAt.localeCompare(b.createdAt))){running+=item.type==='BUY'?Number(item.quantity):-Number(item.quantity);if(running < -1e-8)throw Error('Der Testhandel würde zu einem negativen Bestand in der Buchungshistorie führen.');}
  if(!confirm((type==='BUY'?'Testkauf':'Testverkauf')+' von '+number(quantity,4)+' Stück '+s.name+' zu '+number(price,2)+' '+s.currency+' (ca. '+euro(quantity*price*fx)+') speichern? Dies ist KEIN echter Börsenauftrag.'))return false;
  await put('transactions',trade);await audit(type==='BUY'?'BUY_ADD':'SELL_ADD',trade.id,'Simuliert · '+s.ticker);await refresh();return true;
}

function unityHomeManagePanel(){
  let h='<section class="panel" id="home-manage"><h2>Meine Aktienauswahl verwalten</h2><p class="muted">Bestimme, welche Aktien auf der Startseite erscheinen. Ausblenden entfernt keine Buchungen, Kursdaten oder Analysen.</p>';
  if(!stocks().length)h+='<p>Noch keine Aktien gespeichert. Wähle unten eine Aktie aus dem Katalog.</p>';
  const visible=unityHomeStocks(),all=[...visible,...stocks().filter(s=>s.watchHidden)];
  for(const s of all){const index=visible.findIndex(x=>x.id===s.id);
    h+='<div class="home-manage-row"><div><strong>'+esc(s.name)+'</strong><small>'+esc(s.ticker)+' · '+esc(s.isin||s.exchange)+'</small></div><div class="home-manage-controls">'+
    (index>=0?'<button type="button" class="secondary" data-home-shift="'+esc(s.id)+'" data-direction="-1" '+(index===0?'disabled':'')+' aria-label="'+esc(s.name)+' nach oben">↑</button><button type="button" class="secondary" data-home-shift="'+esc(s.id)+'" data-direction="1" '+(index===visible.length-1?'disabled':'')+' aria-label="'+esc(s.name)+' nach unten">↓</button>':'')+
    '<button type="button" class="'+(s.watchHidden?'secondary':'primary')+'" data-home-toggle="'+esc(s.id)+'">'+(s.watchHidden?'Anzeigen':'Ausblenden')+'</button></div></div>';
  }
  return h+'</section>';
}

document.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.dataset.homeResetPosition){if(typeof depotResetPosition!=='function'){alert('Die Reset-Funktion wird noch geladen. Bitte kurz erneut versuchen.');return}depotResetPosition(b.dataset.homeResetPosition).catch(err=>alert(err.message||String(err)));return}
  if(b.dataset.homeResetAll){if(typeof depotResetAll!=='function'){alert('Die Reset-Funktion wird noch geladen. Bitte kurz erneut versuchen.');return}depotResetAll().catch(err=>alert(err.message||String(err)));return}
  if(b.dataset.homeToggle){const stock=stocks().find(s=>s.id===b.dataset.homeToggle);if(stock){put('instruments',{...stock,watchHidden:!stock.watchHidden}).then(()=>audit('WATCHLIST_TOGGLE',stock.id,!stock.watchHidden?'hidden':'shown')).then(refresh).catch(err=>alert(err.message||String(err)))}return}
  if(b.dataset.homeShift){(async()=>{await unityHomeSelectSort('manual',false);await unityHomeShift(b.dataset.homeShift,Number(b.dataset.direction))})().catch(err=>alert(err.message||String(err)));return}
  if(b.dataset.policyTestbuy){
    const selected=stocks().find(x=>x.id===b.dataset.policyTestbuy);
    if(!selected)return;
    // Simulation only: show editable order form; no automatic booking.
    activeTab='overview';unityHomeSelected=selected.id;unityHomeTradeMode='BUY';render();
    document.getElementById('home-trade-form')?.scrollIntoView({block:'start',behavior:'smooth'});
    return;
  }
  if(b.dataset.homeTrade){unityHomeTradeMode=b.dataset.homeTrade;render();document.getElementById('home-trade-form')?.scrollIntoView({block:'nearest'});return}
  if(b.dataset.homeAutoEdit){
    const s=(cache.instruments||[]).find(x=>x.id===b.dataset.homeAutoEdit);
    if(!s||!unityAutoBuy(s))return;
    activeTab='overview';unityHomeSelected=s.id;unityHomeTradeMode='';render();
    document.querySelector('.home-auto-stock')?.scrollIntoView({block:'start',behavior:'smooth'});
    return;
  }
  if(b.hasAttribute('data-paper-costs-save')){
    if(b.disabled)return;
    const get=x=>document.getElementById(x)?.value;
    const values={spreadBps:get('paper-spread-bps'),slippageBps:get('paper-slippage-bps'),
      feeEur:get('paper-fee-eur')};
    const status=b.closest('.home-paper-costs')?.querySelector('.paper-costs-status');
    b.disabled=true;b.textContent='Speichere …';
    if(status)status.textContent='Kostenannahmen werden gespeichert …';
    unityPaperSavePolicy(values).catch(err=>{
      b.disabled=false;b.textContent='Kostenannahmen speichern';
      if(status)status.textContent='Speichern fehlgeschlagen';
      alert(err.message||String(err));
    });
    return;
  }
  if(b.hasAttribute('data-home-auto-budget-save')){
    if(b.disabled)return;
    const budgetValue=document.getElementById('auto-total-budget')?.value;
    const status=b.closest('.home-auto-budget')?.querySelector('.home-auto-budget-state');
    b.disabled=true;b.textContent='Speichere …';
    if(status)status.textContent='Speichere Gesamtbudget …';
    (async()=>{try{
      const changed=await unityAutoSetBudget(budgetValue);
      if(!changed){
        b.disabled=false;b.textContent='Budget speichern';
        if(status)status.textContent='✓ Budget '+depotMoney(unityAutoBudgetStatus().limit)+' bereits gespeichert';
      }
    }catch(err){
      b.disabled=false;b.textContent='Budget speichern';
      if(status)status.textContent='Speichern fehlgeschlagen · bitte erneut versuchen';
      alert(err.message||String(err));
    }})();
    return;
  }
  if(b.dataset.homeAutoBuySave){
    const s=(cache.instruments||[]).find(x=>x.id===b.dataset.homeAutoBuySave);
    if(!s||b.disabled)return;
    const euros=document.getElementById('auto-buy-amount-'+s.id)?.value;
    const status=b.closest('.home-auto-allocation')?.querySelector('.home-auto-save-state');
    b.disabled=true;b.textContent='Speichere …';
    if(status)status.textContent='Speichere '+String(euros||'')+' € …';
    (async()=>{try{
      const changed=await unityAutoBuyChangeAllocation(s,euros);
      if(!changed){
        b.disabled=false;b.textContent='Betrag speichern';
        if(status)status.textContent='✓ '+depotMoney(unityAutoEurAmount(unityAutoBuy(s)))+' bereits gespeichert';
      }
    }catch(err){
      b.disabled=false;b.textContent='Betrag speichern';
      if(status)status.textContent='Speichern fehlgeschlagen · bitte erneut versuchen';
      alert(err.message||String(err));
    }})();
    return;
  }
  if(b.dataset.homeAutoBuy){
    const s=(cache.instruments||[]).find(x=>x.id===b.dataset.homeAutoBuy);if(!s)return;const prior=unityAutoBuy(s);
    if(prior){put('settings',{...prior,active:false,cancelledAt:new Date().toISOString()}).then(()=>audit('AUTO_TEST_BUY_OFF',s.id,s.ticker)).then(refresh).catch(err=>alert(err.message||String(err)));return}
    const mode=b.dataset.autoMode==='technical'?'technical':'strict',label=unityAutoBuyModeLabel(mode);
    const input=document.getElementById('auto-buy-amount-'+s.id),budget=unityAutoBudgetStatus();
    if(!budget.configured){alert('Bitte zuerst unter „Automatik · Testdepot“ ein Gesamtbudget für Testkäufe festlegen.');return}
    let amount;try{amount=unityAutoValidateEur(input?.value)}catch(err){alert(err.message||String(err));return}
    if(amount>budget.limit){alert('Der feste Kaufbetrag darf nicht über dem gesamten Testkaufbudget liegen.');return}
    const info=mode==='technical'?'technische Kaufzone erreicht und geprüft':
      'strenge UNITY-Freigabe vollständig positiv';
    const message=label+' aktivieren?\n\nFester Testkaufbetrag: '+depotMoney(amount)+
      '\nGesamtbudget für automatische Käufe: '+depotMoney(budget.limit)+
      '\nKauf nur, wenn die '+info+' ist, genügend freies Testkapital und Budget vorhanden sind. Keine Brokerorder.';
    if(confirm(message))put('settings',{id:unityAutoBuyId(s),kind:'auto-test-buy',instrumentId:s.id,
      mode,allocationEur:amount,active:true,createdAt:new Date().toISOString()})
      .then(()=>audit('AUTO_TEST_BUY_ON',s.id,label+' · '+depotMoney(amount))).then(refresh).catch(err=>alert(err.message||String(err)));return;
  }
  if(b.dataset.homeAutoSell){
    const s=(cache.instruments||[]).find(x=>x.id===b.dataset.homeAutoSell);if(!s)return;const prior=unityAutoSell(s);
    if(prior){put('settings',{...prior,active:false,cancelledAt:new Date().toISOString()}).then(()=>audit('AUTO_TEST_SELL_OFF',s.id,s.ticker)).then(refresh).catch(err=>alert(err.message||String(err)));return}
    if(confirm('Auto-Testverkauf aktivieren?\n\nUNITY verkauft beim nächsten verfügbaren Tageskurs unterhalb der automatisch berechneten Schutz-/Verkaufszone den gesamten simulierten Bestand. Keine echte Brokerorder.'))put('settings',{id:unityAutoSellId(s),kind:'auto-test-sell',instrumentId:s.id,active:true,createdAt:new Date().toISOString()}).then(()=>audit('AUTO_TEST_SELL_ON',s.id,s.ticker)).then(refresh).catch(err=>alert(err.message||String(err)));return;
  }
  if(b.dataset.homeZoneClear){
    const record=unityZonePlan({id:b.dataset.homeZoneClear});
    if(record&&confirm('Eigene Preiszonen löschen? Die automatische technische SMA50-Zone bleibt erhalten.'))put('settings',{...record,deletedAt:new Date().toISOString(),entryLow:null,entryHigh:null,exitLow:null,exitHigh:null}).then(()=>audit('ZONE_PLAN_CLEAR',b.dataset.homeZoneClear,'Eigene Preiszonen gelöscht')).then(refresh).catch(err=>alert(err.message||String(err)));
    return;
  }
  if(b.hasAttribute('data-home-trade-cancel')){unityHomeTradeMode='';render();return}
  if(b.dataset.homeSort){unityHomeSelectSort(b.dataset.homeSort).catch(err=>alert(err.message||String(err)));return}
  if(b.dataset.homeRange){unityHomeRange=b.dataset.homeRange;render();return}
  if(b.dataset.analyze){unityHomeSelected=b.dataset.analyze;unityHomeTradeMode='';activeTab='overview';render();document.getElementById('home-stock-detail')?.scrollIntoView({behavior:'smooth',block:'start'});const stock=stocks().find(x=>x.id===unityHomeSelected);
    if(stock&&typeof unityDecisionLedgerCapture==='function')unityDecisionLedgerCapture(stock,'strict').catch(err=>console.warn('UNITY Decision Ledger:',err));
    if(stock&&typeof unityLoadDynamicStock==='function')unityLoadDynamicStock(stock);if(stock&&typeof unityLoadNews==='function')unityLoadNews(stock);return}
  if(b.dataset.homeOpen){unityHomeSelected=b.dataset.homeOpen;unityHomeTradeMode='';render();document.getElementById('home-stock-detail')?.scrollIntoView({behavior:'smooth',block:'start'});const stock=stocks().find(x=>x.id===unityHomeSelected);
    if(stock&&typeof unityDecisionLedgerCapture==='function'){
      unityDecisionLedgerCapture(stock,'strict').catch(err=>console.warn('UNITY Decision Ledger:',err));
      unityDecisionLedgerCapture(stock,'technical').catch(err=>console.warn('UNITY Technical Ledger:',err));
    }
    if(stock&&typeof unityLoadDynamicStock==='function')unityLoadDynamicStock(stock);if(stock&&typeof unityLoadNews==='function')unityLoadNews(stock);return}
  if(b.hasAttribute('data-home-close')){unityHomeSelected='';unityHomeTradeMode='';render();return}
  if(b.dataset.homeAnalyze){selectedUnityStock=b.dataset.homeAnalyze;activeTab='analysis';render();document.getElementById('app')?.scrollIntoView({block:'start'});
    const stock=stocks().find(x=>x.id===selectedUnityStock);
    if(stock&&typeof unityDecisionLedgerCapture==='function')unityDecisionLedgerCapture(stock,'strict').catch(err=>console.warn('UNITY Decision Ledger:',err));return}
  if(b.hasAttribute('data-home-add')){activeTab='stocks';if(typeof unityUniverseCategory!=='undefined')unityUniverseCategory='all';if(typeof unityUniverseTerm!=='undefined')unityUniverseTerm='';render();document.querySelector('.universe-tabs')?.scrollIntoView({block:'start'});return}
  if(b.hasAttribute('data-home-all')){unityScope='all';activeTab='stocks';render();return}
  if(b.hasAttribute('data-home-capital')){activeTab='trades';render();document.getElementById('depot-capital')?.scrollIntoView({behavior:'smooth',block:'start'});return}
  if(b.hasAttribute('data-home-trades')){activeTab='trades';render();return}
  if(b.hasAttribute('data-home-reload')){
    (async()=>{
      await unityEnsurePilotTwenty();
      const group=stocks();
      unityLoadMarket();if(typeof unityLoadIntraday==='function')unityLoadIntraday();if(typeof unityLoadFx==='function')unityLoadFx();
      if(typeof unityCompleteDynamicHistories==='function')unityCompleteDynamicHistories(group,p=>{const el=document.getElementById('db-status');if(el)el.textContent='Kursreihen werden ergänzt: '+p.done+'/'+p.total+(p.failed?' · '+p.failed+' nicht verfügbar':'')}).then(p=>{const el=document.getElementById('db-status');if(el)el.textContent='Lokal gespeichert · Kursreihen '+p.ok+'/'+p.total+(p.failed?' · '+p.failed+' nicht verfügbar':'')});
    })().catch(err=>alert(err.message||String(err)));
    return
  }
});
// Recheck the published EOD snapshot when the user returns to the app.
// A refreshed snapshot is not a live quote stream.
let unityHomeLastCheck=Date.now();
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='visible'&&Date.now()-unityHomeLastCheck>15*60000){
    unityHomeLastCheck=Date.now();unityLoadMarket();if(typeof unityLoadIntraday==='function')unityLoadIntraday();if(typeof unityLoadFx==='function')unityLoadFx();
  }
});

/* Pull down at the top of the depot to recheck available reference data. */
let unityPullStartY=0,unityPullActive=false,unityPullRefreshing=false;
function unityPullStatus(message,visible=true){
  let el=document.getElementById('unity-pull-status');
  if(!el){el=document.createElement('div');el.id='unity-pull-status';el.setAttribute('role','status');el.setAttribute('aria-live','polite');document.body.append(el);}
  el.textContent=message;el.classList.toggle('visible',visible);
}
async function unityPullRefresh(){
  if(unityPullRefreshing)return;
  unityPullRefreshing=true;unityPullStatus('Kursdaten werden geprüft …');
  try{
    await Promise.allSettled([
      typeof unityLoadMarket==='function'?unityLoadMarket():Promise.resolve(),
      typeof unityLoadIntraday==='function'?unityLoadIntraday():Promise.resolve(),
      typeof unityLoadFx==='function'?unityLoadFx():Promise.resolve(),
      typeof unityRefreshDynamicHistories==='function'?unityRefreshDynamicHistories(typeof unityResearchRefreshTargets==='function'?unityResearchRefreshTargets('background'):stocks()):Promise.resolve()
    ]);
    unityHomeLastCheck=Date.now();unityPullStatus('Kursdaten geprüft');
  }finally{
    unityPullRefreshing=false;setTimeout(()=>unityPullStatus('',false),1800);
  }
}
document.addEventListener('touchstart',e=>{
  if(activeTab!=='overview'||window.scrollY>0||e.touches.length!==1)return;
  unityPullStartY=e.touches[0].clientY;unityPullActive=true;
},{passive:true});
document.addEventListener('touchmove',e=>{
  if(!unityPullActive||unityPullRefreshing)return;
  const distance=e.touches[0].clientY-unityPullStartY;
  if(distance>12)unityPullStatus(distance>=80?'Loslassen: Kursdaten prüfen':'Zum Aktualisieren herunterziehen');
  if(distance>0)e.preventDefault();
},{passive:false});
document.addEventListener('touchend',e=>{
  if(!unityPullActive)return;
  const distance=e.changedTouches[0].clientY-unityPullStartY;unityPullActive=false;
  if(distance>=80)unityPullRefresh();else unityPullStatus('',false);
},{passive:true});
/* Touch + mouse reorder: move only from the explicit grip so tapping a row still opens details. */
document.addEventListener('pointerdown',e=>{
  const grip=e.target.closest('[data-home-drag]');if(!grip||e.button!==0||unityHomeSort!=='manual')return;
  const row=grip.closest('[data-home-row]');if(!row)return;
  unityHomeDrag={id:grip.dataset.homeDrag,target:grip.dataset.homeDrag,startY:e.clientY,moved:false,handle:grip};
  grip.setPointerCapture?.(e.pointerId);
  row.classList.add('home-dragging');
});
document.addEventListener('pointermove',e=>{
  if(!unityHomeDrag)return;
  const drag=unityHomeDrag;
  if(Math.abs(e.clientY-drag.startY)>8)drag.moved=true;
  const under=document.elementFromPoint?.(e.clientX,e.clientY)?.closest?.('[data-home-row]');
  if(under&&under.dataset.homeRow!==drag.id){
    drag.target=under.dataset.homeRow;
    document.querySelectorAll('[data-home-row]').forEach(el=>el.classList.toggle('home-drop-target',el===under));
  }
});
document.addEventListener('pointerup',e=>{
  if(!unityHomeDrag)return;
  const drag=unityHomeDrag;unityHomeDrag=null;
  document.querySelectorAll('[data-home-row]').forEach(el=>el.classList.remove('home-dragging','home-drop-target'));
  if(drag.moved&&drag.target!==drag.id){unityHomeSort='manual';unityHomeReorder(drag.id,drag.target).catch(err=>alert(err.message||String(err)))}
});
document.addEventListener('pointercancel',()=>{
  unityHomeDrag=null;document.querySelectorAll('[data-home-row]').forEach(el=>el.classList.remove('home-dragging','home-drop-target'));
});
document.addEventListener('submit',async e=>{
  if(!['home-trade-form','home-capital-form','home-zone-form'].includes(e.target.id))return;
  e.preventDefault();
  try{
    if(e.target.id==='home-zone-form'){
      const d=Object.fromEntries(new FormData(e.target)),s=stocks().find(x=>x.id===d.instrumentId);if(!s)throw Error('Aktie nicht gefunden.');
      const read=k=>String(d[k]??'').trim()===''?null:Number(String(d[k]).replace(',','.'));
      const entryLow=read('entryLow'),entryHigh=read('entryHigh'),exitLow=read('exitLow'),exitHigh=read('exitHigh');
      if([entryLow,entryHigh,exitLow,exitHigh].some(v=>v!==null&&(!(v>0)||!Number.isFinite(v))))throw Error('Preisgrenzen müssen positiv sein.');
      if((entryLow===null)!==(entryHigh===null))throw Error('Bitte die Kaufzone immer mit Unter- und Obergrenze angeben.');
      if(entryLow!==null&&entryHigh<entryLow)throw Error('Die Obergrenze der Kaufzone muss mindestens so hoch wie die Untergrenze sein.');
      if(entryLow===null&&exitLow===null&&exitHigh===null)throw Error('Mindestens eine Zone angeben.');
      await put('settings',{id:unityZonePlanId(s),kind:'price-zone-plan',instrumentId:s.id,entryLow,entryHigh,exitLow,exitHigh,updatedAt:new Date().toISOString()});
      await audit('ZONE_PLAN_SAVE',s.id,'Lokaler Zonenwächter · '+s.ticker);await refresh();return;
    }
    if(e.target.id==='home-capital-form'){
      if(typeof depotSaveCapital!=='function')throw Error('Kapitalverwaltung ist noch nicht verfügbar.');
      await depotSaveCapital(new FormData(e.target).get('capital'));
      await refresh();return;
    }
    const saved=await unityHomeSaveTrade(Object.fromEntries(new FormData(e.target)));
    if(saved){unityHomeTradeMode='';render();document.getElementById('home-stock-detail')?.scrollIntoView({block:'start'})}
  }catch(err){alert(err.message||String(err))}
});

document.addEventListener('input',e=>{if(e.target.closest?.('#home-trade-form')&&['quantity','fee','price','fx'].includes(e.target.name))unityHomeUpdateTradeEstimate(e.target.form)});
