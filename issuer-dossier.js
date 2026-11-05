'use strict';
/* Consolidated, source-bound issuer dossier. Open evidence remains open. */
function unityIssuerDossierUrl(item){
  const url=item?.latestFiling?.reportUrl||item?.officialHighlights?.sourceUrl||
    item?.metrics?.revenue?.sourceUrl||'';
  return /^https:\/\//.test(String(url))?String(url):'';
}
function unityIssuerDossierPanel(stock){
  if(typeof unityIsCryptoAsset==='function'&&unityIsCryptoAsset(stock))return '';
  const item=typeof unityFundPilotItem==='function'?unityFundPilotItem(stock):null;
  const quote=typeof unityMarketForStock==='function'?unityMarketForStock(stock):
    (typeof unityMarketItem==='function'?unityMarketItem(stock.isin):null);
  const evidence=typeof unityIssuerEvidenceMatrix==='function'?unityIssuerEvidenceMatrix(stock):[];
  const byKey=key=>evidence.find(row=>row.key===key)||{};
  const valuation=typeof unityFundValuation==='function'?unityFundValuation(stock,quote?.price):{available:false,missing:['Bewertungsdaten fehlen']};
  const quoteDate=String(quote?.date||'');
  const quoteReady=Number(quote?.price)>0&&!!quoteDate;
  const fundamentals=byKey('fundamentals');
  const earnings=byKey('earnings'),guidance=byKey('guidance'),thesis=byKey('thesis'),risk=byKey('risk');
  const reportUrl=unityIssuerDossierUrl(item);
  const rows=[
    {title:'Kurs & Börsenplatz',ok:quoteReady,date:quoteDate,detail:quoteReady?String(quote.source||quote.exchange||'Referenzkurs'):'Kein datierter Referenzkurs verfügbar',url:''},
    {title:'Jahresabschluss',ok:fundamentals.verified===true,date:fundamentals.date||'',detail:fundamentals.detail||'Vollständiger Jahresbericht fehlt',url:fundamentals.sourceUrl||reportUrl},
    {title:'Bewertung',ok:valuation.available===true,date:valuation.period||'',detail:valuation.available?'KGV, KBV und Free-Cashflow-Rendite aus Abschluss und Referenzkurs berechnet':'Offen: '+(valuation.missing||['Abschluss- oder Kursbasis fehlt']).join(', '),url:reportUrl},
    {title:'Ergebnisbericht',ok:earnings.verified===true,date:earnings.date||'',detail:earnings.detail||'Kein bestätigter nächster Ergebnisbericht',url:earnings.sourceUrl||''},
    {title:'Guidance',ok:guidance.verified===true,date:guidance.date||'',detail:guidance.detail||'Keine aktuelle Guidance als Primärquelle belegt',url:guidance.sourceUrl||''},
    {title:'These & Widerlegung',ok:thesis.verified===true,date:thesis.date||'',detail:thesis.detail||'Keine belegte These mit Widerlegungsbedingung',url:thesis.sourceUrl||''},
    {title:'Risiko & Ereignisse',ok:risk.verified===true,date:risk.date||'',detail:risk.detail||'Keine einzeln geprüften Risikofaktoren belegt',url:risk.sourceUrl||''}
  ];
  const complete=rows.filter(row=>row.ok).length;
  let h='<section class="panel unity-issuer-dossier"><h3>Datenakte · '+esc(stock.name)+'</h3>'+
    '<p class="tiny muted">Die Datenakte bündelt nur zu diesem Unternehmen gehörende, datierte Quellen. Sie unterscheidet belegte Fakten von offenen Prüfaufgaben und ersetzt keine Datenlücke durch einen Score.</p>'+
    '<div class="unity-readiness-head"><small>Quellenabdeckung für eine vollständige Unternehmensprüfung</small><b>'+complete+'/'+rows.length+' Bereiche belegt</b></div><div class="unity-issuer-events">';
  for(const row of rows){
    const link=/^https:\/\//.test(String(row.url||''))?'<a href="'+esc(row.url)+'" target="_blank" rel="noopener noreferrer">Original öffnen</a>':'';
    h+='<div class="unity-issuer-event"><span><strong>'+esc(row.title)+'</strong><small>'+(row.ok?'✓ belegt':'○ offen')+(row.date?' · '+esc(row.date):'')+' · '+esc(row.detail)+'</small></span>'+link+'</div>';
  }
  return h+'</div><p class="tiny muted">Eine vollständige UNITY-Entscheidung benötigt alle Bereiche sowie ein nachvollziehbares Chance-Risiko-Verhältnis. Eine technisch interessante Aktie bleibt ohne diese Belege nur eine technische Vorauswahl.</p></section>';
}
