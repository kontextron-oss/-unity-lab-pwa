'use strict';
// Curated reference feed. Experimental unofficial delayed daily data, not a live trading feed.
let publicPreview=null, publicBusy=false;
const PUBLIC_FEED_URL='https://raw.githubusercontent.com/kontextron-oss/-unity-lab-pwa/main/data/market.json';
function publicFeedPanel(s){
return '<div class="panel"><h2>Automatische Kursdaten · ohne API-Schlüssel</h2><p>Für die 15 Aktien unseres UNITY-Startkatalogs können <b>historische Tagesschlusskurse</b> aus einer regelmäßig aktualisierten Referenzdatei geladen werden. Die Kurse sind keine verifizierten Intraday-Notierungen.</p>'+
'<button type="button" class="primary" id="public-fetch">Kursdaten für '+esc(s.name)+' abrufen</button><div id="public-result" class="hint" style="margin-top:12px">Noch keine Daten geladen. Alle vorhandenen Werte bleiben unverändert.</div>'+
'<p class="tiny muted">Pilot-Datenquelle: Yahoo-Finance-Chart, serverseitig für den festen Startkatalog abgerufen; inoffiziell, verzögert und ohne Vollständigkeitsgarantie. Bei Quellenfehlern wird ein alter Datenstand ausdrücklich angezeigt. Neue oder manuell angelegte Aktien benötigen weiterhin eine gesonderte Datenquelle.</p></div>'
}
function publicMessage(m){const e=document.getElementById('public-result');if(e)e.innerHTML=m}
function publicStock(){return stocks().find(x=>x.id===selectedUnityStock)}
function publicCheckDate(d){return typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d))}
async function publicFetch(){if(publicBusy)return;const s=publicStock();if(!s)throw Error('Keine Aktie ausgewählt');if(!s.isin){publicMessage('Für diese Aktie fehlt die ISIN. Der automatische Katalogabgleich ist deshalb nicht möglich.');return}publicBusy=true;publicPreview=null;publicMessage('Referenzdaten werden geladen …');try{
const c=new AbortController(),timeout=setTimeout(()=>c.abort(),12000);let r;try{r=await fetch(PUBLIC_FEED_URL+'?t='+Date.now(),{cache:'no-store',signal:c.signal,credentials:'omit'})}finally{clearTimeout(timeout)}
if(!r.ok)throw Error('Datenserver HTTP '+r.status);
const d=await r.json();if(d.schemaVersion!==1||!d.items||typeof d.items!=='object')throw Error('Unbekanntes Datenformat');
const item=d.items[s.isin.toUpperCase()];if(!item){publicMessage('Für '+esc(s.name)+' ist derzeit kein Kurs verfügbar. '+(d.errors?.[s.isin.toUpperCase()]?'Die letzte Aktualisierung meldete einen Quellenfehler.':'Der Wert ist nicht im festen Startkatalog.')+' Die bisherigen Daten bleiben erhalten.');return}
if(item.isin!==s.isin.toUpperCase()||item.currency!==s.currency.toUpperCase())throw Error('ISIN oder Handelswährung weicht ab – keine Übernahme.');
if(!publicCheckDate(item.date)||!(Number(item.price)>0))throw Error('Kurs oder Kursdatum ungültig.');
const points=Array.isArray(item.points)?item.points.filter(x=>publicCheckDate(x.date)&&Number(x.close)>0).map(x=>({date:x.date,close:Number(x.close)})).sort((a,b)=>a.date.localeCompare(b.date)):[];
if(points.length<26||points.at(-1).date!==item.date||Math.abs(points.at(-1).close-Number(item.price))>0.0001)throw Error('Historische Daten sind unvollständig oder inkonsistent.');
const generated=Date.parse(d.generatedAt),age=Number.isFinite(generated)?Math.round((Date.now()-generated)/3600000):NaN;
if(!Number.isFinite(age)||age<0||age>168)throw Error('Referenzdatei älter als sieben Tage oder ohne gültigen Datenzeitpunkt.');
const days=Math.round((Date.now()-Date.parse(item.date+'T00:00:00Z'))/86400000);
if(days>8)throw Error('Letzter Kurs älter als acht Tage – keine Übernahme.');
publicPreview={stockId:s.id,isin:s.isin,price:Number(item.price),date:item.date,points,exchange:item.exchange||'',currency:item.currency,providerSymbol:item.providerSymbol,generatedAt:d.generatedAt,source:item.source,age,days,warning:d.errors?.[s.isin.toUpperCase()]||null};
publicMessage('<b>Gefundener Referenzkurs:</b> '+number(publicPreview.price,4)+' '+esc(s.currency)+'<p><b>Kursdatum:</b> '+esc(item.date)+' · <b>Aktualisierung:</b> '+esc(d.generatedAt)+'</p><p><b>Börse:</b> '+esc(item.exchange||'nicht angegeben')+' · <b>Quellsymbol:</b> '+esc(item.providerSymbol||'offen')+'</p><p><b>Historie:</b> '+points.length+' Handelstage</p>'+(publicPreview.warning?'<p class="alert">Die jüngste Quellenabfrage schlug fehl; es handelt sich um den letzten verfügbaren gespeicherten Datenstand.</p>':'')+'<p class="tiny muted">Unverifizierter Tagesschlusskurs, keine aktuelle Intraday-Notierung. Bei CHF/USD für eine EUR-Depotbewertung ist ein separater Wechselkurs nötig.</p><div class="actions"><button type="button" class="primary" id="public-history">Historie für technische Analyse übernehmen</button><button type="button" class="secondary" id="public-quote">Kurs nach Prüfung übernehmen</button><button type="button" class="secondary" id="public-discard">Verwerfen</button></div>');
}catch(err){publicPreview=null;publicMessage('<span class="negative">Automatischer Abruf fehlgeschlagen: '+esc(err.message||String(err))+'</span><p>Bitte Internetverbindung und Veröffentlichungsstatus prüfen. Es wurden keine Daten verändert.</p>')}finally{publicBusy=false}}
async function publicApply(kind){const p=publicPreview,s=publicStock();if(!p||!s||p.stockId!==s.id)throw Error('Datenvorschau fehlt oder ist veraltet.');
if(kind==='history'){if(!confirm(p.points.length+' historische Tageskurse für '+s.name+' importieren? Bereits vorhandene Historien bleiben erhalten.'))return;await unityHistory(p.points,'UNITY Pilotfeed · '+p.source+' · '+p.providerSymbol+' · '+p.generatedAt);publicPreview=null;alert('Historische Tageskurse übernommen. Technische Indikatoren werden neu berechnet.');return}
if(kind==='quote'){let fx=1;if(s.currency!=='EUR'){const input=prompt('Wechselkurs: Wie viele EUR entsprechen 1 '+s.currency+'? (nicht automatisch ermittelt; für EUR-Depotbewertung erforderlich)','');if(input===null)return;fx=Number(String(input).replace(',','.'));if(!(fx>0))throw Error('Ungültiger EUR-Wechselkurs. Keine Übernahme.')}
if(!confirm('Schlusskurs '+p.price+' '+s.currency+' vom '+p.date+' als unverifizierte Referenz übernehmen?'))return;
const record={id:id(),instrumentId:s.id,price:p.price,fx,quotedAt:p.date+'T00:00:00.000Z',quotePrecision:'day',source:'UNITY Pilotfeed / '+p.source+' · '+p.providerSymbol,quality:'provider-eod',createdAt:new Date().toISOString(),providerMetadata:{exchange:p.exchange,currency:p.currency,generatedAt:p.generatedAt}};
await put('quotes',record);await audit('PUBLIC_QUOTE_IMPORT',record.id,p.date+' '+p.providerSymbol);publicPreview=null;await refresh();alert('Schlusskurs übernommen. Operative Kaufempfehlungen bleiben gesperrt.');return}}
document.addEventListener('click',async e=>{const b=e.target.closest('button');if(!b)return;try{if(b.id==='public-fetch')await publicFetch();if(b.id==='public-history')await publicApply('history');if(b.id==='public-quote')await publicApply('quote');if(b.id==='public-discard'){publicPreview=null;publicMessage('Vorschau verworfen.')}}catch(err){alert(err.message||String(err))}});
