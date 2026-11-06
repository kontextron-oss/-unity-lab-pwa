'use strict';
/* UNITY 0.15.0 – read-only diagnosis of SOURCE readiness versus adverse signals.
   No writes, no score fabrication, and no trade approval. Keep overview O(stocks). */
const UNITY_READINESS_PILOTS=[
  {isin:'CH0012221716',name:'ABB'},
  {isin:'FR0000121972',name:'Schneider Electric'},
  {isin:'DE000ENER6Y0',name:'Siemens Energy'},
  {isin:'DE0006231004',name:'Infineon'}
];
const UNITY_READINESS_LABELS={
  quote:'Tageskurs / Börsenplatz',history:'Kursreihe (200 Tage)',
  fx:'EUR-Umrechnung',filing:'Geprüfte Unternehmenszahlen',
  earnings:'Ergebnis-Termin',valuation:'Bewertungsgrundlage',
  guidance:'Guidance-Prüfung',thesis:'Investmentthese',
  risks:'Risiken und Widerlegung'
};
function unityReadinessEvidence(s){
  const fields={},missing=[],adverse=[];
  const set=(key,ok,detail,source='',stamp='',status='missing')=>{
    const kind=ok?'ready':status;
    fields[key]={key,label:UNITY_READINESS_LABELS[key],status:kind,detail:String(detail||''),source:String(source||''),stamp:String(stamp||'')};
    if(!ok)missing.push(fields[key]);
  };
  const q=typeof unityHomeQuote==='function'?unityHomeQuote(s):null;
  const x=q?.x||null,m=q?.m||null,quality=q?.quality||null;
  const quoteOk=!!x&&!!q?.valid&&Number(x.price)>0&&
    x.currency===s.currency&&!!String(x.exchange||s.exchange||'').trim();
  const quoteStatus=quality?.level==='stale'?'stale':quality?.level==='invalid'?'conflict':
    quality?.level==='warning'?'failed':'missing';
  set('quote',quoteOk,quoteOk?'Schlusskurs '+x.date+' · '+x.price+' '+x.currency:
    quality?.detail||'Keine aktuelle, plausible und passend zugeordnete Börsenreferenz',
    x?.source||x?.providerSymbol||'',x?.date||'',quoteStatus);
  const historyOk=quoteOk&&!!q?.technical&&Array.isArray(x?.points)&&x.points.length>=200;
  set('history',historyOk,historyOk?x.points.length+' gültige historische Beobachtungen':
    'Für die technische Prüfung werden mindestens 200 gültige Börsentage benötigt.',
    x?.source||'',x?.date||'',quoteStatus==='stale'?'stale':'missing');
  const fx=typeof unityEuroRate==='function'?unityEuroRate(s.currency):null;
  const fxOk=!!fx&&Number.isFinite(Number(fx.rate))&&Number(fx.rate)>0;
  set('fx',fxOk,fxOk?'EUR je '+s.currency+': '+Number(fx.rate).toFixed(5):
    'Für '+String(s.currency||'?')+' fehlt ein gültiger EUR-Umrechnungskurs.',
    fx?.source||'',fx?.date||'',fxOk?'ready':'missing');
  const report=typeof unityFundPilotItem==='function'?unityFundPilotItem(s):null;
  const filing=typeof unityDeepFilingEvidence==='function'?unityDeepFilingEvidence(s):null;
  const reportOk=filing?.verified===true;
  const reportStatus=String(report?.status||'kein Datensatz');
  const partial=Object.keys(report?.officialHighlights?.facts||{}).length;
  set('filing',reportOk,reportOk?'Vergleichbare, geprüfte Kennzahlen aus '+filing.period:
    'Status: '+reportStatus+(partial?' · '+partial+' Fakten aus Emittentenmeldung, aber kein vollständig geprüfter Bericht':'')+
    '. Fehlende/ungeprüfte Berichtskennzahlen sind kein negatives Unternehmensurteil.',
    filing?.source||report?.officialHighlights?.sourceUrl||'',filing?.period||report?.checkedAt||'',
    reportStatus==='source-unavailable'?'failed':'missing');
  const cal=typeof unityIssuerCalendarItem==='function'?unityIssuerCalendarItem(s):null;
  const calFresh=typeof unityIssuerCalendarFresh==='function'&&unityIssuerCalendarFresh();
  const manual=typeof cache!=='undefined'?(cache.fundamentals||[]).find(row=>row.id===s.id)||{}:{};
  const issuerDate=calFresh&&cal?.status==='confirmed-future-earnings'?String(cal.nextEarnings||''):'';
  const manualDate=manual.earningsConfirmed===true?String(manual.earningsDate||''):'';
  const earningsDate=issuerDate||manualDate;
  const earningsValid=/^\d{4}-\d{2}-\d{2}$/.test(earningsDate)&&
    Number.isFinite(Date.parse(earningsDate))&&Date.parse(earningsDate)>=Date.now()-86400000;
  const issuerConfirmed=!!issuerDate&&earningsValid;
  const earningsSource=issuerConfirmed?cal?.sourceUrl||'Offizielle Emittentenseite':
    manualDate?(manual.dataSource||'Manueller UNITY-Datensatz'):'';
  set('earnings',earningsValid,'Nächster Termin: '+(earningsValid?earningsDate:'nicht zuverlässig bestätigt')+
    (manualDate&&!issuerConfirmed?' (manuell hinterlegt)':''),
    earningsSource,cal?.checkedAt||'',cal&&!calFresh?'stale':'missing');
  if(earningsValid&&Date.parse(earningsDate)<Date.now()+7*86400000)
    adverse.push('Bestätigtes Ergebnisereignis in weniger als sieben Tagen');
  const required=['eps','bookValue','fairValue','roe','debtEquity','epsGrowth','fcfYield',
    'stop','target','flowScore','alternativesScore'];
  const hasNum=k=>manual[k]!==undefined&&manual[k]!==null&&manual[k]!==''&&
    Number.isFinite(Number(manual[k]));
  const unfilled=required.filter(k=>!hasNum(k));
  const evidenceOk=!!String(manual.dataSource||'').trim()&&
    !!String(manual.flowEvidence||'').trim()&&!!String(manual.alternativeEvidence||'').trim();
  const valuationInputs=unfilled.length===0&&evidenceOk&&manual.balanceChecked===true;
  set('valuation',valuationInputs,valuationInputs?'Manuelle Bewertungs- und Risiko-Eingaben vorhanden (materielle Prüfung bleibt gesondert)':
    'Unvollständig: '+(unfilled.length?unfilled.join(', '):'')+
    (!evidenceOk?(unfilled.length?', ':'')+'Quellen-/Kapitalfluss-/Alternativenbeleg':'')+
    (manual.balanceChecked!==true?', Bilanzprüfung':''),
    manual.dataSource||'','', 'missing');
  set('guidance',manual.guidanceChecked===true,manual.guidanceChecked===true?
    'Guidance als geprüft hinterlegt (Quellenbeleg gesondert prüfen)':'Guidance noch nicht als geprüft hinterlegt',
    manual.dataSource||'','','missing');
  set('thesis',!!String(manual.thesis||'').trim(),
    manual.thesis?'These vorhanden':'Begründete Investmentthese fehlt',
    manual.dataSource||'','','missing');
  set('risks',!!String(manual.risks||'').trim(),
    manual.risks?'Risikotext vorhanden':'Dokumentierte Risiken und Widerlegungsbedingung fehlen',
    manual.dataSource||'','','missing');
  // These are genuinely unfavourable observed conditions; they remain distinct
  // from absent sources. Missing data is NEVER interpreted as a sell signal.
  if(quoteOk&&historyOk&&m){
    if(m.trend==='Abwärtstrend')adverse.push('Aktueller technischer Abwärtstrend');
    if(Number.isFinite(Number(m.rsi))&&(Number(m.rsi)<40||Number(m.rsi)>68))
      adverse.push('RSI außerhalb des technischen Einstiegskorridors 40–68');
  }
  if(quoteOk&&hasNum('fairValue')&&Number(manual.fairValue)>0){
    const margin=(Number(manual.fairValue)-Number(x.price))/Number(manual.fairValue)*100;
    if(margin<10)adverse.push('Berechnete Sicherheitsmarge unter 10 %');
  }
  if(quoteOk&&['stop','target'].every(hasNum)&&Number(manual.stop)>0&&
     Number(manual.stop)<Number(x.price)&&Number(manual.target)>Number(x.price)){
    const rr=(Number(manual.target)-Number(x.price))/(Number(x.price)-Number(manual.stop));
    if(rr<2)adverse.push('Chance-Risiko-Verhältnis unter 2:1');
  }
  const technicalReady=quoteOk&&historyOk;
  const sourceComplete=missing.length===0;
  return {s,fields,missing,adverse,technicalReady,sourceComplete,
    status:missing.length?'missing':adverse.length?'negative':'review',
    // A complete source checklist is NOT itself a BUY approval.
    tradeApproved:false};
}
function unityReadinessOverview(list){
  const selected=Array.isArray(list)?list:typeof stocks==='function'?stocks():[];
  const records=selected.map(unityReadinessEvidence);
  const count=key=>records.filter(x=>x[key]).length;
  const missing=records.filter(x=>x.missing.length).length;
  const adverse=records.filter(x=>x.adverse.length).length;
  const pilots=UNITY_READINESS_PILOTS.map(p=>{
    const found=records.find(r=>String(r.s.isin||'')===p.isin);
    return {name:p.name,found};
  });
  let h='<section class="panel unity-readiness-overview" aria-label="Datenfreigabe und Entscheidungsreife">'+
    '<h3>UNITY · Datenfreigabe</h3><div class="unity-readiness-metrics">'+
    '<span><b>'+count('technicalReady')+'/'+records.length+'</b><small>technisch auswertbar</small></span>'+
    '<span><b>'+count('sourceComplete')+'</b><small>Quellenbasis vollständig</small></span>'+
    '<span><b>'+missing+'</b><small>Daten unvollständig</small></span>'+
    '<span><b>'+adverse+'</b><small>zusätzlich negative Signale</small></span></div>'+
    '<p class="tiny muted">Datenmangel ist keine negative Aktienbewertung. Kategorien können sich überschneiden. Eine vollständige Quellenbasis ist noch keine Kauf-Freigabe.</p>'+
    '<details class="unity-readiness-pilots"><summary>Datenprüfung der vier Pilotaktien ansehen</summary><div class="unity-readiness-pilot-list">';
  for(const p of pilots){
    const r=p.found;
    const note=!r?'Nicht in aktiver Masterliste':r.missing.length?
      r.missing.slice(0,3).map(x=>x.label).join(' · ')+(r.missing.length>3?' · weitere offen':''):
      r.adverse.length?r.adverse[0]:'Quellenlage vorhanden · Entscheidung gesondert prüfen';
    h+='<div class="unity-readiness-pilot"><b>'+esc(p.name)+'</b><span>'+
      (!r?'Nicht geprüft':r.missing.length?'Daten fehlen':r.adverse.length?'Negatives Signal':'Quellen belegt')+
      '</span><small>'+esc(note)+'</small></div>';
  }
  return h+'</div></details></section>';
}
function unityReadinessDetail(s){
  const r=unityReadinessEvidence(s);
  let h='<section class="panel unity-readiness-detail" aria-label="Datenfreigabe je Aktie">'+
    '<h3>Warum ist die UNITY-Freigabe offen?</h3><p class="tiny muted">'+
    (r.missing.length?r.missing.length+' offene Datenfelder · ':'Keine offene Pflichtquelle · ')+
    r.adverse.length+' belegte Risiko- oder Negativsignale. Fehlende Daten bedeuten weder Kaufen noch Verkaufen.</p>'+
    '<details><summary>Quellen, Lücken und Prüfergebnis ansehen</summary><div class="unity-readiness-rows">';
  for(const f of Object.values(r.fields)){
    const symbol=f.status==='ready'?'✓':f.status==='stale'?'◷':'○';
    h+='<div class="unity-readiness-field"><b>'+esc(symbol+' '+f.label)+'</b>'+
      '<small>'+esc(f.detail)+'</small>'+
      (f.source?'<small>Quelle: '+esc(f.source)+'</small>':'')+
      (f.stamp?'<small>Stand: '+esc(f.stamp)+'</small>':'')+'</div>';
  }
  h+='</div></details>';
  if(r.adverse.length)h+='<p class="unity-readiness-negative"><b>Unabhängig von Datenlücken kritisch:</b> '+
    esc(r.adverse.join(' · '))+'</p>';
  return h+'<p class="tiny muted">Diagnose allein schaltet keine automatische Order frei. Maßgeblich bleibt die gesonderte UNITY-Entscheidungsregel.</p></section>';
}
