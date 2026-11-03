'use strict';
/* UNITY LAB 0.13.51 · Public EU procurement events & data-readiness radar.
   Open procurement notice != investment fund inflow != issuer's order book.
   Never influence investment score or give a trade instruction. */
const unityCapitalUrl='./data/capital_events.json';
const unityCapitalThemeStocks={
  'transformers':['ABBN','ENR','GEV','ETN'],
  'power-cables':['PRY','NEX','ABBN'],
  'cooling':['VRT','LR','BEAN']
};
let unityCapitalData=null,unityCapitalError='',unityCapitalLoading=false,unityCapitalLastAttempt=0;
function unityCapitalTime(value){
  const ms=Date.parse(value||'');
  return Number.isFinite(ms)?ms:NaN;
}
function unityCapitalFresh(doc){
  const ms=unityCapitalTime(doc?.generatedAt),now=Date.now();
  return Number.isFinite(ms)&&ms<=now+3600000&&now-ms<8*86400000;
}
function unityCapitalDate(value){
  const str=String(value||'');
  return /^\d{4}-\d{2}-\d{2}$/.test(str.slice(0,10))?str.slice(0,10):'unbekannt';
}
function unityCapitalVerifiedUrl(value,id){
  const str=String(value||'');
  const expected=/^[0-9]{1,8}-20[0-9]{2}$/.test(id||'')?
    'https://ted.europa.eu/en/notice/-/detail/'+id:'';
  return str===expected?str:'';
}
function unityCapitalMoney(value,cur){
  if(!Number.isFinite(value)||!(value>0)||!['EUR','USD','CHF','GBP'].includes(cur))return '';
  return new Intl.NumberFormat('de-DE',{style:'currency',currency:cur,maximumFractionDigits:0}).format(value);
}
function unityCapitalTopicPanel(id,topic,expired){
  const unavailable=!topic||topic.status!=='available'||expired;
  const title=String(topic?.label||({
    transformers:'Transformatoren','power-cables':'Stromkabel und Netzverbindungen',
    cooling:'Kühl- und Wärmetauschtechnik'}[id]||id));
  let html='<section class="panel unity-cap-topic"><h3>'+esc(title)+'</h3>';
  const stocksInTopic=typeof stocks==='function'?stocks().filter(s=>
    (unityCapitalThemeStocks[id]||[]).includes(String(s.ticker||'').toUpperCase())):[];
  if(stocksInTopic.length)
    html+='<p class="tiny muted"><b>Beobachtungsgruppe:</b> '+
      stocksInTopic.map(s=>esc(s.name)).join(', ')+
      ' · <b>keine bestätigte Vergabe an diese Unternehmen</b></p>';
  if(unavailable){
    html+='<p class="unity-cap-warning">Aktuell keine überprüfbare TED-Stichprobe'+
      (topic?.status==='stale'?' (gespeicherte alte Meldungen werden nicht als neu bewertet)':'')+
      '. Daraus folgt weder ein Rückgang noch ein Anstieg öffentlicher Investitionen.</p></section>';
    return html;
  }
  const entries=(topic.events||[]).filter(e=>
    unityCapitalVerifiedUrl(e.url,e.id)&&/^\d{4}-\d{2}-\d{2}$/.test(e.publishedAt||'')).slice(0,10);
  const recent=entries.filter(e=>e.newSincePreviousScan===true);
  html+='<p class="tiny muted">EU TED · Auftragsergebnisse/öffentliche Vergaben · '+
    esc(unityCapitalDate(topic.checkedAt))+
    ' geprüft · '+entries.length+' belegte Meldungen angezeigt · '+recent.length+
    ' seit voriger Prüfung neu in der Anzeige. Kein Vollbestand, keine Kapitalflussmessung.</p>';
  if(!entries.length){
    html+='<p class="tiny muted">Keine eindeutig passenden Datensätze im begrenzten Suchfenster. Keine Aussage über das Gesamtvolumen.</p>';
  }else{
    html+='<div class="unity-cap-events">';
    for(const e of entries){
      const amount=unityCapitalMoney(e.publishedValue,e.currency);
      html+='<div class="unity-cap-event">'+
        '<div><strong>'+esc(e.title||'Öffentliche Vergabebekanntmachung')+'</strong>'+
        (e.newSincePreviousScan?'<span class="unity-cap-new">Neu erfasst</span>':'')+
        '<small>Veröffentlichung '+esc(unityCapitalDate(e.publishedAt))+
        (e.buyer?' · Vergabestelle: '+esc(e.buyer):'')+
        (e.buyerCountry?' · '+esc(e.buyerCountry):'')+'</small>'+
        (amount?'<small>Gemeldeter TED-Verfahrenswert: '+esc(amount)+
          ' · kann mehrere Lose umfassen, kein bestätigter Unternehmensumsatz</small>':'')+
        (e.winner?'<small>Genannter Auftragnehmer: '+esc(e.winner)+
          ' · Identität mit börsennotiertem Emittenten nicht verifiziert</small>':'')+
        '</div><a href="'+esc(e.url)+'" target="_blank" rel="noopener noreferrer">Original</a></div>';
    }
    html+='</div>';
  }
  return html+'</section>';
}
function unityCapitalReadiness(){
  if(typeof stocks!=='function')return '';
  const active=stocks();
  let ready=0,missing=0,unknownEarnings=0;
  const detail=[];
  for(const s of active){
    let q=null;
    try{
      const item=typeof unityMarketForStock==='function'?unityMarketForStock(s):null;
      q=item&&typeof unityDataQuality==='function'?
        unityDataQuality(item,s.isin||('@'+s.providerSymbol)):null;
    }catch(_){}
    const marketOk=q?.canCompare===true;
    let f=null;
    try{f=typeof unityFundPilotItem==='function'?unityFundPilotItem(s):null}catch(_){}
    const factsOk=f?.status==='metrics-partial'&&
      Object.values(f.derived||{}).some(x=>x&&Number.isFinite(Number(x.value)));
    const userFacts=typeof cache!=='undefined'?(cache.fundamentals||[]).find(x=>x.id===s.id):null;
    const earningsOk=!!userFacts?.earningsConfirmed&&
      Number.isFinite(Date.parse(userFacts.earningsDate||''))&&
      Date.parse(userFacts.earningsDate)>Date.now()-86400000;
    if(!earningsOk)unknownEarnings++;
    if(marketOk&&factsOk&&earningsOk)ready++;
    else missing++;
    if(!marketOk||!factsOk||!earningsOk){
      detail.push({
        name:s.name||s.ticker||'Unbekannt',
        ticker:s.ticker||'',
        gaps:[!marketOk?'verlässliche Kursreihe':null,
          !factsOk?'geprüfte Bilanz':null,
          !earningsOk?'bestätigter Earnings-Termin':null].filter(Boolean)
      });
    }
  }
  let h='<section class="panel unity-cap-readiness"><h2>Wie vollständig sind unsere Analysedaten?</h2>'+
    '<p class="tiny muted">Automatische Vorprüfung der gesamten aktiven UNITY-Liste. '+
    'Eine bestätigte Kursreihe alleine ist keine Kaufempfehlung.</p>'+
    '<div class="unity-cap-statusline"><b>'+active.length+' Aktien erfasst</b>'+
    '<span>'+missing+' mit mindestens einer Datenlücke</span>'+
    '<span>'+unknownEarnings+' ohne bestätigten nächsten Earnings-Termin</span></div>'+
    '<p class="tiny muted">Vollständige Basisprüfung bestanden: '+ready+' · Dieser Wert ist kein Analyse-Score, sondern die gleichzeitige Verfügbarkeit von Kursreihe, Pilotbilanz und Earnings-Termin. Noch nicht angebundene Unternehmen gelten als Datenlücke, nicht als schlechtes Investment.</p>';
  if(detail.length){
    h+='<details><summary>Fehlende Informationen je Aktie anzeigen ('+detail.length+')</summary><div class="unity-cap-gaps">';
    for(const item of detail){
      h+='<div><strong>'+esc(item.name)+'</strong> <small>'+esc(item.gaps.join(' · '))+'</small></div>';
    }
    h+='</div></details>';
  }
  return h+'</section>';
}
function unityCapitalView(){
  const doc=unityCapitalData,expired=!unityCapitalFresh(doc);
  let h='<section class="panel unity-cap-intro"><h2>Kapital- und Ereignisradar</h2>'+
    '<p>Öffentliche Infrastrukturprojekte früh erkennen und anschließend gezielt prüfen, '+
    'welche Unternehmen tatsächlich profitieren könnten.</p>'+
    '<p class="tiny muted">Erste Phase: <b>amtliche EU-Vergabebekanntmachungen</b>. '+
    'Dies sind keine institutionellen Aktienzuflüsse, keine bewiesenen Aufträge an UNITY-Unternehmen '+
    'und keine automatischen Kauf- oder Verkaufssignale.</p>';
  if(unityCapitalLoading)h+='<p class="tiny muted">Offizielle Meldungen werden geladen …</p>';
  else if(unityCapitalError||!doc)h+='<p class="unity-cap-warning">Die offizielle Datenquelle ist derzeit nicht erreichbar. '+esc(unityCapitalError)+
    ' Keine aktuelle Kapital- oder Ereignisaussage.</p>';
  else h+='<p class="tiny muted">Letzte technische Quellenprüfung: '+esc(unityCapitalDate(doc.generatedAt))+
    ' · '+(expired?'Datenstand zu alt':doc.sourceFailures?doc.sourceFailures+' von 3 Quellenbereichen derzeit nicht erreichbar':'Quellenabruf verarbeitet')+'</p>';
  h+='<div class="actions"><button type="button" class="secondary" id="unity-cap-reload">Quellenstand neu laden</button></div></section>';
  h+=unityCapitalReadiness();
  for(const id of ['transformers','power-cables','cooling'])
    h+=unityCapitalTopicPanel(id,doc?.topics?.[id],expired);
  h+='<section class="panel"><h3>Nächste Entwicklungsstufe: institutionelles Kapital</h3>'+
    '<p>13F-Beteiligungsveränderungen, offizielle Beteiligungs- und Insiderberichte sowie '+
    'vergleichbare ETF-Kapitalflussdaten sollen gesondert angebunden werden. '+
    'Sie sind derzeit <b>nicht automatisch bestätigt</b>. '+
    'Veröffentlichte Investitionsprojekte können ein Branchenhinweis sein, '+
    'aber aus ihnen darf keine institutionelle Kaufbewegung abgeleitet werden.</p>'+
    '<p class="tiny muted">Quelle: Europäische Union · Tenders Electronic Daily (TED). '+
    '<a href="https://docs.ted.europa.eu/api/latest/search.html" target="_blank" rel="noopener noreferrer">TED-Dokumentation</a></p></section>';
  return h;
}
async function unityCapitalLoad(force=false){
  if(unityCapitalLoading||(!force&&(unityCapitalData||Date.now()-unityCapitalLastAttempt<300000)))return;
  unityCapitalLastAttempt=Date.now();
  unityCapitalLoading=true;
  try{
    const r=await fetch(unityCapitalUrl+'?t='+Date.now(),{cache:'no-store'});
    if(!r.ok)throw Error('HTTP '+r.status);
    const data=await r.json();
    if(data.schemaVersion!==1||!data.topics||
      ['transformers','power-cables','cooling'].some(id=>
        !data.topics[id]||!Array.isArray(data.topics[id].events)||
        !['available','stale','unavailable'].includes(data.topics[id].status)))
      throw Error('Quellenformat nicht vollständig');
    unityCapitalData=data;unityCapitalError='';
  }catch(e){unityCapitalError=String(e?.message||e);}
  finally{
    unityCapitalLoading=false;
    if(typeof db!=='undefined'&&db&&typeof render==='function'&&
       typeof activeTab!=='undefined'&&activeTab==='radar')render();
  }
}
