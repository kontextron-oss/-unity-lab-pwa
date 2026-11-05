'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const crypto={id:'sol',name:'Solana',ticker:'SOL',exchange:'Krypto USD',currency:'USD',providerSymbol:'SOL-USD',group:'Krypto · Beobachtung'};
const sandbox={
  Date,Math,Number,Array,JSON,Set,setTimeout(){},stocks:()=>[crypto],
  esc:v=>String(v??''),number:(v,d=2)=>Number(v).toFixed(d),euro:v=>Number(v).toFixed(2)+' €',
  unityMarketItem:()=>null,unityDataQuality:()=>null,unityDisplayQuote:()=>null,
  unityChartData:()=>[],depotPosition:()=>({qty:0,cost:0,pnl:NaN,buys:0,sells:0}),
  depotMoney:v=>Number(v).toFixed(2)+' €',depotTradeHistory:()=>'',document:{addEventListener(){}},
  render(){},put:async()=>{},audit:async()=>{},refresh:async()=>{},alert(){},
  unityCryptoMarketOverride:()=>null
};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('crypto-policy.js','utf8'),sandbox);
vm.runInContext(fs.readFileSync('home.js','utf8'),sandbox);
assert.equal(vm.runInContext('unityIsCryptoAsset('+JSON.stringify(crypto)+')',sandbox),true);
const detail=vm.runInContext("unityHomeDetail('sol')",sandbox);
assert.match(detail,/Kryptoanalyse/);
assert.match(detail,/UNITY · Krypto-Analyse/);
for(const label of ['Preis & Liquidität','Trend & Einstieg','Netzwerk & Nutzung','Tokenökonomie','Ereignisse & Risiko'])assert.match(detail,new RegExp(label));
assert.doesNotMatch(detail,/Aktienansicht|UNITY · Entscheidungsreife|Fundamentaldaten|Earnings|Guidance|Bewertung & Risiko/);
console.log('Crypto routing: separate crypto-only detail view and no corporate readiness fields passed.');
