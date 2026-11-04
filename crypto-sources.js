'use strict';
/* Static crypto market snapshot. Downloaded server-side, never via iPhone browser CORS. */
const unityCryptoMarketCache=new Map(),unityCryptoMarketLoading=new Set(),unityCryptoMarketErrors=new Map();
function unityCryptoCoinId(s){
 return ({BTC:'btc-bitcoin',ETH:'eth-ethereum',ADA:'ada-cardano',SOL:'sol-solana',ETC:'etc-ethereum-classic',XRP:'xrp-xrp',DOT:'dot-polkadot',AVAX:'avax-avalanche',LINK:'link-chainlink',LTC:'ltc-litecoin'})[String(s?.ticker||'').toUpperCase()]||'';
}
function unityCryptoMarketOverride(s){return unityCryptoMarketCache.get(s?.id)||null}
function unityCryptoEnsureMarket(s){
 if(!unityIsCryptoAsset?.(s)||unityCryptoMarketCache.has(s.id)||unityCryptoMarketLoading.has(s.id))return;
 unityCryptoMarketLoading.add(s.id);unityCryptoMarketErrors.delete(s.id);
 try{
  const ticker=String(s?.ticker||'').toUpperCase(),snapshot=globalThis.UNITY_CRYPTO_MARKET_SNAPSHOT;
  if(!snapshot||!snapshot.assets)throw Error('Krypto-Snapshot wird noch bereitgestellt.');
  const raw=snapshot.assets[ticker];
  if(!raw)throw Error('Für diesen Kryptowert liegt noch kein geprüfter Snapshot vor.');
  const byDate=new Map();
  for(const row of Array.isArray(raw.points)?raw.points:[]){const date=String(row?.date||'').slice(0,10),close=Number(row?.close),volume=Number(row?.volume);if(date&&close>0)byDate.set(date,{date,close,volume:Number.isFinite(volume)&&volume>0?volume:0})}
  const points=[...byDate.values()].sort((a,b)=>a.date.localeCompare(b.date)),price=Number(raw?.price),fetchedAt=String(raw?.fetchedAt||snapshot.generatedAt||'');
  if(!(price>0)||points.length<200||!Number.isFinite(Date.parse(fetchedAt)))throw Error('Krypto-Snapshot ist unvollständig.');
  unityCryptoMarketCache.set(s.id,{points,date:String(raw.date||points.at(-1)?.date||''),price,volume24:Number(raw.volume24),marketCap:Number(raw.marketCap),source:String(raw.source||snapshot.source||'Krypto-Marktdaten-Snapshot'),venue:String(raw.venue||'Marktaggregat'),fetchedAt});
 }catch(e){unityCryptoMarketErrors.set(s.id,String(e?.message||e))}
 finally{unityCryptoMarketLoading.delete(s.id);if(typeof render==='function'&&typeof db!=='undefined'&&db)render()}
}
