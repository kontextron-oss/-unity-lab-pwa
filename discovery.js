/* Experimental zero-key worldwide equity discovery and six-year reference history.
 * The CORS relay is a third-party service. Yahoo endpoints are unofficial and
 * neither exchange-verified nor licensed for trading decisions. Fail closed. */
const unityDiscoveryProxy='https://proxy.cors.dev/';
const unityDynamicItems=new Map(),unityDynamicPending=new Map(),unityDynamicErrors=new Map();
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
      unityDynamicItems.set(symbol,item);unityDynamicErrors.delete(symbol);
    }catch(e){unityDynamicErrors.set(symbol,String(e.message||e))}
    finally{unityDynamicPending.delete(symbol);if(typeof render==='function'&&typeof db!=='undefined'&&db)render()}
  })();
  unityDynamicPending.set(symbol,task);
  return task;
}
