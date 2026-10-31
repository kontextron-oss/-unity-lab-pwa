'use strict';
/* UNITY Lab 0.4: automatic comparative research from a dated, unofficial EOD snapshot.
   Not an AI model, not fundamental analysis, not a trading recommendation. */
let unityMarket=null,unityMarketError='',unityMarketLoading=false;
let unityScope='all',unitySort='strength',unitySelectedIsin='';
const unityDataUrl='./data/market.json';
const unityCatalogIsins=()=>new Set(CATALOG.map(x=>x.isin));
function unityMarketItem(isin){
  if(!unityMarket||!isin)return null;
  const x=unityMarket.items?.[isin.toUpperCase()];
  if(!x||x.isin!==isin.toUpperCase()||!Array.isArray(x.points)||x.points.length<200||!(Number(x.price)>0))return null;
  if(x.currency!==CATALOG.find(s=>s.isin===isin)?.currency)return null;
  return x;
}
const unityPct=x=>Number.isFinite(x)?(x>0?'+':'')+number(x,1)+' %':'–';
function unityMetrics(x){
  if(!x)return null;
  const a=x.points.map(p=>Number(p.close));
  if(a.length<200||a.some(n=>!(n>0)))return null;
  const last=a.at(-1),sma=n=>a.slice(-n).reduce((t,n)=>t+n,0)/n;
  const change=n=>a.length>n?(last/a.at(-1-n)-1)*100:NaN;
  const high=Math.max(...a.slice(-Math.min(252,a.length)));
  let up=0,down=0;
  for(let i=a.length-14;i<a.length;i++){const d=a[i]-a[i-1];up+=Math.max(d,0);down+=Math.max(-d,0)}
  const rsi=down?100-100/(1+up/down):up?100:50;
  const ma50=sma(50),ma200=sma(200),r21=change(21),r63=change(63),r252=change(252);
  const drawdown=(last/high-1)*100;
  const trend=last>=ma200&&ma50>=ma200?'Aufwärtstrend':last<ma200&&ma50<ma200?'Abwärtstrend':'Uneinheitlich';
  // Technical comparison index, NOT a UNITY investment score.
  const technicalIndex=Math.round(Math.max(0,Math.min(100,
    (last>=ma200?25:5)+(ma50>=ma200?20:5)+
    (Number.isFinite(r63)?Math.max(0,Math.min(25,12+r63*0.7)):0)+
    (rsi>=35&&rsi<=70?20:rsi>70?8:10)+
    (drawdown<=-10?10:drawdown<=-3?7:3)
  )));
  const freshnessDays=Math.floor((Date.now()-Date.parse(x.date+'T00:00:00Z'))/86400000);
  const stale=!Number.isFinite(freshnessDays)||freshnessDays<0||freshnessDays>8;
  let signal='Technisch neutral';
  if(trend==='Aufwärtstrend'&&rsi>=70)signal='Starker Trend · erhöhtes Rückschlagrisiko';
  else if(trend==='Aufwärtstrend'&&drawdown<=-5)signal='Aufwärtstrend · Rücksetzer';
  else if(trend==='Aufwärtstrend')signal='Aufwärtstrend · Einstiegspreis prüfen';
  else if(trend==='Abwärtstrend')signal='Abwärtstrend · erhöhtes Risiko';
  else if(drawdown<=-10)signal='Korrektur · Stabilisierung offen';
  const note=stale?'Der verfügbare Kursstand ist veraltet.':trend==='Aufwärtstrend'
    ?'Der Kurs liegt über dem langfristigen Durchschnitt. Das spricht für einen positiven Trend, aber nicht automatisch für eine günstige Bewertung.'
    :trend==='Abwärtstrend'?'Kurs und mittelfristiger Durchschnitt liegen unter dem langfristigen Durchschnitt. Ein günstigerer Preis ist ohne Fundamentaldaten kein Kaufsignal.'
    :'Die Trendindikatoren liefern derzeit kein einheitliches Bild.';
  const timing=rsi>=70?'Der RSI deutet auf eine überhitzte kurzfristige Lage hin.':rsi<35?'Der RSI zeigt eine schwache kurzfristige Lage; eine Erholung ist nicht gesichert.':'Der RSI liegt nicht im Extrembereich.';
  return {last,ma50,ma200,rsi,r21,r63,r252,drawdown,trend,technicalIndex,signal,note,timing,stale};
}
function unityRows(){
  const saved=new Set(stocks().map(s=>s.isin).filter(Boolean));
  const rows=CATALOG.filter(s=>unityScope==='all'||saved.has(s.isin)).map(s=>{
    const x=unityMarketItem(s.isin);
    return {s,x,m:unityMetrics(x),owned:saved.has(s.isin)}
  });
  rows.sort((a,b)=>unitySort==='name'?a.s.name.localeCompare(b.s.name):
    unitySort==='3m'?(b.m?.r63??-999)-(a.m?.r63??-999):
    (b.m?.technicalIndex??-999)-(a.m?.technicalIndex??-999));
  return rows;
}
function unityDataNotice(){
  if(unityMarketError)return '<p class="negative">Datenabruf nicht verfügbar: '+esc(unityMarketError)+'. Keine aktuelle Analyse möglich.</p><button type="button" class="secondary" id="unity-reload-market">Erneut laden</button>';
  if(!unityMarket)return '<p class="muted">Vergleichsdaten werden automatisch geladen …</p>';
  const at=unityMarket.generatedAt||'unbekannt';
  const count=Object.keys(unityMarket.items||{}).length;
  return '<p class="tiny muted">Datenstand der Referenzdatei: '+esc(at)+' · '+count+' von 15 Aktien mit Kursverlauf · '+esc(unityMarket.source||'inoffizielle Quelle')+'. Kurse sind verzögerte Tageswerte und nicht unabhängig verifiziert.</p>';
}
function unityComparisonView(){
  let h='<section class="panel" id="unity-dashboard"><h2>UNITY Marktüberblick · automatischer Vergleich</h2>'+
    '<p>Hier werden alle verfügbaren Aktien <b>automatisch miteinander verglichen</b>. Du musst keine Kennzahlen eingeben. Der technische Vergleich ist noch <b>keine vollständige Kaufanalyse</b>.</p>'+
    '<div class="hint"><strong>Keine Kauf-Freigabe für die beobachteten Aktien.</strong> Nicht, weil alle Unternehmen schlecht sind, sondern weil verifizierte Bewertung, Bilanz, Prognosen, Earnings und aktuelle Börsenkurse für ein belastbares Kaufurteil fehlen.</div>'+
    unityDataNotice();
  if(!unityMarket)return h+'</section>';
  h+='<div class="actions"><button type="button" class="'+(unityScope==='all'?'primary':'secondary')+'" data-unity-scope="all">Alle 15 Aktien</button><button type="button" class="'+(unityScope==='mine'?'primary':'secondary')+'" data-unity-scope="mine">Meine Aktien</button></div>'+
    '<label style="max-width:290px;margin-top:10px">Vergleich sortieren<select id="unity-sort"><option value="strength" '+(unitySort==='strength'?'selected':'')+'>Technische Stärke</option><option value="3m" '+(unitySort==='3m'?'selected':'')+'>Kursentwicklung 3 Monate</option><option value="name" '+(unitySort==='name'?'selected':'')+'>Name A–Z</option></select></label>';
  const rows=unityRows();
  if(!rows.length)return h+'<p>Noch keine Aktien in deiner persönlichen Liste. Wähle „Alle 15 Aktien“.</p></section>';
  h+='<div class="tablewrap"><table><thead><tr><th>Aktie</th><th>Schlusskurs / Datum</th><th>3 Monate</th><th>12 Monate</th><th>Technische Lage</th><th>Kaufurteil</th></tr></thead><tbody>';
  for(const {s,x,m} of rows){
    h+='<tr><td><button type="button" class="secondary" data-unity-isin="'+esc(s.isin)+'" style="text-align:left;white-space:normal"><b>'+esc(s.name)+'</b><br><span class="tiny">'+esc(s.ticker)+'</span></button></td>'+
      '<td>'+(m?number(m.last,2)+' '+esc(s.currency)+'<br><span class="tiny muted">'+esc(x.date)+'</span>':'–')+'</td>'+
      '<td class="'+(m?.r63>=0?'positive':'negative')+'">'+(m?unityPct(m.r63):'–')+'</td>'+
      '<td class="'+(m?.r252>=0?'positive':'negative')+'">'+(m?unityPct(m.r252):'–')+'</td>'+
      '<td>'+(m?'<b>'+esc(m.stale?'Daten veraltet':m.trend)+'</b><br><span class="tiny">'+esc(m.signal)+' · Vergleichsindex '+m.technicalIndex+'/100</span>':'Daten fehlen')+'</td>'+
      '<td><b>Keine Freigabe</b><br><span class="tiny muted">Bewertung / Ereignisse fehlen</span></td></tr>';
  }
  h+='</tbody></table></div><p class="tiny muted">Der Vergleichsindex von 0 bis 100 bewertet ausschließlich Kursverlauf, RSI und gleitende Durchschnitte. Er ist kein UNITY-Gesamtscore und kein Kaufsignal. Die Tabelle enthält auch Aktien, die noch nicht in deiner persönlichen Beobachtungsliste stehen.</p></section>';
  if(unitySelectedIsin)h+=unityCompanyView(unitySelectedIsin,true);
  return h;
}
function unityCompanyView(isin,comparison=false){
  const c=CATALOG.find(s=>s.isin===isin),x=unityMarketItem(isin),m=unityMetrics(x);
  if(!c)return '<div class="panel">Für diese Aktie liegt noch kein automatischer Kursvergleich vor.</div>';
  let h='<section class="panel" id="unity-company-detail"><h2>'+esc(c.name)+' · verständliche Auswertung</h2>';
  if(!m)return h+'<p>Für diese Aktie liegen derzeit keine ausreichend vollständigen historischen Referenzkurse vor. Eine Einschätzung wird nicht erfunden.</p></section>';
  h+='<div class="grid"><div class="metric"><small>Letzter Tageskurs</small><strong>'+number(m.last,2)+' '+esc(c.currency)+'</strong><small>'+esc(x.date)+'</small></div>'+
    '<div class="metric"><small>3 Monate</small><strong>'+unityPct(m.r63)+'</strong></div>'+
    '<div class="metric"><small>12 Monate</small><strong>'+unityPct(m.r252)+'</strong></div>'+
    '<div class="metric"><small>Abstand zum Jahreshoch</small><strong>'+unityPct(m.drawdown)+'</strong></div></div>'+
    '<h3>Was bedeutet das?</h3><p><b>Technischer Befund:</b> '+esc(m.signal)+'. '+esc(m.note)+' '+esc(m.timing)+'</p>'+
    '<p><b>Einordnung im Vergleich:</b> Technischer Vergleichsindex '+m.technicalIndex+'/100. Ein hoher Wert bedeutet eine vergleichsweise starke Kurslage, nicht dass die Aktie billig ist.</p>'+
    '<p><b>Ist ein Kauf sinnvoll?</b> <strong>Derzeit nicht belastbar entscheidbar.</strong> Für ein Ja oder Nein müssen der Kurs gegen einen begründeten Unternehmenswert, aktuelle Geschäftsberichte, Gewinnprognosen, Bilanzrisiken und der nächste Earnings-Termin geprüft werden.</p>'+
    '<p class="tiny muted">Berechnungsgrundlage: '+esc(x.providerSymbol||c.ticker)+' · '+esc(x.exchange||c.exchange)+' · Schlusskurse bis '+esc(x.date)+' · inoffizieller Datenfeed. Kein Echtzeitkurs. '+(m.stale?'Achtung: Datenstand veraltet.':'')+'</p>';
  if(comparison){const saved=stocks().find(s=>s.isin===isin);if(saved)h+='<button type="button" class="primary" data-analyze="'+esc(saved.id)+'">Zur vollständigen Aktienakte</button>';else h+='<p class="muted">Noch nicht in deiner persönlichen Liste. Die vergleichende Auswertung ist trotzdem sichtbar.</p>';}
  return h+'</section>';
}
async function unityLoadMarket(){
  if(unityMarketLoading)return;
  unityMarketLoading=true;unityMarketError='';
  try{
    const c=new AbortController(),timer=setTimeout(()=>c.abort(),15000);
    let response;try{response=await fetch(unityDataUrl+'?t='+Date.now(),{cache:'no-store',signal:c.signal,credentials:'omit'})}finally{clearTimeout(timer)}
    if(!response.ok)throw Error('HTTP '+response.status);
    const data=await response.json();
    if(data.schemaVersion!==1||!data.items||typeof data.items!=='object')throw Error('Ungültiges Datenformat');
    if(!Number.isFinite(Date.parse(data.generatedAt)))throw Error('Fehlender Datenzeitpunkt');
    unityMarket=data;
  }catch(e){unityMarketError=e.message||String(e);unityMarket=null}
  finally{unityMarketLoading=false;if(typeof db!=='undefined'&&db&&typeof render==='function')render()}
}
document.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.dataset.unityScope){unityScope=b.dataset.unityScope;render()}
  if(b.dataset.unityIsin){unitySelectedIsin=b.dataset.unityIsin;render();document.getElementById('unity-company-detail')?.scrollIntoView({behavior:'smooth',block:'start'})}
  if(b.id==='unity-reload-market')unityLoadMarket();
});
document.addEventListener('change',e=>{if(e.target.id==='unity-sort'){unitySort=e.target.value;render()}});
unityLoadMarket();
