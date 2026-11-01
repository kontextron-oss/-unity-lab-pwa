/* Experimental zero-key worldwide equity discovery and six-year reference history.
 * The CORS relay is a third-party service. Yahoo endpoints are unofficial and
 * neither exchange-verified nor licensed for trading decisions. Fail closed. */
const unityDiscoveryProxy='https://proxy.cors.dev/';
const unityDynamicItems=new Map(),unityDynamicPending=new Map(),unityDynamicErrors=new Map();let unityDynamicQueueQuiet=false;
const unityYahooSymbolValid=s=>typeof s==='string'&&/^[A-Za-z0-9.^=\-]{1,28}$/.test(s);
async function unityDiscoveryFetch(url,signal){
  const response=await fetch(unityDiscoveryProxy+url,{credentials:'omit',signal,cache:'no-store'});
  if(!response.ok)throw Error('Externe Börsenquelle nicht erreichbar (HTTP '+response.status+')');
  return response.json();
}
async function unitySearchWorldwide(query,signal){
  const term=String(query||'').trim();
  if(term.length<2||term.length>90)return [];
  const url='https://query1.finance.yahoo.com/v1/finance/search?q='+encodeURIComponent(term)+'&quotesCount=20&newsCount=0';
  const data=await unityDiscoveryFetch(url,signal);
  return (Array.isArray(data.quotes)?data.quotes:[]).filter(q=>
    q.quoteType==='EQUITY'&&unityYahooSymbolValid(q.symbol)&&
    (q.longname||q.shortname)).slice(0,18).map(q=>({
    name:String(q.longname||q.shortname).slice(0,120),
    ticker:String(q.symbol),providerSymbol:String(q.symbol),
    exchange:String(q.exchDisp||q.exchange||'').slice(0,90),
    isin:'',currency:'',source:'Yahoo Finance Suche (inoffiziell)',
    note:String(q.industry||q.sector||'').slice(0,120),
    searchKind:'yahoo'
  }));
}
async function unityFetchWorldwideHistory(symbol,signal){
  if(!unityYahooSymbolValid(symbol))throw Error('Ungültiges Börsenkürzel');
  const url='https://query1.finance.yahoo.com/v8/finance/chart/'+encodeURIComponent(symbol)+'?range=10y&interval=1d&events=false';
  const data=await unityDiscoveryFetch(url,signal);
  const chart=data?.chart?.result?.[0],meta=chart?.meta||{};
  if(!chart||String(meta.symbol||'').toUpperCase()!==symbol.toUpperCase())throw Error('Börsenkürzel stimmt nicht mit der Kursquelle überein');
  const currency=String(meta.currency||'').toUpperCase();
  if(!['EUR','CHF','USD','GBP','SEK','NOK','DKK','JPY','CAD','AUD','PLN'].includes(currency))throw Error('Handelswährung nicht eindeutig ermittelbar');
  const times=chart.timestamp||[],closes=chart.indicators?.quote?.[0]?.close||[];
  const points=[];
  for(let i=0;i<times.length;i++){
    const c=Number(closes[i]),ts=Number(times[i]);
    if(!(c>0&&c<1e8&&Number.isFinite(ts)&&ts*1000<Date.now()+60000))continue;
    const date=new Date(ts*1000).toISOString().slice(0,10);
    points.push({date,close:Math.round(c*1e5)/1e5});
  }
  const ordered=[...new Map(points.map(p=>[p.date,p])).values()].sort((a,b)=>a.date.localeCompare(b.date));
  const last=ordered.at(-1);
  if(!last||ordered.length<200)throw Error('Keine ausreichende historische Kursreihe verfügbar');
  const cutoff=new Date(last.date+'T12:00:00Z');cutoff.setUTCFullYear(cutoff.getUTCFullYear()-6);
  const history=ordered.filter(p=>Date.parse(p.date+'T12:00:00Z')>=cutoff.getTime());
  if(history.length<200)throw Error('Zu wenig Kursdaten');
  if(Date.now()-Date.parse(last.date+'T00:00:00Z')>15*86400000)throw Error('Historischer Kurs zu alt');
  return {name:String(meta.longName||meta.shortName||symbol),providerSymbol:symbol,
    currency,exchange:String(meta.fullExchangeName||meta.exchangeName||'Börsenplatz unbestätigt'),
    price:last.close,date:last.date,points:history,isin:'',
    source:'Yahoo Finance chart über cors.dev (inoffiziell, nicht börslich verifiziert)',
    lastSuccessfulFetchAt:new Date().toISOString(),quotePrecision:'day',
    dynamicExperimental:true};
}
function unityDynamicMarketItem(s){
  if(!s?.providerSymbol)return null;
  const item=unityDynamicItems.get(s.providerSymbol.toUpperCase());
  if(!item||item.currency!==s.currency||!Array.isArray(item.points)||item.points.length<200)return null;
  return {...item,isin:s.isin||''};
}
function unityMarketForStock(s){
  return (s?.isin&&typeof unityMarketItem==='function'?unityMarketItem(s.isin):null)||unityDynamicMarketItem(s);
}
function unityDynamicHistoryId(s){return 'dynamic-history:'+String(s?.id||'')}
function unityHydrateDynamicHistories(list){
  const saved=typeof cache!=='undefined'&&Array.isArray(cache.histories)?cache.histories:[];
  for(const s of list||[]){
    if(!s?.id||!s.providerSymbol)continue;
    const record=saved.find(x=>x.id===unityDynamicHistoryId(s));
    const item=record?.item;
    if(item&&item.providerSymbol&&String(item.providerSymbol).toUpperCase()===String(s.providerSymbol).toUpperCase()&&item.currency===s.currency&&Array.isArray(item.points)&&item.points.length>=200)unityDynamicItems.set(String(s.providerSymbol).toUpperCase(),item);
  }
}
async function unityPersistDynamicHistory(s,item){
  if(!s?.id||typeof put!=='function'||typeof db==='undefined'||!db)return;
  const record={id:unityDynamicHistoryId(s),instrumentId:s.id,providerSymbol:s.providerSymbol,currency:s.currency,item,savedAt:new Date().toISOString(),source:'Dynamische Referenzkursreihe · lokal zwischengespeichert'};
  await put('histories',record);
  if(typeof cache!=='undefined'&&Array.isArray(cache.histories)){const i=cache.histories.findIndex(x=>x.id===record.id);if(i>=0)cache.histories[i]=record;else cache.histories.push(record)}
}
async function unityLoadDynamicStock(s){
  if(!s?.providerSymbol||!unityYahooSymbolValid(s.providerSymbol))return;
  const symbol=s.providerSymbol.toUpperCase();
  const cached=unityDynamicItems.get(symbol);
  if(cached&&Date.now()-Date.parse(cached.lastSuccessfulFetchAt)<30*60000)return;
  if(unityDynamicPending.has(symbol))return unityDynamicPending.get(symbol);
  const task=(async()=>{
    try{
      const item=await unityFetchWorldwideHistory(symbol);
      if(item.currency!==s.currency)throw Error('Währungsabweichung: '+item.currency+' statt '+s.currency);
      unityDynamicItems.set(symbol,item);await unityPersistDynamicHistory(s,item);unityDynamicErrors.delete(symbol);
    }catch(e){unityDynamicErrors.set(symbol,String(e.message||e))}
    finally{unityDynamicPending.delete(symbol);if(!unityDynamicQueueQuiet&&typeof render==='function'&&typeof db!=='undefined'&&db)render()}
  })();
  unityDynamicPending.set(symbol,task);
  return task;
}
async function unityLoadDynamicQueue(list,onProgress=null){
  const unique=[],seen=new Set();let ok=0,failed=0;
  for(const s of list||[]){const symbol=String(s?.providerSymbol||'').toUpperCase();if(s?.id&&unityYahooSymbolValid(symbol)&&!seen.has(symbol)){seen.add(symbol);unique.push(s)}}
  unityDynamicQueueQuiet=true;
  try{for(let i=0;i<unique.length;i++){const stock=unique[i];await unityLoadDynamicStock(stock);if(unityDynamicErrors.has(String(stock.providerSymbol).toUpperCase()))failed++;else ok++;if(typeof onProgress==='function')onProgress({total:unique.length,done:i+1,ok,failed,stock})}}finally{unityDynamicQueueQuiet=false;if(typeof render==='function'&&typeof db!=='undefined'&&db)render()}
  return {total:unique.length,ok,failed};
}

/* Headline-only news discovery. Headlines are NOT investment signals and are
 * never fed into the automated buy/sell gate without source verification. */
const unityNewsItems=new Map(),unityNewsLoading=new Set(),unityNewsErrors=new Map();
async function unityLoadNews(s){
 if(!s?.id||unityNewsLoading.has(s.id))return;
 const old=unityNewsItems.get(s.id);
 if(old&&Date.now()-old.fetchedAt<30*60000)return;
 unityNewsLoading.add(s.id);
 try{
  const q='"'+String(s.name||'').slice(0,70)+'" Aktie';
  const url='https://news.google.com/rss/search?q='+encodeURIComponent(q)+'&hl=de&gl=DE&ceid=DE%3Ade';
  const response=await fetch(unityDiscoveryProxy+url,{credentials:'omit',cache:'no-store'});
  if(!response.ok)throw Error('Nachrichtenquelle HTTP '+response.status);
  const xml=new DOMParser().parseFromString(await response.text(),'application/xml');
  if(xml.querySelector('parsererror'))throw Error('Nachrichtenformat nicht lesbar');
  const news=[...xml.querySelectorAll('item')].slice(0,12).map(node=>{
    const title=String(node.querySelector('title')?.textContent||'').trim().slice(0,180);
    const link=String(node.querySelector('link')?.textContent||'').trim();
    const date=String(node.querySelector('pubDate')?.textContent||'').trim();
    const published=Date.parse(date);
    return {title,link,date:Number.isFinite(published)?new Date(published).toISOString():'',published};
  }).filter(n=>n.title&&/^https:\/\/(news\.google\.com|www\.google\.com)\//.test(n.link)&&
    Number.isFinite(n.published)&&n.published<=Date.now()+60000&&Date.now()-n.published<=31*86400000).slice(0,6);
  unityNewsItems.set(s.id,{fetchedAt:Date.now(),news});
  unityNewsErrors.delete(s.id);
 }catch(e){unityNewsErrors.set(s.id,String(e.message||e))}
 finally{unityNewsLoading.delete(s.id);if(typeof render==='function'&&typeof db!=='undefined'&&db&&typeof activeTab!=='undefined'&&activeTab!=='stocks')render()}
}
function unityNewsPanel(s){
 const data=unityNewsItems.get(s.id);
 let h='<section class="home-news"><h3>Aktuelle Meldungen · externe Quellen</h3>';
 if(!data)h+='<p class="tiny muted">'+(unityNewsErrors.has(s.id)?'Automatischer Nachrichtenabruf derzeit nicht erreichbar.':'Nachrichten werden geladen …')+'</p>';
 else if(!data.news.length)h+='<p class="tiny muted">Keine passenden Meldungen der letzten 31 Tage aus dieser Quelle abrufbar.</p>';
 else for(const n of data.news)h+='<p><a href="'+n.link+'" target="_blank" rel="noopener noreferrer">'+(typeof esc==='function'?esc(n.title):n.title)+'</a><small class="tiny muted"> · '+n.date.slice(0,10)+'</small></p>';
 h+='<p class="tiny muted">Quelle: Google News RSS über cors.dev. Automatisch gefundene Schlagzeilen, nicht auf Vollständigkeit, Zuordnung oder Anlagewirkung geprüft.</p></section>';
 return h;
}
