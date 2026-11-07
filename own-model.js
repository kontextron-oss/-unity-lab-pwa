'use strict';
/* UNITY 0.16.4 – first *own* precommitted experimental revenue hypotheses.
   Model skill: UNPROVEN until future annual filings; no buy/sell permissions. */
let unityOwnModelJournal=null,unityOwnModelError='',unityOwnModelLoading=false;
function unityOwnModelNumber(x){return typeof x==='number'&&Number.isFinite(x)?x:null}
function unityOwnModelMoney(value){
 if(unityOwnModelNumber(value)===null)return 'offen';
 return new Intl.NumberFormat('de-DE',{maximumFractionDigits:2}).format(value/1e9)+' Mrd. USD';
}
async function unityOwnModelLoad(){
 if(unityOwnModelLoading||unityOwnModelJournal)return;
 unityOwnModelLoading=true;
 try{
  let r;
  try{
   r=await fetch('./data/unity-model-forecasts.json?t='+Date.now(),
    {cache:'no-store',credentials:'omit'});
   if(!r.ok)throw Error('HTTP '+r.status);
  }catch(_){
   r=await fetch('./data/unity-model-forecasts.json',{cache:'default',credentials:'omit'});
   if(!r.ok)throw Error('Modellprotokoll offline nicht verfügbar');
  }
  const doc=await r.json();
  if(doc?.schemaVersion!==1||!doc.forecasts||Array.isArray(doc.forecasts)||
     typeof doc.forecasts!=='object'||doc.modelCalibrated!==false||
     typeof doc.counts!=='object')throw Error('Unbekanntes Modelljournal');
  unityOwnModelJournal=doc;unityOwnModelError='';
 }catch(e){unityOwnModelJournal=null;unityOwnModelError=String(e?.message||e)}
 finally{
  unityOwnModelLoading=false;
  if(typeof db!=='undefined'&&db&&typeof render==='function')render();
 }
}
function unityOwnModelEntries(stock,doc=unityOwnModelJournal){
 if(!stock?.isin||!doc?.forecasts)return [];
 return Object.values(doc.forecasts)
  .filter(e=>e?.frozen?.isin===stock.isin&&e.frozen.ticker===stock.ticker&&
    e.frozen.modelId==='unity-revenue-momentum-shrink-v1'&&
    e.frozen.metric==='revenue'&&e.frozen.inputs?.current?.sourceUrl===
       'https://data.sec.gov/api/xbrl/companyfacts/CIK'+e.frozen.cik+'.json'&&
    e.forecastFingerprint&&typeof e.forecastFingerprint==='string'&&
    e.forecastFingerprint.length===64)
  .sort((a,b)=>String(b.frozen.targetPeriodEnd).localeCompare(String(a.frozen.targetPeriodEnd)));
}
function unityOwnModelChallenge(stock,opts={}){
 const entry=opts.entry===undefined?unityOwnModelEntries(stock)[0]:opts.entry;
 const f=entry?.frozen;
 const blocked=reason=>({kind:'unavailable',reason,tradeApproved:false});
 if(!f||f.isin!==stock?.isin||f.ticker!==stock?.ticker||f.metric!=='revenue'||
    f.nonProbabilistic!==true||!(f.predictedRevenueUSD>0))
  return blocked('Keine gültige vorab registrierte Modellprognose');
 const raw=opts.guidance===undefined?
  (typeof unityGuidanceEvidence==='function'?unityGuidanceEvidence(stock):null):opts.guidance;
 const g=raw&&typeof unityGuidanceEvidence==='function'?
  unityGuidanceEvidence(stock,{[stock.isin]:raw}):null;
 if(!g||g.isin!==f.isin||g.fiscalYear!==Number(f.targetPeriodEnd.slice(0,4))||
    !Array.isArray(g.guidance)||!g.sourceUrl?.startsWith('https://')||
    !g.publishedAt||g.publishedAt>new Date().toISOString().slice(0,10))
  return blocked('Keine aktuell überprüfte vergleichbare Unternehmensprognose');
 const matches=g.guidance.filter(x=>x.metric==='revenue'&&
  x.horizon==='FY'+g.fiscalYear&&x.unit==='USD'&&x.nonGAAP!==true&&
  typeof x.lower==='number'&&typeof x.upper==='number'&&
  Number.isFinite(x.lower)&&Number.isFinite(x.upper)&&x.lower>0&&x.upper>=x.lower);
 if(matches.length!==1)return blocked('Prognosebasis nicht vergleichbar (z. B. organisches Wachstum statt Gesamtumsatz)');
 const {lower,upper}=matches[0],forecast=f.predictedRevenueUSD;
 const side=forecast<lower?'below':forecast>upper?'above':'inside';
 const delta=side==='below'?100*(lower-forecast)/lower:
   side==='above'?100*(forecast-upper)/upper:0;
 const gapPct=Math.round(delta*100)/100;
 return {kind:'comparable',tradeApproved:false,entryZone:null,side,gapPct,
  ownRevenueUSD:forecast,flatRevenueUSD:f.flatRevenueBenchmarkUSD,
  managementLowUSD:lower,managementHighUSD:upper,
  sourceUrl:g.sourceUrl,sourcePublishedAt:g.publishedAt,modelRegisteredAt:f.createdAt,
  guidanceKnownAtRegistration:g.publishedAt<=f.createdAt.slice(0,10),
  severity:side==='inside'?'none':gapPct>=10?'high':gapPct>=5?'medium':'low',
  nextReview:'Geschäftsmix, Auftragsbestand, Übernahmen und Prognoserevisionen mit Primärquellen vergleichen.',
  verdict:'Hypothesenwiderspruch – keine Handelsfreigabe'};
}
function unityOwnModelChallengeMarkup(stock,entry){
 const c=unityOwnModelChallenge(stock,{entry});
 if(c.kind!=='comparable')return '<p class="tiny muted">'+esc(c.reason)+
  '. Ein fehlender Vergleich ist kein negatives Unternehmenssignal.</p>';
 const relation=c.side==='below'?'unter der unteren Managementspanne':
  c.side==='above'?'über der oberen Managementspanne':'innerhalb der Managementspanne';
 return '<p class="tiny muted"><b>Hypothesenvergleich:</b> Modell '+esc(relation)+
   (c.side==='inside'?'':' · Abstand '+c.gapPct+' %')+
   '. Management-Prognose: '+unityOwnModelMoney(c.managementLowUSD)+
   ' – '+unityOwnModelMoney(c.managementHighUSD)+
   ' · <a href="'+esc(c.sourceUrl)+'" target="_blank" rel="noopener noreferrer">Originalquelle</a> ('+
   esc(c.sourcePublishedAt)+').</p><p class="tiny muted">'+
   (c.guidanceKnownAtRegistration?
   '<b>Kein Informationsvorsprung:</b> Die Managementprognose war bei Registrierung des vereinfachten Modells bereits bekannt. ':
   'Die Managementprognose wurde nach Registrierung veröffentlicht. ')+
   '<b>Prüfauftrag:</b> '+esc(c.nextReview)+'</p>';
}
function unityOwnModelForecastPanel(stock){
 const entries=unityOwnModelEntries(stock);
 if(!entries.length)return '';
 const e=entries[0],f=e.frozen,observed=e.verified||null;
 const reportYear=String(f.targetPeriodEnd).slice(0,4),asOf=f.createdAt.slice(0,10);
 let h='<details class="unity-secondary-check"><summary>UNITY-eigene Prognose · Forschungsmodell '+esc(reportYear)+'</summary>'+
   '<p class="tiny muted">Ex-ante registriert am '+esc(asOf)+
   ' · unabhängiger, ausdrücklich unkalibrierter Referenzversuch. Keine Kurs- oder Gewinnprognose.</p>'+
   '<div class="home-data-row"><span>Prognostizierter Konzernumsatz '+esc(reportYear)+'</span><b>'+
   unityOwnModelMoney(f.predictedRevenueUSD)+'</b></div>'+
   '<div class="home-data-row"><span>Ausgangspunkt · Umsatz '+esc(f.basePeriodEnd.slice(0,4))+'</span><b>'+
   unityOwnModelMoney(f.inputs.current.value)+'</b></div>'+
   '<div class="home-data-row"><span>Historisches Umsatzwachstum</span><b>'+
   esc(String(f.historicGrowthPct))+' %</b></div>'+
   '<div class="home-data-row"><span>Vorsichtig fortgeschriebenes Modellwachstum</span><b>'+
   esc(String(f.projectedGrowthPct))+' %</b></div>'+
   '<p class="tiny muted">Vergleichsmaßstab ohne Wachstum: '+unityOwnModelMoney(f.flatRevenueBenchmarkUSD)+
   '. UNITY verwendet die Hälfte des letzten Jahreswachstums, begrenzt auf −20 % bis +25 %. '+
   'Das ist bewusst einfach und noch kein trainiertes Prognosemodell.</p>';
 if(observed){
  h+='<p class="tiny muted"><b>Späterer SEC-Istwert:</b> '+unityOwnModelMoney(observed.valueUSD)+
    ' · Modellfehler '+esc(String(observed.absoluteErrorPct))+' %'+
    ' · Fehler ohne Wachstum '+esc(String(observed.baselineAbsoluteErrorPct))+' %'+
    (e.status==='revision-review'?' · Achtung: korrigierter SEC-Wert muss geprüft werden.':'')+
    '. Prüfung erst nach Originalveröffentlichung.</p>';
 }else h+='<p class="tiny muted">Ergebnisprüfung noch offen; kein Treffer behauptet.</p>';
 h+='<p class="tiny muted">Prognosequelle: <a href="'+esc(f.inputs.current.sourceUrl)+
  '" target="_blank" rel="noopener noreferrer">SEC-Konzernabschluss '+esc(f.basePeriodEnd.slice(0,4))+'</a>'+
  '. Unveränderliches Prognoseprotokoll; kein Kauf- oder Verkaufssignal.</p></details>';
 return h;
}
function unityOwnModelOverview(){
 const d=unityOwnModelJournal;
 if(!d)return '';
 const entries=Object.values(d.forecasts||{}),count=entries.length;
 if(!count)return '';
 let h='<section class="panel"><h3>UNITY-Forschung · eigene Vorhersagen</h3>'+
   '<p><b>'+count+' im Voraus protokollierte Modellhypothesen</b> · '+
   (d.measuredSampleSize||0)+' später überprüfte Ergebnisse.</p>'+
   '<p class="tiny muted">Es gibt noch keine verifizierte Prognoseleistung. Erst ab 20 voneinander getrennten Ergebnissen prüfen wir statistische Fehler und den Vergleich mit einer einfachen Nullwachstums-Basis.</p>'+
   '<details class="unity-secondary-check"><summary>Vergleichsmodell und Unternehmen ansehen</summary>';
 for(const e of entries.slice(-8)){
  const f=e.frozen;
  h+='<div class="home-data-row"><span>'+esc(f.ticker)+' · Geschäftsjahr '+
    esc(f.targetPeriodEnd.slice(0,4))+'</span><b>'+
    unityOwnModelMoney(f.predictedRevenueUSD)+'</b></div>';
 }
 h+='</details></section>';
 return h;
}
if(typeof fetch==='function')unityOwnModelLoad();
