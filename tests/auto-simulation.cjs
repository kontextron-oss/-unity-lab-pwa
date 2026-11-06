'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {createPaperDB}=require('./fake-paper-indexeddb.cjs');
const source=fs.readFileSync('home.js','utf8');
const start=source.indexOf('const unityZonePlanId='),end=source.indexOf('function unityHomeVerdict(s)',start);
assert.ok(start>=0&&end>start,'Automation functions must be present');
const buyStock={id:'s1',name:'ABB',ticker:'ABBN',currency:'EUR'};
const sellStock={id:'s2',name:'Siemens Energy',ticker:'ENR',currency:'EUR'};
const buyers=[buyStock,...Array.from({length:9},(_,i)=>({id:'s'+(i+3),
  name:'Pilot '+(i+3),ticker:'P'+(i+3),currency:'EUR'}))];
const cache={instruments:[...buyers,sellStock],settings:[
  {id:'portfolio-capital',amount:1000},
  {id:'auto-test-buy-total-budget',limitEur:300},
  ...buyers.map(s=>({id:'auto-test-buy:'+s.id,kind:'auto-test-buy',instrumentId:s.id,
    mode:'technical',allocationEur:100,active:true,createdAt:'2026-11-06T10:00:00Z'})),
  {id:'auto-test-sell:s2',kind:'auto-test-sell',instrumentId:'s2',mode:'technical',
    active:true,createdAt:'2026-11-06T10:00:00Z'}
],transactions:[
  {id:'manual-start',instrumentId:'s2',type:'BUY',quantity:5,amount:425,price:85,fx:1,
    fee:0,executedAt:'2026-11-04',source:'Manueller Testbestand'}],audit:[],analyses:[]};
let marketDate='2026-11-06',sellPrice=85,deepCalls=0,allowBuy=true,refreshes=0;
const fake=createPaperDB(cache);
let seq=0;
const sandbox={Date,Math,Number,Array,JSON,cache,db:fake,
 stocks:()=>cache.instruments,esc:x=>String(x??''),
 unityHomeQuote:s=>({x:{date:marketDate,price:s.id==='s2'?sellPrice:100,
   currency:'EUR',exchange:'Xetra',dynamicExperimental:false},
   valid:true,quality:{canCompare:true},technical:true,m:{ma50:100,ma200:90}}),
 unityPullbackAlert:s=>s.id==='s2'?{kind:'none',label:'',detail:'Trend schwach'}:
   {kind:'reached',low:98,high:102,close:100,date:marketDate},
 unityDeepDecision:()=>{deepCalls++;return {investmentReady:false,kind:'data'};},
 unityDecisionForStock:s=>({action:s.id==='s2'?'SELL':allowBuy?'BUY':'BLOCKED',
   testActionEligible:true,reasonCode:s.id==='s2'?'technical-exit':'technical-entry'}),
 unityCalc:()=>({f:{}}),
 depotPosition:s=>({qty:s.id==='s2'?5:0}),
 depotCapital:()=>{
   const funded=1000,buys=cache.transactions.filter(t=>!t.voidedAt&&t.type==='BUY')
     .reduce((n,t)=>n+t.amount*t.fx+(t.fee||0),0),
     sells=cache.transactions.filter(t=>!t.voidedAt&&t.type==='SELL')
       .reduce((n,t)=>n+t.amount*t.fx-(t.fee||0),0);
   return {configured:true,free:funded-buys+sells};
 },
 unityEuroRate:()=>({rate:1,date:marketDate,source:'EUR = 1'}),
 depotMoney:n=>Number(n).toFixed(2)+' €',
 number:(n,d=2)=>Number(n).toFixed(d),
 id:()=> 'test-'+(++seq),
 put:async(store,entry)=>{const records=cache[store],index=records.findIndex(x=>x.id===entry.id);
   if(index>=0)records[index]=entry;else records.push(entry);},
 audit:async()=>{},refresh:async()=>{refreshes++;}
};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('paper-order-engine.js','utf8'),sandbox);
vm.runInContext(source.slice(start,end),sandbox);
const invoke=code=>vm.runInContext(code,sandbox);
assert.match(invoke('unityAutoOrdersSummary()'),/Automatik · Testdepot/);
assert.match(invoke('unityAutoOrdersSummary()'),/Auftrag stoppen/);
assert.match(invoke('unityAutoOrdersSummary()'),/Betrag ändern/);
assert.match(invoke('unityAutoOrdersSummary()'),/Gesamtbudget für automatische Testkäufe/);
assert.match(invoke('unityAutoOrdersSummary()'),/Modellkosten und Ausführungsannahmen/);
assert.match(invoke('unityAutoStockPanel(sellStock)',Object.assign(sandbox,{sellStock})),/Automatischer Testverkauf/);
assert.match(invoke('unityAutoStockBadge(buyStock)',Object.assign(sandbox,{buyStock})),/vorgemerkt/);
(async()=>{
 await invoke('unityRunAutoTestBuys()');
 assert.equal(cache.transactions.length,1,'Activation-day close cannot produce even a trigger');
 assert.equal(cache.settings.filter(x=>x.triggerQuoteDate).length,0);
 marketDate='2026-11-09';
 allowBuy=false;
 await invoke('unityRunAutoTestBuys()');
 assert.equal(cache.settings.filter(x=>x.kind==='auto-test-buy'&&x.triggerQuoteDate).length,0,
   'Central policy block suppresses BUY signal');
 allowBuy=true;
 await invoke('unityRunAutoTestBuys()');
 assert.equal(cache.transactions.length,1,'Signal records never create retroactive fills');
 assert.equal(cache.settings.filter(x=>x.triggerQuoteDate).length,11,
   'Ten buy orders and a protective sale are recorded as durable triggers');
 assert.match(invoke('unityAutoOrdersSummary()'),/wartet auf späteren Tageskurs/);
 await invoke('unityRunAutoTestBuys()');
 assert.equal(cache.transactions.length,1,'Repeated checks of the same EOD cannot fill a single order');
 marketDate='2026-11-10';
 await invoke('unityRunAutoTestBuys()');
 const buys=()=>cache.transactions.filter(t=>t.type==='BUY'&&t.source==='UNITY Lab · Auto-Testkauf');
 const sells=()=>cache.transactions.filter(t=>t.type==='SELL'&&t.source==='UNITY Lab · Auto-Testverkauf');
 assert.equal(buys().length,3,'EUR 300 cap allows only three 100 EUR test buys');
 assert.equal(sells().length,1,'Protective sale independently executes at the NEXT observed EOD');
 assert.equal(buys().every(t=>t.price>100),true,'Modeled buy fills include spread/slippage');
 assert.equal(buys().every(t=>Math.abs(t.amount*t.fx+t.fee-100)<1e-7),true,'EUR budget includes the fee');
 assert.equal(buys().every(t=>t.decisionSnapshot.triggerQuoteDate==='2026-11-09'),true);
 assert.equal(buys().every(t=>t.decisionSnapshot.quoteDate==='2026-11-10'),true);
 assert.equal(sells()[0].fee,1,'Sell includes modeled commission');
 assert.ok(sells()[0].price<85,'Sell price estimates model spread/slippage on the new EOD');
 assert.equal(invoke('unityAutoBudgetStatus().spent'),300);
 assert.equal(invoke('unityAutoBudgetStatus().remaining'),0);
 assert.equal(cache.settings.filter(x=>x.kind==='auto-test-buy'&&x.active).length,7);
 await invoke('unityRunAutoTestBuys()');
 assert.equal(buys().length,3,'No double booking after repeat refresh with same date');
 assert.equal(await invoke('unityAutoSetBudget(500)'),true);
 marketDate='2026-11-11';
 await invoke('unityRunAutoTestBuys()');
 assert.equal(buys().length,5,'Budget increased to 500 EUR permits two more fills');
 assert.equal(invoke('unityAutoBudgetStatus().spent'),500);
 assert.equal(cache.settings.filter(x=>x.kind==='auto-test-buy'&&x.active).length,5);
 assert.equal(await invoke('unityAutoSetBudget(550)'),true);
 marketDate='2026-11-12';
 await invoke('unityRunAutoTestBuys()');
 assert.equal(buys().length,5,'50 EUR remainder cannot buy a partial 100 EUR allocation');
 assert.equal(invoke('unityAutoBudgetStatus().remaining'),50);
 assert.equal(deepCalls,0,'Technical test mode must not be mistaken for fundamental permission');
 assert.equal(cache.audit.filter(x=>x.type==='AUTO_TEST_BUY').length,5);
 assert.equal(cache.audit.filter(x=>x.type==='AUTO_TEST_SELL').length,1);
 const idx=fs.readFileSync('index.html','utf8'),sw=fs.readFileSync('sw.js','utf8');
 assert.match(idx,/paper-order-engine\.js\?v=0\.15\.3\.9/);
 assert.match(sw,/paper-order-engine\.js\?v=0\.15\.3\.9/);
 assert.match(sw,/unity-lab-v0\.15\.3\.9/);
 console.log('Auto simulation: 10 staged triggers, next-observed-EOD fills with fees/spread, 300/500 EUR caps, protective sell, no duplicate or partial fills passed.');
})().catch(err=>{console.error(err);process.exitCode=1});
