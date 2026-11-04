'use strict';
/* Keyless browser-readable crypto reference data. Aggregate market data; never broker execution data. */
const unityCryptoMarketCache=new Map(),unityCryptoMarketLoading=new Set(),unityCryptoMarketErrors=new Map();
function unityCryptoCoinId(s){
 if(String(s?.currency||'').toUpperCase()!=='USD')return '';
 return ({BTC:'btc-bitcoin',ETH:'eth-ethereum',ADA:'ada-cardano',SOL:'sol-solana',ETC:'etc-ethereum-classic',XRP:'xrp-xrp',DOT:'dot-polkadot',AVAX:'avax-avalanche',LINK:'link-chainlink',LTC:'ltc-litecoin'})[String(s?.ticker||'').toUpperCase()]||'';
}
function unityCryptoMarketOverride(s){return unityCryptoMarketCache.get(s?.id)||null}
async function unityCryptoEnsureMarket(s){
 if(!unityIsCryptoAsset?.(s))return;
 const old=unityCryptoMarketCache.get(s.id),fresh=Date.now()-Date.parse(old?.fetchedAt||'')<15*60000;
 if(fresh||unityCryptoMarketLoading.has(s.id))return;
 const coin=unityCryptoCoinId(s);if(!coin){unityCryptoMarketErrors.set(s.id,'Für diesen Kryptowert ist noch keine schlüssellose Referenzquelle hinterlegt.');return}
 unityCryptoMarketLoading.add(s.id);unityCryptoMarketErrors.delete(s.id);
 try{
  const end=new Date(),start=new Date(end.getTime()-370*86400000),base='https://api.coinpaprika.com/v1/tickers/'+encodeURIComponent(coin),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
  let t,h;try{[t,h]=await Promise.all([fetch(base,{cache:'no-store',signal:controller.signal}),fetch(base+'/historical?start='+start.toISOString().slice(0,10)+'&end='+end.toISOString().slice(0,10)+'&interval=24h',{cache:'no-store',signal:controller.signal})])}finally{clearTimeout(timer)}
  if(!t.ok||!h.ok)throw Error('CoinPaprika antwortet derzeit nicht vollständig.');
  const [ticker,history]=await Promise.all([t.json(),h.json()]),quote=ticker?.quotes?.USD;
  const byDate=new Map();
  for(const row of Array.isArray(history)?history:[]){const date=String(row?.timestamp||'').slice(0,10),close=Number(row?.price),volume=Number(row?.volume_24h);if(date&&close>0)byDate.set(date,{date,close,volume:Number.isFinite(volume)&&volume>0?volume:0})}
  const points=[...byDate.values()].sort((a,b)=>a.date.localeCompare(b.date)),price=Number(quote?.price);
  if(!(price>0)||points.length<200)throw Error('Zu wenig gültige CoinPaprika-Tageswerte.');
  unityCryptoMarketCache.set(s.id,{points,date:points.at(-1)?.date||'',price,volume24:Number(quote?.volume_24h),marketCap:Number(quote?.market_cap),source:'CoinPaprika · USD-Referenz · Marktaggregat',fetchedAt:new Date().toISOString()});
 }catch(e){unityCryptoMarketErrors.set(s.id,String(e?.message||e))}
 finally{unityCryptoMarketLoading.delete(s.id);if(typeof render==='function'&&typeof db!=='undefined'&&db)render()}
}