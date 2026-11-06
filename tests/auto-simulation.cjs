'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('home.js','utf8');
const start=source.indexOf('const unityZonePlanId='),end=source.indexOf('function unityHomeVerdict(s)',start);
assert.ok(start>=0&&end>start,'Automation functions must be present');
const buyStock={id:'s1',name:'ABB',ticker:'ABBN',currency:'EUR'};
const sellStock={id:'s2',name:'Siemens Energy',ticker:'ENR',currency:'EUR'};
const cache={instruments:[buyStock,sellStock],settings:[
  {id:'auto-test-buy:s1',kind:'auto-test-buy',instrumentId:'s1',mode:'technical',allocationPct:2,active:true,createdAt:'2026-11-06T10:00:00Z'},
  {id:'auto-test-sell:s2',kind:'auto-test-sell',instrumentId:'s2',active:true,createdAt:'2026-11-06T10:00:00Z'}
],transactions:[]};
let marketDate='2026-11-06',sellPrice=85,seq=0,deepCalls=0;
const sandbox={Date,Math,Number,Array,JSON,cache,
 stocks:()=>cache.instruments,esc:x=>String(x??''),
 unityHomeQuote:s=>({x:{date:marketDate,price:s.id==='s1'?100:sellPrice,currency:'EUR',dynamicExperimental:false},
   quality:{canCompare:true},technical:true,m:{ma50:100,ma200:90}}),
 unityPullbackAlert:s=>s.id==='s1'?{kind:'reached',low:98,high:102,close:100,date:marketDate}:
   {kind:'none',label:'',detail:'Trend schwach'},
 unityDeepDecision:()=>{deepCalls++;return {investmentReady:false,kind:'data'};},
 unityCalc:()=>({f:{}}),
 depotPosition:s=>({qty:s.id==='s2'?5:0}),
 depotCapital:()=>({configured:true,free:1000}),
 unityEuroRate:()=>({rate:1,source:'EUR = 1'}),
 depotMoney:n=>Number(n).toFixed(2)+' €',
 number:(n,d=2)=>Number(n).toFixed(d),
 id:()=> 'test-'+(++seq),
 put:async (store,entry)=>{const records=cache[store],index=records.findIndex(x=>x.id===entry.id);if(index>=0)records[index]=entry;else records.push(entry);},
 audit:async()=>{},refresh:async()=>{}
};
vm.createContext(sandbox);
vm.runInContext(source.slice(start,end),sandbox);
const html=sandbox; // all global function declarations are exposed on this sandbox
assert.match(vm.runInContext('unityAutoOrdersSummary()',sandbox),/Automatik · Testdepot/);
assert.match(vm.runInContext('unityAutoOrdersSummary()',sandbox),/Auftrag stoppen/);
assert.match(vm.runInContext('unityAutoStockPanel(sellStock)',Object.assign(sandbox,{sellStock})),/Automatischer Testverkauf/);
assert.match(vm.runInContext('unityAutoStockBadge(buyStock)',Object.assign(sandbox,{buyStock})),/vorgemerkt/);
(async()=>{
 await vm.runInContext('unityRunAutoTestBuys()',sandbox);
 assert.equal(cache.transactions.length,0,'No simulated fill using a close dated on/before activation date');
 marketDate='2026-11-09';
 await vm.runInContext('unityRunAutoTestBuys()',sandbox);
 assert.equal(cache.transactions.length,2,'Both technical buy and technical sell should execute');
 const buy=cache.transactions.find(t=>t.type==='BUY'),sell=cache.transactions.find(t=>t.type==='SELL');
 assert.equal(buy.source,'UNITY Lab · Auto-Testkauf');
 assert.equal(buy.quantity,0.2,'2% of 1000 EUR at 100 EUR');
 assert.equal(sell.quantity,5,'Sell all test shares when protective level is breached');
 assert.equal(sell.price,85,'Sell uses quote rather than disabled pullback signal');
 assert.equal(cache.settings.every(x=>x.active===false),true,'Orders marked executed');
 assert.equal(deepCalls,0,'Strict evaluation is skipped unless a strict buy order is armed');
 assert.match(vm.runInContext('unityAutoOrdersSummary()',sandbox),/20.00 €/);
 assert.match(vm.runInContext('unityAutoStockBadge(buyStock)',sandbox),/gebucht/);
 await vm.runInContext('unityRunAutoTestBuys()',sandbox);
 assert.equal(cache.transactions.length,2,'No duplicate fills on repeat refresh');
 const index=fs.readFileSync('index.html','utf8'),sw=fs.readFileSync('sw.js','utf8');
 assert.match(index,/home\.js\?v=0\.15\.1/);
 assert.match(sw,/home\.js\?v=0\.15\.1/);
 assert.match(sw,/unity-lab-v0\.15\.1/);
 console.log('Auto simulation: visible orders, EUR totals, 2% sizing, fresh closes, technical sell, no double-fill, cache version passed.');
})().catch(e=>{console.error(e);process.exitCode=1});
