'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');
assert.match(html,/depot\.js/);
assert.match(html,/function overview\(\)\{return typeof unityHome/);
assert.match(html,/depotSellForm\(\)/);
assert.match(html,/depot\.js/);
assert.match(html,/\['unity-fund','unity-csv','sell-form'\]/);
const stock={id:'s1',isin:'FR0000121972',name:'Schneider Electric',currency:'EUR',ticker:'SU'};
const transactions=[
 {id:'a',instrumentId:'s1',type:'BUY',executedAt:'2025-01-01T10:00:00Z',createdAt:'2025-01-01T10:00:00Z',quantity:10,amount:1000,price:100,fx:1,fee:5},
 {id:'b',instrumentId:'s1',type:'SELL',executedAt:'2025-02-01T10:00:00Z',createdAt:'2025-02-01T10:00:00Z',quantity:4,amount:480,price:120,fx:1,fee:3},
 {id:'c',instrumentId:'s1',type:'BUY',executedAt:'2025-03-01T10:00:00Z',createdAt:'2025-03-01T10:00:00Z',quantity:2,amount:220,price:110,fx:1,fee:2},
];
const sandbox={
 cache:{transactions,instruments:[stock],settings:[{id:'portfolio-capital',amount:2000}]},stocks:()=>[stock],quote:()=>({price:115,fx:1,quotedAt:new Date().toISOString()}),
 unityMarketItem:()=>({price:115,date:'2026-10-30',exchange:'Paris',points:[{date:'2026-10-30',close:115}]}),unityChartData:()=>[{close:100},{close:115}],unityChartSvg:()=>'<svg></svg>',unityChartPanel:()=>'<svg></svg>',unityMetrics:()=>null,
 unityDataQuality:()=>({canCompare:true}),document:{addEventListener(){}},render(){},Date,Math,Number,Array,JSON,
 number:(n,d=2)=>Number(n).toFixed(d),euro:n=>Number(n).toFixed(2)+' €',esc:s=>String(s??''),
 localNow:()=>new Date().toISOString(),audit:async()=>{},refresh:async()=>{},put:async()=>{},
 id:()=>Math.random().toString(),alert:()=>{},unityPct:n=>Number(n).toFixed(1)+' %',
};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('depot.js','utf8'),sandbox);
const x=vm.runInContext("depotLedger('s1')",sandbox);
assert.equal(x.qty,8);
assert.equal(x.cost,825);
assert.equal(x.realized,75);
assert.equal(x.buys,2);
assert.equal(x.sells,1);
const capital=vm.runInContext('depotCapital()',sandbox);
assert.equal(capital.funded,2000);
assert.equal(capital.deposits,0);
assert.equal(capital.invested,825);
assert.equal(capital.free,1250);
const asOf=vm.runInContext("depotLedger('s1','2025-01-15')",sandbox);
assert.equal(asOf.qty,10);
assert.equal(asOf.cost,1005);
const overview=vm.runInContext("depotOverview()",sandbox);
assert.match(overview,/Mein Depot/);
assert.match(overview,/Simulation/);
assert.match(overview,/Schneider Electric/);
const detail=vm.runInContext("depotDetail('s1')",sandbox);
assert.match(detail,/Käufe und Verkäufe/);
assert.match(detail,/Verkauf/);
assert.match(detail,/Gebühr/);
assert.match(detail,/<svg/);
assert.match(fs.readFileSync('charts.js','utf8'),/'6Y':1600/);
console.log('Depot ledger: weighted cost, realized gains, transactions and chart detail passed.');
