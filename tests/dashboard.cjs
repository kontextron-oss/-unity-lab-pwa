'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const data=JSON.parse(fs.readFileSync('data/market.json','utf8'));
const html=fs.readFileSync('index.html','utf8');
assert.match(html,/unityComparisonView\(\)/);
assert.match(html,/<script src="\.\/dashboard\.js"><\/script>/);
assert.match(html,/<script src="\.\/charts\.js"><\/script>/);
assert.match(html,/<script src="\.\/dataquality\.js(?:\?v=[0-9.]+)?"><\/script>/);
const CATALOG=[
  {name:'ABB',ticker:'ABBN',isin:'CH0012221716',currency:'CHF',exchange:'SIX'},
  {name:'Schneider Electric',ticker:'SU',isin:'FR0000121972',currency:'EUR',exchange:'Paris'},
];
const sandbox={
 CATALOG,stocks:()=>[],document:{addEventListener(){}},db:null,fetch:async()=>({ok:true,json:async()=>data}),
 AbortController,Date,Number,Math,Set,Array,JSON,setTimeout,clearTimeout,
 number:(x,d=2)=>Number.isFinite(x)?x.toFixed(d):'–',
 esc:s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;'),
 render(){},
};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('charts.js','utf8'),sandbox);
vm.runInContext(fs.readFileSync('dataquality.js','utf8'),sandbox);
vm.runInContext(fs.readFileSync('dashboard.js','utf8'),sandbox);
(async()=>{
 await new Promise(resolve=>setTimeout(resolve,100));
 const result=vm.runInContext("({rows:unityRows().length,sample:unityMetrics(unityMarketItem('FR0000121972')),page:unityComparisonView(),detail:unityCompanyView('FR0000121972',true)})",sandbox);
 assert.equal(result.rows,2);
 assert.ok(Number.isFinite(result.sample.rsi));
 assert.ok(Number.isFinite(result.sample.r63));
 assert.ok(result.sample.technicalIndex>=0&&result.sample.technicalIndex<=100);
 assert.match(result.page,/Keine Kauf-Freigabe/);
 assert.match(result.page,/Schneider Electric/);
 assert.match(result.detail,/Ist ein Kauf sinnvoll/);
 assert.match(result.detail,/<svg/);
 assert.match(result.page,/unity-sparkline/);
 assert.match(result.page,/Datenqualität prüfen/);
 assert.equal(vm.runInContext("unityBusinessDaysSince('2026-10-30',new Date('2026-11-01T09:00:00Z'))",sandbox),0);
 assert.equal(vm.runInContext("unityBusinessDaysSince('2026-10-30',new Date('2026-11-04T09:00:00Z'))",sandbox),3);
 console.log('Dashboard: data loaded, metrics calculated, 2 stocks compared, buy-veto visible.');
})().catch(e=>{console.error(e);process.exitCode=1});
