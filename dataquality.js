'use strict';
/* Market-data provenance and freshness gate.
   EOD freshness means "recent trading-day reference", NEVER real-time. */
function unityBusinessDaysSince(date, now=new Date()){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(date||'')))return Infinity;
  const start=new Date(date+'T12:00:00Z');
  if(!Number.isFinite(start.getTime()))return Infinity;
  const end=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate(),12));
  if(start>end)return Infinity;
  const diff=Math.round((end-start)/86400000);
  if(diff>366)return Infinity;
  let n=0;
  for(let i=1;i<=diff;i++){
    const d=new Date(start.getTime()+i*86400000).getUTCDay();
    if(d!==0&&d!==6)n++;
  }
  return n;
}
function unityDataQuality(item,isin,market=unityMarket){
  if(!item)return {level:'missing',label:'Keine Kursdaten',detail:'Für diese Aktie ist keine Referenz verfügbar.',canCompare:false};
  if(item.dynamicExperimental)return {level:'warning',label:'Externe Referenz ungeprüft',detail:'Weltweite Kursreihe über einen externen CORS-Dienst; nicht börslich verifiziert, ISIN nicht unabhängig bestätigt. Diagramm nur zur Orientierung; keine operative Freigabe.',canCompare:false};
  const symbol=String(item.providerSymbol||'').toUpperCase();
  const expected=CATALOG.find(s=>s.isin===isin)||CATALOG.find(s=>String(s.providerSymbol||'').toUpperCase()===symbol);
  const expectedKey=expected?.isin||('@'+String(expected?.providerSymbol||'').toUpperCase());
  const identityOk=!!expected&&(expected.isin?item.isin===expected.isin:symbol===String(expected.providerSymbol||'').toUpperCase());
  if(!identityOk||item.currency!==expected.currency)
    return {level:'invalid',label:'Datenkonflikt',detail:'Wertpapierkennung oder Währung stimmt nicht mit dem Aktienkatalog überein.',canCompare:false};
  const p=item.points;
  if(!Array.isArray(p)||p.length<200||p.length>1900||!(Number(item.price)>0))
    return {level:'invalid',label:'Unvollständige Kursreihe',detail:'Für die technischen Kennzahlen fehlen gültige historische Daten.',canCompare:false};
  for(let i=0;i<p.length;i++){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(String(p[i].date))||!(Number(p[i].close)>0)||
      (i>0&&p[i].date<=p[i-1].date))
      return {level:'invalid',label:'Kursreihe fehlerhaft',detail:'Datum oder Schlusskurs ist nicht plausibel.',canCompare:false};
  }
  if(p.at(-1).date!==item.date||Math.abs(Number(p.at(-1).close)-Number(item.price))>0.00011)
    return {level:'invalid',label:'Kursabgleich fehlgeschlagen',detail:'Letzter Schlusskurs und Kursreihe stimmen nicht überein.',canCompare:false};
  const age=unityBusinessDaysSince(item.date);
  if(!Number.isFinite(age))return {level:'invalid',label:'Kursdatum ungültig',detail:'Das Kursdatum ist nicht plausibel.',canCompare:false};
  const sourceFailure=!!market?.errors?.[expectedKey];
  if(age>2)return {level:'stale',label:'Kursdaten veraltet',detail:'Letzter Schlusskurs '+item.date+' · '+age+' Werktage zurück. Keine aktuelle Rangfolge.',canCompare:false};
  if(sourceFailure)return {level:'warning',label:'Quellenabruf fehlgeschlagen',detail:'Letzter gespeicherter Schlusskurs '+item.date+'. Die jüngste Quellenabfrage schlug fehl.',canCompare:false};
  return {level:'eod',label:'Letzter verfügbarer Schlusskurs',detail:'Handelstagsstand '+item.date+' · '+item.exchange+' · '+item.currency+'. Keine Echtzeitnotierung.',canCompare:true};
}
function unityDataStatusPanel(market=unityMarket){
  if(!market)return '';
  const names=CATALOG.map(s=>{
    const key=s.isin||('@'+String(s.providerSymbol||'').toUpperCase()),item=market.items?.[key],q=unityDataQuality(item,key,market);
    return {s,item,q};
  });
  const good=names.filter(x=>x.q.canCompare).length;
  const blocked=names.length-good;
  const generated=market.generatedAt||'unbekannt';
  let h='<details class="unity-quality-panel"><summary><b>Datenqualität prüfen</b> · '+good+'/'+names.length+' Aktien mit verwendbarem Tageskurs'+(blocked?' · '+blocked+' eingeschränkt':'')+'</summary>'+
    '<p class="tiny muted">Letzter technischer Abruf: '+esc(generated)+'. Ein neuer Abruf bedeutet nicht, dass die Börse einen neuen Kurs gestellt hat. Wochenenden werden berücksichtigt, Börsenfeiertage nicht. Kein Echtzeitfeed und keine unabhängige Quellenbestätigung.</p>'+
    '<div class="tablewrap"><table><thead><tr><th>Aktie</th><th>Letzter Kurs</th><th>Status</th></tr></thead><tbody>';
  for(const {s,item,q} of names)h+='<tr><td>'+esc(s.name)+'</td><td>'+esc(item?.date||'–')+'</td><td><b>'+esc(q.label)+'</b><br><span class="tiny muted">'+esc(q.detail)+'</span></td></tr>';
  return h+'</tbody></table></div></details>';
}
