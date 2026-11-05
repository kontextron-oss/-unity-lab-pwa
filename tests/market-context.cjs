'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const make=(fn)=>Array.from({length:260},(_,i)=>({date:'d'+i,close:fn(i)}));
const benchmark={name:'SPDR S&P 500 UCITS ETF',date:'d259',price:130,source:'dated EOD',points:make(i=>100*Math.pow(1.001,i))};
const stock={name:'Testwert',isin:'TEST',currency:'EUR',points:make(i=>100*Math.pow(1.0018,i))};
const sandbox={Math,Number,Array,Map,esc:v=>String(v??''),number:(v,d)=>Number(v).toFixed(d),
 unityMarket:{items:{'@SPY5.DE':benchmark}},unityMarketForStock:()=>stock,unityIsCryptoAsset:()=>false};
vm.createContext(sandbox);vm.runInContext(fs.readFileSync('market-context.js','utf8'),sandbox);
const c=vm.runInContext("unityMarketContext({isin:'TEST',currency:'EUR'})",sandbox);
assert.equal(c.available,true);assert.ok(c.relative63>0);assert.ok(c.volatility20>0);assert.equal(c.regime.kind,'constructive');
const panel=vm.runInContext("unityMarketContextPanel({isin:'TEST',currency:'EUR'})",sandbox);
assert.match(panel,/Relative Stärke/);assert.match(panel,/Volatilität/);assert.match(panel,/Marktumfeld technisch konstruktiv/);
const stress={...benchmark,points:make(i=>i<235?120:120*Math.pow(.99,i-234)),price:120*Math.pow(.99,25),date:'d259'};
sandbox.unityMarket={items:{'@SPY5.DE':stress}};
const regime=vm.runInContext('unityMarketRegime(unityBenchmarkItem())',sandbox);
assert.equal(regime.kind,'stress');
sandbox.unityIsCryptoAsset:s=>/krypto/i.test(String(s?.exchange||''));
assert.equal(vm.runInContext("unityMarketContextPanel({exchange:'Krypto USD'})",sandbox),'');
console.log('Market context: aligned benchmark strength, volatility and stress filter passed.');
