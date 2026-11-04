'use strict';
/* Keyless Kraken reference data. One venue only; never broker execution data. */
const unityCryptoMarketCache=new Map(),unityCryptoMarketLoading=new Set(),unityCryptoMarketErrors=new Map();
function unityCryptoKrakenPair(s){
 if(String(s?.currency||'').toUpperCase()!=='USD')return '';
 return ({BTC:'XBTUSD',ETH:'ETHUSD',ADA:'ADAUSD',SOL:'SOLUSD',ETC:'ETCUSD',XRP:'XRPUSD',DOT:'DOTUSD',AVAX:'AVAXUSD',LINK:'LINKUSD',LTC:'LTCUSD'})[String(s?.ticker||'').toUpperCase()]||'';
}
function unityCryptoMarketOverride(s){return unityCryptoMarketCache.get(s?.id)||null}
async function unityCryptoEnsureMarket(s){
 if(!unityIsCryptoAsset?.(s))return;
 const old=unityCryptoMarketCache.get(s.id),fresh=Date.now()-Date.parse(old?.fetchedAt||'')<15*60000;
 if(fresh||unityCryptoMarketLoading.has(s.id))return;
 const pair=unityCryptoKrakenPair(s);if(!pair){unityCryptoMarketErrors.set(s.id,'Für dieses Handelspaar ist noch keine schlüssellose Referenzquelle hinterlegt.');return}
 unityCryptoMarketLoading.add(s.id);unityCryptoMarketErrors.delete(s.id);
 try{
  const base='https://api.kraken.com/0/public/',[t,o,d]=await Promise.all([fetch(base+'Ticker?pair='+pair,{cache:'no-store'}),fetch(base+'OHLC?pair='+pair+'&interval=1440',{cache:'no-store'}),fetch(base+'Depth?pair='+pair+'&count=10',{cache:'no-store'})]);
  if(!t.ok||!o.ok||!d.ok)throw Error('Kraken antwortet derzeit nicht vollständig.');
  const [ticker,ohlc,depth]=await Promise.all([t.json(),o.json(),d.json()]);
  if(ticker.error?.length||ohlc.error?.length||depth.error?.length)throw Error('Kraken meldet keine gültigen Daten für '+pair+'.');
  const k=Object.keys(ohlc.result||{}).find(x=>x!=='last'),qk=Object.keys(ticker.result||{})[0],dk=Object.keys(depth.result||{})[0],rows=ohlc.result?.[k];
  const points=Array.isArray(rows)?rows.slice(-720).map(x=>({date:new Date(Number(x[0])*1000).toISOString().slice(0,10),close:Number(x[4]),volume:Number(x[6])})).filter(x=>x.close>0):[];
  const q=ticker.result?.[qk],book=depth.result?.[dk],price=Number(q?.c?.[0]);
  if(!(price>0)||points.length<200)throw Error('Zu wenig gültige Kraken-Tageskerzen.');
  unityCryptoMarketCache.set(s.id,{points,date:points.at(-1)?.date||'',price,bid:Number(q?.b?.[0]),ask:Number(q?.a?.[0]),volume24:Number(q?.v?.[1]),trades24:Number(q?.t?.[1]),bookLevels:Math.min(book?.bids?.length||0,book?.asks?.length||0),source:'Kraken Spot · '+pair+' · Einzelbörse',fetchedAt:new Date().toISOString()});
 }catch(e){unityCryptoMarketErrors.set(s.id,String(e?.message||e))}
 finally{unityCryptoMarketLoading.delete(s.id);if(typeof render==='function'&&typeof db!=='undefined'&&db)render()}
}