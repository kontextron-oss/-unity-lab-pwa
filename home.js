'use strict';
/* Home-first selected watchlist. Source: delayed market.json daily closes.
   This is not a live broker account, nor a real-time trading signal. */
let unityHomeRange='1D',unityHomeSelected='',unityHomeTradeMode='',unityHomeDrag=null,unityHomeSort='manual';
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
  const event=Date.parse(f?.earningsDate||'');
  const near=!!f?.earningsConfirmed&&Number.isFinite(event)&&
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
function unityHomeDisplayedStocks(){
  const list=unityHomeStocks();
  if(unityHomeSort==='priority'){
    // Cache ranking once per render: do not recompute 200-day indicators for
    // every sorting comparison on smaller iPhone devices.
    const ranks=new Map(list.map(s=>{
      const p=unityPullbackAlert(s);
      const rank=p.kind==='reached'?0:p.kind==='blocked'?1:p.kind==='watch'?2:3+unityPreAnalysis(s).rank;
      return [s.id,rank];
    }));
    list.sort((a,b)=>(ranks.get(a.id)??99)-(ranks.get(b.id)??99)||a.name.localeCompare(b.name));
  }
  return list;
}

function unityHome(){
  const selected=unityHomeDisplayedStocks(),pos=typeof depotPositions==='function'?depotPositions():[],capital=typeof depotCapital==='function'?depotCapital():null;
  const allValid=pos.length>0&&pos.every(p=>Number.isFinite(p.value));
  const value=allValid?pos.reduce((n,p)=>n+p.value,0):NaN;
  const gainClass=Number.isFinite(capital?.gain)?(capital.gain>0?'home-profit-up':capital.gain<0?'home-profit-down':'home-profit-flat'):'home-profit-flat';
  const nUp=selected.filter(s=>unityHomeQuote(s).valid&&unityHomeQuote(s).m.trend==='Aufwärtstrend').length;
  const nDown=selected.filter(s=>unityHomeQuote(s).valid&&unityHomeQuote(s).m.trend==='Abwärtstrend').length;
  let h='<section class="home-hero" id="unity-home"><div class="home-hero-title"><span class="home-hero-mark" aria-hidden="true">↗</span><div><h2>Mein Depot</h2><small>UNITY Lab · persönliche Aktienübersicht</small></div><button type="button" class="home-hero-menu" data-home-add title="Aktien auswählen">＋</button></div>'+
    '<div class="home-periods" aria-label="Kurszeitraum">'+unityHomePeriods.map(([r,label])=>'<button type="button" data-home-range="'+r+'" class="'+(r===unityHomeRange?'active':'')+'">'+label+'</button>').join('')+'</div>';
  if(capital?.configured){
    const complete=Number.isFinite(capital.total);
    h+='<p class="home-wealth-kicker">Gesamtvermögen · Testdepot</p>'+
      '<div class="home-big-number" aria-label="Fiktives Gesamtvermögen">'+(complete?euro(capital.total):'–')+'</div>'+
      '<p class="home-value-label">'+(complete?(capital.indicative?'Indikativer Depotstand · nicht börslich verifizierte Kurse':'Freies Kapital + aktueller Depotwert · Simulation'):'Gesamtvermögen nicht berechenbar · Kursdaten fehlen')+'</p>';
    if(complete){
      h+='<div class="home-wealth-profit '+gainClass+'"><b>Gewinn / Verlust gesamt: '+depotSignedMoney(capital.gain)+'</b>'+
        '<span>'+depotSignedPct(capital.gainPct)+' auf Nettoeinzahlungen</span></div>';
    }else{
      h+='<p class="home-wealth-warning">Für '+capital.missingCount+' gekaufte Position'+(capital.missingCount===1?'':'en')+
        ' fehlen verwendbare aktuelle Kursdaten oder EUR-Wechselkurse. Freies Kapital wird nicht als Gesamtvermögen ausgegeben.</p>';
    }
    h+='<div class="home-wealth-grid">'+
      '<div><small>Einzahlungen netto</small><b>'+depotMoney(capital.funded)+'</b></div>'+
      '<div><small>Frei verfügbar</small><b>'+depotMoney(capital.free)+'</b></div>'+
      '<div><small>Depotwert aktuell</small><b>'+depotMoney(capital.market)+'</b></div>'+
      '<div><small>Einstand offener Aktien</small><b>'+depotMoney(capital.invested)+'</b></div>'+
      '<div><small>Buchgewinn / -verlust</small><b class="'+(capital.unrealized>0?'home-profit-up':capital.unrealized<0?'home-profit-down':'')+'">'+depotSignedMoney(capital.unrealized)+'</b></div>'+
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
        '<span class="home-holding-top"><strong>'+esc(p.s.name)+monitorText+'</strong><b class="'+cl+'">'+(valid?depotSignedMoney(p.pnl):'Bewertung offen')+'</b></span>'+
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
h+='<section class="home-list"><div class="home-list-head"><h2>Meine ausgewählten Aktien</h2><button type="button" class="secondary" data-home-add>＋ Aktie hinzufügen</button></div>'+
    '<div class="home-sort-controls"><span>Reihenfolge:</span><button type="button" data-home-sort="manual" class="'+(unityHomeSort==='manual'?'active':'')+'">Meine Reihenfolge</button><button type="button" data-home-sort="priority" class="'+(unityHomeSort==='priority'?'active':'')+'">Recherche-Radar</button></div>'+
    '<p class="home-sort-hint">„Recherche-Radar“ ordnet zuerst Werte mit vertiefungswürdiger Entwicklung. Reihenfolge per ☰ oder ↑ ↓ ändern.</p>';
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
      '<span class="home-stock-main"><strong>'+esc(s.name)+'</strong>'+issuerBadge+unityPullbackLabel(s,pullback)+'<span class="home-research-flag home-research-'+research.kind+'">'+esc(research.label)+'</span><small>'+esc(s.ticker)+' · '+esc(s.exchange)+'</small>'+(position.qty>0?'<small class="home-position-label">● Im Testdepot · '+number(position.qty,4)+' Stück</small><small class="home-position-profit '+(position.pnl>0?'home-profit-up':position.pnl<0?'home-profit-down':'')+'">Depotwert '+depotMoney(position.value)+' · '+depotSignedMoney(position.pnl)+'</small>':'')+'</span>'+
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
  if(typeof unityPositionMonitorPanel==='function')h+=unityPositionMonitorPanel(s);
  if(typeof unityDeepDecisionPanel==='function')h+=unityDeepDecisionPanel(s);
  if(typeof unityDecisionResultPanel==='function')h+='<details class="unity-secondary-check"><summary>Weitere technische Prüfbedingungen anzeigen</summary>'+unityDecisionResultPanel(s)+'</details>';
  if(x)h+=unityChartPanel(x);
  else h+='<p class="home-missing">'+(s.providerSymbol?(typeof unityDynamicErrors!=='undefined'&&unityDynamicErrors.get(s.providerSymbol.toUpperCase())?'Kursquelle derzeit nicht erreichbar: '+esc(unityDynamicErrors.get(s.providerSymbol.toUpperCase())):'Internationale Kursreihe wird geladen, sofern die externe Quelle erreichbar ist.'):'Kein überprüfbarer Tageskursverlauf vorhanden. Es wird keine Kurve erfunden.')+'</p>';
  if(dq)h+='<p class="home-price-time">'+esc(dq.label)+': <b>'+number(dq.price,2)+' '+esc(s.currency)+'</b> · '+(dq.quotedAt?esc(new Date(dq.quotedAt).toLocaleString('de-DE',{timeZone:'Europe/Berlin'}))+' MEZ/MESZ':esc(dq.date))+' · '+esc(dq.exchange)+'</p>';
  if(s.providerSymbol)h+='<p class="tiny muted">Weltweiter Kursabruf: inoffizielle Yahoo-Daten über cors.dev, nicht börslich geprüft. Keine Handelsfreigabe; Suchanfrage und Symbol werden an externe Dienste übertragen.</p>';
  if(s.note)h+='<p><b>Unternehmensbereich:</b> '+esc(s.note)+'</p>';
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
  if(b.dataset.homeShift){unityHomeSort='manual';unityHomeShift(b.dataset.homeShift,Number(b.dataset.direction)).catch(err=>alert(err.message||String(err)));return}
  if(b.dataset.policyTestbuy){
    const selected=stocks().find(x=>x.id===b.dataset.policyTestbuy);
    if(!selected)return;
    // Simulation only: show editable order form; no automatic booking.
    activeTab='overview';unityHomeSelected=selected.id;unityHomeTradeMode='BUY';render();
    document.getElementById('home-trade-form')?.scrollIntoView({block:'start',behavior:'smooth'});
    return;
  }
  if(b.dataset.homeTrade){unityHomeTradeMode=b.dataset.homeTrade;render();document.getElementById('home-trade-form')?.scrollIntoView({block:'nearest'});return}
  if(b.hasAttribute('data-home-trade-cancel')){unityHomeTradeMode='';render();return}
  if(b.dataset.homeSort){unityHomeSort=b.dataset.homeSort==='priority'?'priority':'manual';render();return}
  if(b.dataset.homeRange){unityHomeRange=b.dataset.homeRange;render();return}
  if(b.dataset.analyze){unityHomeSelected=b.dataset.analyze;unityHomeTradeMode='';activeTab='overview';render();document.getElementById('home-stock-detail')?.scrollIntoView({behavior:'smooth',block:'start'});const stock=stocks().find(x=>x.id===unityHomeSelected);if(stock&&typeof unityLoadDynamicStock==='function')unityLoadDynamicStock(stock);if(stock&&typeof unityLoadNews==='function')unityLoadNews(stock);return}
  if(b.dataset.homeOpen){unityHomeSelected=b.dataset.homeOpen;unityHomeTradeMode='';render();document.getElementById('home-stock-detail')?.scrollIntoView({behavior:'smooth',block:'start'});const stock=stocks().find(x=>x.id===unityHomeSelected);if(stock&&typeof unityLoadDynamicStock==='function')unityLoadDynamicStock(stock);if(stock&&typeof unityLoadNews==='function')unityLoadNews(stock);return}
  if(b.hasAttribute('data-home-close')){unityHomeSelected='';unityHomeTradeMode='';render();return}
  if(b.dataset.homeAnalyze){selectedUnityStock=b.dataset.homeAnalyze;activeTab='analysis';render();document.getElementById('app')?.scrollIntoView({block:'start'});return}
  if(b.hasAttribute('data-home-add')){activeTab='stocks';render();document.getElementById('online-search')?.scrollIntoView({block:'start'});document.getElementById('online-search')?.focus();return}
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
      typeof unityRefreshDynamicHistories==='function'?unityRefreshDynamicHistories(stocks()):Promise.resolve()
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
  if(e.target.id!=='home-trade-form'&&e.target.id!=='home-capital-form')return;
  e.preventDefault();
  try{
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
