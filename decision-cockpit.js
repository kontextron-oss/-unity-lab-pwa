'use strict';
/* UNITY decision cockpit v0.13.53
 * Three intentionally separate horizons: fundamental evidence, technical
 * setup, and a SHORT-TERM PRICE/VOLUME BEHAVIOR proxy. No guessed social
 * sentiment, institutional holdings, ETF fund flows, valuation or headlines.
 * The triage index is NOT a probability, an investment score or a price target.
 * No direct trading, no silent mutations of existing ledger/portfolio data.
 */
const UNITY_COCKPIT_VERSION='1.0';
function unityCockpitFinite(x){return typeof x==='number'&&Number.isFinite(x)}
function unityCockpitPct(now,before){return now>0&&before>0?(now/before-1)*100:NaN}
function unityCockpitMarket(item){
  const points=item?.points||[];
  if(!Array.isArray(points)||points.length<200)return null;
  const closes=points.map(p=>Number(p?.close));
  if(closes.some(p=>!(p>0)||!Number.isFinite(p)))return null;
  const last=closes.at(-1),ma=n=>closes.slice(-n).reduce((a,b)=>a+b,0)/n;
  let gains=0,losses=0;
  for(let i=closes.length-14;i<closes.length;i++){
    const d=closes[i]-closes[i-1];
    gains+=Math.max(0,d);losses+=Math.max(0,-d);
  }
  const rsi=losses===0?(gains===0?50:100):100-100/(1+gains/losses);
  const pct=n=>closes.length>n?unityCockpitPct(last,closes.at(-n-1)):NaN;
  const sma50=ma(50),sma200=ma(200),extension=unityCockpitPct(last,sma50);
  const rets=[];
  for(let i=closes.length-20;i<closes.length;i++)
    rets.push(Math.log(closes[i]/closes[i-1]));
  const mean=rets.reduce((a,b)=>a+b,0)/rets.length;
  const variance=rets.reduce((a,b)=>a+(b-mean)*(b-mean),0)/rets.length;
  const vol20=Math.sqrt(variance)*Math.sqrt(252)*100;
  // Only compare truly observed valid volumes; no fabricated trade-volume data.
  const volumes=points.slice(-21).map(x=>Number(x.volume));
  const volumeOk=volumes.length===21&&volumes.every(x=>Number.isFinite(x)&&x>0);
  const avgVolume=volumeOk?volumes.slice(0,20).reduce((a,b)=>a+b,0)/20:NaN;
  const volumeRatio=volumeOk&&avgVolume>0?volumes.at(-1)/avgVolume:NaN;
  const trend=last>=sma200&&sma50>=sma200;
  const overheated=rsi>=76||(extension>13&&pct(5)>7);
  const stressed=pct(5)<-10&&vol20>40;
  let mood='Uneinheitliches Kursverhalten';
  if(overheated)mood='Mögliches Übertreibungsrisiko';
  else if(stressed)mood='Starker kurzfristiger Verkaufsdruck';
  else if(trend&&rsi>=40&&rsi<=68)mood='Positiver Trend, keine extreme Überhitzung';
  else if(!trend)mood='Mittelfristiger Trend nicht bestätigt';
  return {last,date:item.date,r5:pct(5),r21:pct(21),r63:pct(63),r252:pct(252),
    sma50,sma200,rsi,extension,vol20,volumeRatio,volumeOk,
    trend,inZone:last>=sma50*.98&&last<=sma50*1.02,
    overheated,stressed,mood};
}
function unityCockpitNews(s){
  // An official dated filing is only a reason to CHECK the original document,
  // never a positive or negative sentiment signal.
  try{return typeof unityResearchRecent==='function'?unityResearchRecent(s):null}
  catch(_){return null}
}
function unityCockpitInputs(stock){
  let item=null,marketOk=false,fundamentalOk=false,filing=null;
  try{
    item=typeof unityMarketForStock==='function'?unityMarketForStock(stock):null;
    const quality=item&&typeof unityDataQuality==='function'?
      unityDataQuality(item,stock.isin||('@'+stock.providerSymbol)):null;
    marketOk=!!item&&item.currency===stock.currency&&!item.dynamicExperimental&&quality?.canCompare===true;
  }catch(_){}
  const market=marketOk?unityCockpitMarket(item):null;
  try{
    if(typeof unityDeepFilingEvidence==='function'){
      filing=unityDeepFilingEvidence(stock);
      fundamentalOk=filing?.verified===true;
    }
  }catch(_){}
  let f=null;
  try{f=(cache.fundamentals||[]).find(x=>x.id===stock.id)||null}catch(_){}
  return {market,marketOk:marketOk&&!!market,filing,fundamentalOk,f,official:unityCockpitNews(stock)};
}
function unityCockpitClassify(input){
  const {market,marketOk,fundamentalOk,f,official}=input;
  const evidence=[],warnings=[],missing=[];
  const stamp=market?.date||'';
  if(!marketOk||!market){
    return {kind:'data',action:'Daten prüfen',priority:NaN,coverage:0,confidence:'Keine aktuelle Kursbasis',
      mood:'Nicht beurteilbar',short:'Marktstimmung nicht gemessen',stamp,
      evidence:[],warnings:[],missing:['Mindestens 200 gültige, aktuelle und der Aktie zugeordnete Schlusskurse fehlen.'],
      gates:{market:false,fundamental:!!fundamentalOk,earnings:false,valuation:false,flows:false},
      socialSentimentMeasured:false,institutionalFlowsMeasured:false};
  }
  const earningsTime=Date.parse(f?.earningsDate||'');
  const earningsKnown=f?.earningsConfirmed===true&&Number.isFinite(earningsTime)&&
    earningsTime>=Date.now()-86400000;
  const upcoming=earningsKnown&&earningsTime-Date.now()<7*86400000;
  const stop=Number(f?.stop),target=Number(f?.target);
  const rr=stop>0&&stop<market.last&&target>market.last?
    (target-market.last)/(market.last-stop):NaN;
  const rrBad=Number.isFinite(rr)&&rr<2;
  // Valuation may only be qualified by the existing deep source/evidence gate.
  let fundamentalReady=false,investmentReady=false;
  if(fundamentalOk&&typeof unityDeepDecision==='function'&&input.stock){
    try{
      const deep=unityDeepDecision(input.stock);
      fundamentalReady=deep?.valuationReady===true;
      investmentReady=deep?.investmentReady===true;
    }catch(_){}
  }
  if(market.trend)evidence.push('Langfristiger Kurstrend oberhalb SMA200 mit SMA50-Bestätigung.');
  else warnings.push('Langfristiger Kursaufwärtstrend nicht bestätigt.');
  if(market.inZone)evidence.push('Schlusskurs liegt innerhalb der definierten SMA50-Zone (±2 %).');
  if(fundamentalOk)evidence.push('Jüngere Unternehmenszahlen aus geprüfter Primärquelle vorhanden.');
  else missing.push('Vergleichbare, aktuelle geprüfte Bilanz-/Ergebnisdaten fehlen.');
  if(!earningsKnown)missing.push('Nächster Earnings-Termin nicht verlässlich bestätigt.');
  if(official)evidence.push('Neue amtliche Unternehmensmeldung – Inhalt und Wirkung noch ungeprüft.');
  if(!Number.isFinite(rr))missing.push('Plausible Stop-/Zielannahmen für das Chancen-Risiko-Verhältnis fehlen.');
  if(!fundamentalReady)missing.push('Belastbare Bewertung/Sicherheitsmarge nicht vollständig verifiziert.');
  missing.push('Institutionelle Aktienkapitalflüsse nicht direkt gemessen.');
  missing.push('Soziale Medien / Nachrichtenstimmung nicht unabhängig gemessen.');
  if(upcoming)warnings.push('Bestätigter Earnings-Termin innerhalb von sieben Tagen.');
  if(rrBad)warnings.push('Chance-Risiko-Hard-Rule unter 2:1.');
  if(market.overheated)warnings.push('Preis-/Momentumindikatoren zeigen ein kurzfristiges Übertreibungsrisiko.');
  if(market.stressed)warnings.push('Starker kurzfristiger Kursrückgang mit hoher Volatilität.');
  const setup=market.trend&&market.inZone&&market.rsi>=40&&market.rsi<=68;
  const priority=Math.max(0,Math.min(100,Math.round(
    (market.trend?40:12)+(market.inZone?30:0)+
    (market.rsi>=40&&market.rsi<=68?15:market.rsi<35?3:0)+
    (Number.isFinite(market.r63)&&market.r63>0?10:0)+
    (market.vol20<=50?5:0))));
  // Priority = price-based review order, NOT a surrogate quality/flows score.
  let kind='wait',action='Beobachten – aktuell kein Einstiegssignal';
  if(rrBad){kind='blocked';action='Nicht favorisieren – Chance/Risiko zu ungünstig';}
  else if(upcoming){kind='blocked';action='Ereignisrisiko – Ergebnis abwarten';}
  else if(market.overheated){kind='blocked';action='Übertreibung möglich – Rücksetzer abwarten';}
  else if(market.stressed){kind='blocked';action='Verkaufsdruck – Stabilisierung abwarten';}
  else if(!market.trend){kind='wait';action='Abwarten – Trend nicht bestätigt';}
  else if(!setup){kind='watch';action='Beobachten – Einstiegszone abwarten';}
  else if(investmentReady&&fundamentalReady&&earningsKnown&&!rrBad){
    kind='investment';action='Favorit für geprüfte, fiktive Kaufentscheidung';
  }else{kind='review';action='Favorit für vertiefte Prüfung – kein Kaufurteil';}
  const checks=[marketOk,fundamentalOk,earningsKnown,fundamentalReady];
  const coverage=checks.filter(Boolean).length;
  const confidence=coverage===4?'Teilweise fundiert · Kapital- und Stimmungsdaten fehlen':
    coverage>=2?'Mittel bis gering · relevante Quellen fehlen':'Eingeschränkt · überwiegend Kurstechnik';
  const short='Kurssignal: '+market.mood+
    (market.volumeOk?' · Volumen heute relativ zum vorherigen 20-Tage-Mittel: '+
      market.volumeRatio.toFixed(2)+'×':' · Handelsvolumen nicht auswertbar')+
    '. Kein gemessenes Medien- oder Anleger-Sentiment.';
  return {kind,action,priority,coverage,confidence,mood:market.mood,short,stamp,
    evidence,warnings,missing,rr,setup,
    gates:{market:marketOk,fundamental:fundamentalOk,earnings:earningsKnown,
      valuation:fundamentalReady,flows:false},
    socialSentimentMeasured:false,institutionalFlowsMeasured:false};
}
function unityCockpitForStock(s){
  if(!s)return null;
  const inputs=unityCockpitInputs(s);
  return {...unityCockpitClassify({...inputs,stock:s}),stock:s,market:inputs.market,
    event:inputs.official||null};
}
function unityCockpitSorted(){
  if(typeof stocks!=='function')return [];
  const priority={investment:0,review:1,watch:2,wait:3,blocked:4,data:5};
  return stocks().map(unityCockpitForStock).filter(Boolean).sort((a,b)=>{
    const group=(priority[a.kind]??6)-(priority[b.kind]??6);
    if(group)return group;
    const aP=Number.isFinite(a.priority)?a.priority:-1,bP=Number.isFinite(b.priority)?b.priority:-1;
    return bP-aP||String(a.stock.name||'').localeCompare(String(b.stock.name||''),'de');
  });
}
function unityCockpitPanel(s){
  const d=unityCockpitForStock(s),m=d?.market;
  if(!d)return '';
  const f=typeof esc==='function'?esc:v=>String(v||'');
  const fmt=v=>Number.isFinite(v)?new Intl.NumberFormat('de-DE',{maximumFractionDigits:1}).format(v):'–';
  const evidence=[...d.evidence,...d.warnings];
  return '<section class="panel unity-cockpit-detail"><h2>UNITY Entscheidungsmoderator</h2>'+
    '<p class="tiny muted">Drei Zeithorizonte, eine nachvollziehbare Priorisierung. '+
    'Keine historische Trefferquote oder institutionelle Kapitalbewegung wird unterstellt.</p>'+
    '<strong class="unity-cockpit-action">'+f(d.action)+'</strong>'+
    '<div class="unity-cockpit-metrics">'+
    '<div><small>Prüfpriorität, nur Kurstechnik</small><b>'+
       (Number.isFinite(d.priority)?d.priority+'/100':'Nicht bewertbar')+'</b></div>'+
    '<div><small>Fundamentale Evidenz</small><b>'+(d.gates.fundamental?'Bericht geprüft':'Noch unvollständig')+'</b></div>'+
    '<div><small>Marktpsychologie-Proxy</small><b>'+f(m?.mood||'Nicht messbar')+'</b></div>'+
    '<div><small>5 / 21 / 63 Handelstage</small><b>'+
       (m?[m.r5,m.r21,m.r63].map(x=>fmt(x)+' %').join(' · '):'–')+'</b></div>'+
    '</div>'+
    '<p class="tiny muted">'+f(d.short)+'</p>'+
    '<p class="tiny muted"><b>Konfidenz:</b> '+f(d.confidence)+' · Kursstichtag: '+f(d.stamp||'nicht vorhanden')+'</p>'+
    (d.event?'<p class="tiny muted">Neue amtliche Meldung vom '+f(d.event.filedAt)+
      ': neutraler Prüfhinweis, keine bestätigte Kurswirkung.</p>':'')+
    '<details><summary>Begründung, Gegenargumente und fehlende Daten</summary>'+
    '<h4>Belegte Befunde</h4><ul>'+(d.evidence.map(x=>'<li>'+f(x)+'</li>').join('')||'<li>Keine hinreichenden Belege.</li>')+'</ul>'+
    '<h4>Risiken</h4><ul>'+(d.warnings.map(x=>'<li>'+f(x)+'</li>').join('')||'<li>Keine zusätzliche Warnung aus dem verfügbaren Kursmodell.</li>')+'</ul>'+
    '<h4>Fehlende Quellen</h4><ul>'+(d.missing.map(x=>'<li>'+f(x)+'</li>').join('')||'<li>Keine Datenlücken in dieser Vorprüfung.</li>')+'</ul></details>'+
    '<p class="tiny muted">Übertreibung und Verkaufsdruck sind deterministische Kurs-/Volumen-Proxys, kein aus Twitter, X, Reddit oder Nachrichten abgerufenes Sentiment. '+
    'Reale Handelsfreigaben bleiben ausgeschlossen; die bestehende UNITY-Tiefenanalyse behält ihre eigenen harten Veto-Regeln.</p></section>';
}
function unityCockpitOverview(){
  const list=unityCockpitSorted(),active=list.length;
  let html='<section class="panel unity-cockpit-overview"><h2>UNITY Entscheidungscockpit</h2>'+
    '<p>Automatisch sortierte Prüfaufgaben für die <b>gesamte Masterliste</b>. '+
    'Langfristiger Unternehmenswert, mittel- und kurzfristiger Markttrend und Marktpsychologie werden getrennt geprüft. '+
    'Die Liste ist <b>keine Rangfolge erwarteter Renditen</b>.</p>';
  if(!active)return html+'<p>Keine aktiven Aktien in der Masterliste.</p></section>';
  const count=k=>list.filter(x=>x.kind===k).length;
  html+='<div class="unity-cockpit-counts"><span>'+active+' Aktien geprüft</span>'+
    '<span>'+count('review')+' vorrangig vertiefen</span>'+
    '<span>'+count('investment')+' vollständig für Testentscheidung geprüft</span>'+
    '<span>'+count('data')+' ohne aktuelle Kursbasis</span></div>';
  const candidates=list.filter(x=>x.kind==='investment'||x.kind==='review').slice(0,4);
  if(!candidates.length)html+='<p class="unity-cockpit-no-buy">Derzeit kein ausreichend belegter Kandidat für eine positive vertiefte Prüfung. '+
    'Das ist ein gültiges Ergebnis – nicht die Aufforderung, einen Kauf zu erzwingen.</p>';
  else {
    html+='<h3>Maximal vier vorrangige Kandidaten</h3>';
    for(const x of candidates)html+='<div class="unity-cockpit-pick"><div><strong>'+
      esc(x.stock.name)+'</strong><small>'+esc(x.action)+'</small>'+
      '<small>Technische Prüfpriorität: '+x.priority+'/100 · '+esc(x.confidence)+'</small></div>'+
      '<button type="button" class="secondary" data-analyze="'+esc(x.stock.id)+'">Prüfen</button></div>';
  }
  html+='<details class="unity-cockpit-master"><summary>Alle '+active+' Aktien mit Priorität und Entscheidungsstatus anzeigen</summary>';
  for(const x of list)html+='<div class="unity-cockpit-pick"><div><strong>'+esc(x.stock.name)+'</strong>'+
    '<small>'+esc(x.action)+'</small>'+
    '<small>'+(Number.isFinite(x.priority)?x.priority+'/100 · ':'')+esc(x.confidence)+'</small></div>'+
    '<button type="button" class="secondary" data-analyze="'+esc(x.stock.id)+'">Analyse</button></div>';
  html+='</details><p class="tiny muted">Favorisierung basiert nur auf belegtem Preisverhalten und bestehenden Prüfregeln. '+
    'Ein vollständiges Investmenturteil verlangt separate verifizierte Unternehmenszahlen, Bewertung, Earnings, Chance/Risiko und nachprüfbare Ereignisquellen. '+
    'Ein hohes Medieninteresse ersetzt keine dieser Quellen.</p></section>';
  return html;
}
