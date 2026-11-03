'use strict';
/* UNITY 0.13.41 — audit-friendly decision support, not a broker or
   a substitute for verified issuer disclosures and current bid/ask prices.
   Three independent layers: technical test-simulation, fundamental
   investment review, and real-order approval (always unavailable). */
const UNITY_POLICY_VERSION='UNITY Decision Policy 1.0';
function unityPolicyNum(x){return x===null||x===undefined||x===''?NaN:Number(x)}
function unityPolicyClamp(n){return Math.max(0,Math.min(100,n))}
function unityPolicyFmt(n,d=1){return Number.isFinite(n)?n.toFixed(d).replace('.',','):'–'}
function unityPolicyPercent(n){return Number.isFinite(n)?(n>0?'+':'')+unityPolicyFmt(n,1)+' %':'–'}
function unityDeepMarketStats(item){
  const ps=item?.points;
  if(!Array.isArray(ps)||ps.length<200)return null;
  const a=ps.map(x=>Number(x.close));
  if(a.some(v=>!(v>0)||!Number.isFinite(v)))return null;
  const last=a.at(-1),past=n=>a.length>n?a.at(-n-1):NaN;
  const returns=Array.from({length:Math.min(20,a.length-1)},(_,i)=>{
    const k=a.length-1-i;
    return Math.log(a[k]/a[k-1]);
  });
  const avg=returns.reduce((s,v)=>s+v,0)/returns.length;
  const variance=returns.reduce((s,v)=>s+(v-avg)**2,0)/returns.length;
  const vol20=Math.sqrt(variance)*Math.sqrt(252)*100;
  const window=a.slice(-Math.min(252,a.length));
  let high=0,maxDrawdown=0;
  for(const value of window){high=Math.max(high,value);maxDrawdown=Math.max(maxDrawdown,(high-value)/high*100)}
  const ret=n=>Number.isFinite(past(n))?(last/past(n)-1)*100:NaN;
  const riskPerShare=last*(vol20/100)/Math.sqrt(252)*2.5; // scenario only; not ATR
  const scenarioStop=last-riskPerShare,scenarioTarget=last+riskPerShare*2.5;
  return {last,ret21:ret(21),ret63:ret(63),ret252:ret(252),
    vol20,maxDrawdown,scenarioStop:scenarioStop>0?scenarioStop:NaN,
    scenarioTarget:Number.isFinite(scenarioTarget)?scenarioTarget:NaN,
    scenarioRR:Number.isFinite(scenarioStop)&&scenarioStop>0&&riskPerShare>0?2.5:NaN};
}
function unityDeepPeerMedian(s,item){
  // The median of distinct, comparable 63-session local-currency returns
  // is a *universe comparison*, never an ETF benchmark or capital-flow signal.
  const items=Object.values(typeof unityMarket!=='undefined'?unityMarket?.items||{}:{});
  const values=[],seen=new Set();
  for(const x of items){
    const id=String(x?.isin||x?.providerSymbol||'').toUpperCase();
    if(!id||seen.has(id)||x.dynamicExperimental||x.currency!==s.currency)continue;
    seen.add(id);
    if(x===item||id===String(s.isin||s.providerSymbol||'').toUpperCase())continue;
    if(typeof unityDataQuality==='function'&&!unityDataQuality(x,x.isin||('@'+x.providerSymbol)).canCompare)continue;
    const p=unityDeepMarketStats(x);
    if(Number.isFinite(p?.ret63))values.push(p.ret63);
  }
  if(values.length<5)return {count:values.length,median:NaN};
  values.sort((a,b)=>a-b);
  return {count:values.length,median:values.length%2?values[(values.length-1)/2]:(values[values.length/2-1]+values[values.length/2])/2};
}
function unityDeepFilingEvidence(s){
  const f=typeof unityFundPilotItem==='function'?unityFundPilotItem(s):null;
  const period=f?.latestFiling?.periodEnd,age=Date.parse(period||'');
  const validPeriod=Number.isFinite(age)&&age<=Date.now()&&Date.now()-age<=560*86400000;
  const ratios={};
  for(const k of ['revenueGrowth','netIncomeGrowth','equityRatio','netMargin','operatingCashFlowMargin']){
    const v=f?.derived?.[k];
    if(validPeriod&&v?.unit==='percent'&&v.periodEnd===period&&
      (!v.priorPeriodEnd||v.priorPeriodEnd===f?.priorFiling?.periodEnd)&&
      Number.isFinite(unityPolicyNum(v.value)))ratios[k]=Number(v.value);
  }
  const count=Object.keys(ratios).length;
  // Only non-stale, source-checked filings, not stand-alone press release headlines.
  const checked=Date.parse(f?.checkedAt||'');
  const verified=!!f&&f.status==='metrics-partial'&&!!f.latestFiling?.reportUrl&&
    /^https:\/\/filings\.xbrl\.org\//.test(f.latestFiling.reportUrl)&&
    Number.isFinite(checked)&&Date.now()-checked<35*86400000&&validPeriod&&count>=4;
  const score=count>=4?unityPolicyClamp(Math.round(
    35+(ratios.revenueGrowth||0)*1.3+(ratios.netIncomeGrowth||0)*.65+
    (ratios.equityRatio||0)*.35+(ratios.netMargin||0)*.75+
    (ratios.operatingCashFlowMargin||0)*.45)):NaN;
  return {verified,count,score,ratios,period:period||'',source:f?.latestFiling?.reportUrl||'',
    status:f?.status||'Keine vergleichbaren Unternehmensberichte'};
}
function unityDeepDecision(s,base=null,candidate=null){
  const a=base||(typeof unityCalc==='function'?unityCalc(s):null);
  const c=candidate||(typeof unityCandidate==='function'?unityCandidate(s):null);
  const quote=typeof unityMarketForStock==='function'?unityMarketForStock(s):
    typeof unityMarketItem==='function'?unityMarketItem(s.isin):null;
  const stat=unityDeepMarketStats(quote),filing=unityDeepFilingEvidence(s);
  const date=String(quote?.date||''),age=typeof unityBusinessDaysSince==='function'?unityBusinessDaysSince(date):Infinity;
  const quality=quote&&typeof unityDataQuality==='function'?unityDataQuality(quote,s.isin||('@'+s.providerSymbol)):null;
  const usable=!!quote&&!quote.dynamicExperimental&&quote.currency===s.currency&&!!quality?.canCompare&&age<=2;
  const technical=usable&&!!stat&&!!a?.t&&a.t.n>=200;
  const peer=usable?unityDeepPeerMedian(s,quote):{count:0,median:NaN};
  const rs=stat&&Number.isFinite(peer.median)?stat.ret63-peer.median:NaN;
  const problems=[],positives=[],missing=[];
  const add=(type,entry)=>({problems,positives,missing}[type]).push(entry);
  if(!usable)add('missing','Aktueller, plausibler und dem Wertpapier zugeordneter Tageskurs fehlt oder ist nur experimentell verfügbar.');
  if(!stat||!technical)add('missing','Mindestens 200 gültige Börsentage für die technische Tiefenanalyse erforderlich.');
  if(!filing.verified)add('missing','Vollständige aktuelle, überprüfte Unternehmensberichte sind nicht für alle Kennzahlen verfügbar.');
  if(!Number.isFinite(a?.score))add('missing','Vollständiger UNITY-Investmentscore fehlt: Bewertung, Finanzkennzahlen, Kapitalflüsse oder Vergleichsalternativen nicht belegt.');
  // Issuer evidence may confirm an earnings date without pretending that every
  // deep filing / valuation condition is fulfilled. A near event always vetoes
  // the technical test-decision.
  let issuerEvidence=null;
  try{issuerEvidence=typeof unityIssuerDecisionEvidence==='function'?unityIssuerDecisionEvidence(s):null}catch(_){}
  const confirmedEarnings=!!a?.f?.earningsConfirmed||issuerEvidence?.earnings?.confirmed===true;
  const earningsDate=a?.f?.earningsDate||issuerEvidence?.earnings?.date||'';
  if(!confirmedEarnings||!Number.isFinite(Date.parse(earningsDate)))
    add('missing','Nächster Earnings-Termin nicht bestätigt.');
  const earningsDays=Date.parse(earningsDate);
  const nearEarnings=confirmedEarnings&&Number.isFinite(earningsDays)&&earningsDays>=Date.now()-86400000&&earningsDays-Date.now()<7*86400000;
  if(nearEarnings)add('problems','Bestätigte Ergebnisveröffentlichung innerhalb von sieben Tagen: aktives Ereignisrisiko.');
  if(technical){
    if(a.t.last>=a.t.ma200&&a.t.ma50>=a.t.ma200)add('positives','Langfristiger Aufwärtstrend (Kurs/SMA50 über SMA200).');
    else add('problems','Kein bestätigter langfristiger Aufwärtstrend.');
    if(a.t.rsi>=40&&a.t.rsi<=68)add('positives','RSI liegt im definierten Einstiegskorridor (40–68).');
    else add('problems','RSI außerhalb des günstigen Einstiegskorridors.');
    if(stat.vol20>=70)add('problems','Sehr hohe annualisierte 20-Tage-Volatilität (mindestens 70 %).');
    else add('positives','20-Tage-Kursvolatilität unter dem Risikoschwellenwert.');
    if(stat.maxDrawdown>=35)add('problems','Historischer Rückgang in der Vergleichsperiode mindestens 35 %.');
    if(Number.isFinite(rs)){
      if(rs>=-5)add('positives','63-Tage-Rendite liegt nahe oder über der Medianrendite der vergleichbaren Werte.');
      else add('problems','63-Tage-Rendite liegt mehr als fünf Prozentpunkte unter dem Vergleichsmedian.');
    }else add('missing','Für diesen Börsenwährungsraum fehlen fünf vergleichbare gültige Kursreihen für Relative Stärke.');
  }
  const rr=Number.isFinite(a?.rr)?a.rr:NaN;
  if(Number.isFinite(rr)&&rr<2)add('problems','Harte UNITY-Regel: hinterlegtes Chance-Risiko-Verhältnis unter 2:1.');
  else if(!Number.isFinite(rr))add('missing','Belegter Stop und plausibles Kursziel fehlen. Ein Volatilitätsszenario ersetzt diese nicht.');
  if(filing.verified){
    if(filing.ratios.revenueGrowth>0)add('positives','Umsatz laut vergleichbaren Jahresabschlüssen gewachsen.');
    if(filing.ratios.equityRatio<20)add('problems','Eigenkapitalquote unter 20 %: Finanzierungsrisiko vertiefen.');
    if(filing.ratios.netIncomeGrowth<0)add('problems','Jahresüberschuss gegenüber Vorjahr rückläufig.');
  }
  const lower=technical?a.t.ma50*.98:NaN,upper=technical?a.t.ma50*1.02:NaN;
  const inZone=technical&&a.t.last>=lower&&a.t.last<=upper;
  const eligible=technical&&c?.status==='candidate'&&inZone&&
    a.t.rsi>=40&&a.t.rsi<=68&&stat.vol20<70&&stat.maxDrawdown<35&&
    (!Number.isFinite(rs)||rs>=-5)&&!nearEarnings&&(!Number.isFinite(rr)||rr>=2);
  // Full investment-review readiness needs sourced valuation and event checks,
  // not merely a positive chart. No automatic *real-trading* approval exists.
  const valuationReady=Number.isFinite(a?.parts?.valuation)&&Number.isFinite(a?.parts?.quality)&&
    Number.isFinite(a?.rr)&&a.rr>=2&&Number.isFinite(a?.score)&&a.score>=70&&
    Number.isFinite(a?.margin)&&a.margin>=10;
  const investmentReady=eligible&&filing.verified&&valuationReady&&
    a?.f?.balanceChecked===true&&
    !(a?.checks?.hard||[]).length&&!(a?.checks?.data||[]).length&&
    !!a?.f?.guidanceChecked&&confirmedEarnings&&
    Number.isFinite(earningsDays)&&earningsDays>Date.now()+7*86400000&&
    !!a?.f?.dataSource?.trim()&&!!a?.f?.thesis?.trim()&&!!a?.f?.risks?.trim();
  let kind='data',decision='OFFEN – Daten prüfen',reason='Die Datenlage reicht für eine belastbare Entscheidung nicht aus.';
  if(technical){
    if(Number.isFinite(rr)&&rr<2){kind='no';decision='NEIN – Chance/Risiko ungünstig';reason='UNITY-Hard-Rule unter 2:1.'}
    else if(nearEarnings){kind='wait';decision='ABWARTEN – Ergebnisrisiko';reason='Bestätigte Ergebnisveröffentlichung am '+String(earningsDate).slice(0,10)+'. Technische Signale überstimmen dieses Veto nicht.'}
    else if(c?.status==='candidate'&&!inZone){kind='wait';decision='NEIN – Einstiegskurs abwarten';reason='Der Kurs liegt derzeit außerhalb der definierten SMA50-Kaufzone.'}
    else if(!eligible){kind='no';decision='NEIN – derzeit kein Einstieg';reason='Mindestens eine technische Risiko- oder Trendbedingung ist nicht erfüllt.'}
    else if(investmentReady){kind='positive';decision='JA – geprüften Einstieg im Testdepot prüfen';reason='Technik, Bewertung, dokumentierte Unternehmenskennzahlen, Earnings und Risikoregeln erfüllen die hinterlegten Kriterien. Keine reale Orderfreigabe.'}
    else {kind='technical';decision='JA – technischer Testkauf prüfenswert';reason='Die technischen Einstiegskriterien sind erfüllt. Eine fundamentale Kaufempfehlung bleibt wegen offener Quellen- und Bewertungsfragen ausdrücklich aus.'}
  }
  const totalSources=[usable,filing.verified,valuationReady,
    confirmedEarnings&&Number.isFinite(earningsDays)&&earningsDays>Date.now()+7*86400000,
    Number.isFinite(rr)&&rr>=2,Number.isFinite(rs)];
  const coverage=totalSources.filter(Boolean).length;
  const confidence=coverage>=6?'Hoch (nur für die modellierten Bedingungen)':coverage>=4?'Mittel':'Eingeschränkt';
  return {version:UNITY_POLICY_VERSION,s,kind,decision,reason,positives,problems,missing,
    technicalEligible:eligible,investmentReady,realOrderApproved:false,simulationPossible:true,
    sourceDate:date||'–',vol20:stat?.vol20??NaN,drawdown:stat?.maxDrawdown??NaN,
    ret63:stat?.ret63??NaN,relativeStrength:rs,peerCount:peer.count,
    scenarioStop:stat?.scenarioStop??NaN,scenarioTarget:stat?.scenarioTarget??NaN,
    scenarioRR:stat?.scenarioRR??NaN,
    entryLower:lower,entryUpper:upper,filing,investmentScore:a?.score??NaN,
    candidateScore:c?.score??NaN,rr,confidence,coverage,totalChecks:totalSources.length,
    valuationReady,quoteVerified:usable,nearEarnings,earningsDate:earningsDate||''};
}

// Post-purchase monitor: compares the immutable test-buy snapshot with the
// current sourced analysis. It never books a sale and a negative P/L alone is
// deliberately not an exit signal.
function unityPositionMonitor(s){
  let position=null;
  try{position=typeof depotPosition==='function'?depotPosition(s):null}catch(_){}
  if(!position||!(Number(position.qty)>1e-8))return null;
  const buys=(cache?.transactions||[]).filter(t=>!t.voidedAt&&t.instrumentId===s.id&&t.type==='BUY')
    .sort((a,b)=>String(a.executedAt||'').localeCompare(String(b.executedAt||'')));
  const opened=buys[0]||null,snapshot=opened?.decisionSnapshot||null;
  const current=typeof unityDeepDecision==='function'?unityDeepDecision(s):null;
  const pnlPct=Number.isFinite(position.pnl)&&position.cost>0?position.pnl/position.cost*100:NaN;
  // A new-entry result is not an exit condition for an existing position.
  // Reducing/exiting requires explicit, source-bound deterioration evidence.
  let issuerRisk=null;
  try{issuerRisk=typeof unityIssuerDecisionEvidence==='function'?unityIssuerDecisionEvidence(s)?.positionRisk||null:null}catch(_){}
  const fundamentalExit=issuerRisk?.verified===true&&
    ['guidance-cut','thesis-broken','fundamental-deterioration'].includes(String(issuerRisk.kind||''));
  let kind='data',label='Daten prüfen',reason='Für die bestehende Testposition fehlt eine ausreichend aktuelle, vollständige Beurteilung.';
  if(fundamentalExit){
    kind='exit';label='Ausstieg im Testdepot erwägen';
    reason='Belegte fundamentale Verschlechterung: '+String(issuerRisk.label||'Unternehmensrisiko prüfen')+'.';
  }else if(current?.nearEarnings){
    kind='review';label='Prüfen – Ergebnisrisiko';
    reason='Vor dem bestätigten Ergebnis '+String(current.earningsDate||'').slice(0,10)+' keine technische Lage als Verkaufs- oder Haltebeweis überinterpretieren.';
  }else if(current?.kind==='no'){
    kind='review';label='Prüfen – technische Lage schwächer';
    reason='Aktueller Befund: '+current.decision+'. Dies ist kein Ausstiegssignal; die Kaufthese bleibt ohne belegte fundamentale Verschlechterung offen.';
  }else if(current?.kind==='wait'){
    kind='review';label='Prüfen – These erneut abgleichen';
    reason='Aktueller Befund: '+current.decision+'. Ein technischer Rückgang allein ist kein Ausstiegssignal.';
  }else if(current?.kind==='technical'||current?.kind==='positive'){
    kind='hold';label='Halten – Lage weiter überwachen';
    reason='Die aktuelle technische Lage liefert kein aktives Ausstiegs-Veto. Bewertung, neue Ergebnisse und Guidance bleiben getrennt zu prüfen.';
  }
  return {kind,label,reason,current,opened,snapshot,pnlPct,fundamentalExit,issuerRisk,
    openedAt:String(opened?.executedAt||'').slice(0,10),
    currentDate:String(current?.sourceDate||'').slice(0,10)};
}
function unityPositionMonitorPanel(s){
  const m=unityPositionMonitor(s);if(!m)return '';
  const f=typeof esc==='function'?esc:v=>String(v??'');
  const cls={hold:'hold',review:'review',exit:'exit',data:'data'}[m.kind]||'data';
  const snapshot=m.snapshot?.action||'Kein analysierter Kauf-Snapshot vorhanden';
  const current=m.current?.decision||'Aktuelle Tiefenanalyse nicht vollständig';
  const pnl=Number.isFinite(m.pnlPct)?(m.pnlPct>0?'+':'')+m.pnlPct.toLocaleString('de-DE',{minimumFractionDigits:2,maximumFractionDigits:2})+' %':'–';
  return '<section class="unity-position-monitor unity-position-'+cls+'"><div><small>UNITY · Positionsmonitor nach Testkauf</small><h3>'+f(m.label)+'</h3></div>'+
    '<p>'+f(m.reason)+'</p><div class="unity-position-monitor-grid"><div><small>Kauf-Snapshot</small><b>'+f(m.openedAt||'–')+'</b><small>'+f(snapshot)+'</small></div>'+
    '<div><small>Aktueller Befund</small><b>'+f(m.currentDate||'–')+'</b><small>'+f(current)+'</small></div>'+
    '<div><small>Offener Erfolg</small><b>'+f(pnl)+'</b><small>Allein kein Verkaufsgrund</small></div></div>'+
    '<p class="tiny muted">Der Monitor vergleicht den historischen Testkauf mit der aktuellen Analyse, verändert den Kauf-Snapshot nicht und löst keinen Verkauf aus. „Ausstieg im Testdepot erwägen“ ist ein dokumentierter Prüfhinweis, keine Orderanweisung.</p></section>';
}

function unityDeepSimPosition(s,d){
  if(!['technical','positive'].includes(d?.kind)||!(d?.scenarioStop>0)||
     typeof depotCapital!=='function')return null;
  const cap=depotCapital(),price=typeof unityDisplayQuote==='function'?unityDisplayQuote(s)?.price:NaN;
  const rate=typeof unityEuroRate==='function'?unityEuroRate(s.currency):null;
  const px=Number(price),fx=Number(rate?.rate),diff=(px-d.scenarioStop)*fx;
  if(!(cap?.configured&&cap.total>0&&cap.free>0&&px>0&&fx>0&&diff>0))return null;
  const atRisk=cap.total*.01,positionCap=cap.total*.05;
  const units=Math.floor(Math.min(atRisk/diff,positionCap/(px*fx),cap.free/(px*fx))*10000)/10000;
  return units>0?{units,amount:units*px*fx,loss:units*diff,atRisk,positionCap}:null;
}
function unityDeepDecisionPanel(s,base=null,candidate=null){
  const d=unityDeepDecision(s,base,candidate);
  const escf=typeof esc==='function'?esc:v=>String(v??'');
  const money=v=>Number.isFinite(v)?unityPolicyFmt(v,2)+' '+escf(s.currency):'–';
  const size=unityDeepSimPosition(s,d);
  const pill=d.kind==='positive'?'positive':d.kind==='technical'?'technical':d.kind==='no'?'negative':d.kind==='wait'?'wait':'data';
  let h='<section class="panel unity-policy-card unity-policy-'+pill+'" aria-label="Automatische UNITY-Entscheidungshilfe">'+
    '<div class="unity-policy-top"><div><small>UNITY Tiefenanalyse · Entscheidungsstufe</small><h2>Entscheidung jetzt</h2></div><span class="unity-policy-stage">'+escf(d.confidence)+' · '+d.coverage+'/'+d.totalChecks+' vertiefte Prüfungen</span></div>'+
    '<strong class="unity-policy-action">'+escf(d.decision)+'</strong>'+
    '<p>'+escf(d.reason)+'</p>'+
    '<div class="unity-policy-metrics">'+
    '<div><small>Technische Einstiegszone</small><b>'+ (Number.isFinite(d.entryLower)?money(d.entryLower)+' bis '+money(d.entryUpper):'–')+'</b></div>'+
    '<div><small>UNITY-Gesamtscore</small><b>'+(Number.isFinite(d.investmentScore)?unityPolicyFmt(d.investmentScore,0)+'/100':'Nicht vollständig')+'</b></div>'+
    '<div><small>Relative Stärke (63 Tage)</small><b>'+unityPolicyPercent(d.relativeStrength)+'</b><small>'+ (Number.isFinite(d.relativeStrength)?'Gegen Median '+d.peerCount+' anderer Titel derselben Handelswährung':'Vergleichsdaten fehlen')+'</small></div>'+
    '<div><small>20-Tage-Volatilität, annualisiert</small><b>'+unityPolicyPercent(d.vol20)+'</b></div>'+
    '<div><small>Max. Rückgang (bis 252 Sitzungen)</small><b>'+unityPolicyPercent(d.drawdown)+'</b></div>'+
    '<div><small>Dokumentiertes Chance/Risiko</small><b>'+ (Number.isFinite(d.rr)?unityPolicyFmt(d.rr,2)+':1':'Nicht belegt')+'</b></div>'+
    '</div>'+
    '<details class="unity-policy-evidence" open><summary>Warum dieses Ergebnis?</summary>'+
    '<p><b>Positive Befunde</b></p><ul>'+(d.positives.length?d.positives.map(x=>'<li>'+escf(x)+'</li>').join(''):'<li>Keine ausreichend bestätigten positiven Befunde.</li>')+'</ul>'+
    '<p><b>Risiken / Gegenargumente</b></p><ul>'+(d.problems.length?d.problems.map(x=>'<li>'+escf(x)+'</li>').join(''):'<li>Keine zusätzliche technische Warnung erkannt.</li>')+'</ul>'+
    '<p><b>Noch fehlende Informationen</b></p><ul>'+(d.missing.length?d.missing.map(x=>'<li>'+escf(x)+'</li>').join(''):'<li>Keine Pflichtangaben aus diesem Prüfmodell offen.</li>')+'</ul></details>';
  if(size){
    h+='<div class="unity-policy-sizing"><b>Konservatives Testdepot-Szenario: '+unityPolicyFmt(size.units,4)+' Stück</b>'+
      '<small>Ca. '+unityPolicyFmt(size.amount,2)+' € Einsatz · modelliertes Risiko '+unityPolicyFmt(size.loss,2)+' €; Grenzen: 1 % Vermögensrisiko, 5 % Positionsanteil und freies Kapital.</small></div>';
  }
  if(d.kind==='positive'||d.kind==='technical')
    h+='<button type="button" class="unity-policy-testbuy" data-policy-testbuy="'+escf(s.id)+'">Fiktiven Kauf vorbereiten</button>';
  if(Number.isFinite(d.scenarioStop)&&Number.isFinite(d.scenarioTarget))
    h+='<details class="unity-policy-scenario"><summary>Zusätzliche Volatilitäts-Simulation</summary>'+
      '<p>Rechnerisches Test-Szenario aus 20-Tage-Schlusskursvolatilität: Stop '+money(d.scenarioStop)+
      ' · Ziel '+money(d.scenarioTarget)+' · modelliertes Verhältnis 2,5:1.</p>'+
      '<p class="tiny muted">Weder ATR (kein Tageshoch/-tief vorhanden) noch ein validiertes Kursziel. Kein Ersatz für Fundamentalanalyse oder Risikoentscheidung.</p></details>';
  return h+'<p class="tiny muted">JA bedeutet hier allenfalls einen fiktiven Testkauf nach den jeweils genannten Kriterien. Eine reale Kauf-Freigabe oder automatische Order ist ausgeschlossen. Kein Börsenkurs ist als Echtzeit garantiert. Zuletzt verfügbare technische Quelle: '+escf(d.sourceDate)+'.</p></section>';
}
