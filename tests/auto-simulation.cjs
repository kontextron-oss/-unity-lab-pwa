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
],transactions:[],audit:[]};
let marketDate='2026-11-06',sellPrice=85,seq=0,deepCalls=0,allowBuy=true,refreshes=0;
const sandbox={Date,Math,Number,Array,JSON,cache,
 stocks:()=>cache.instruments,esc:x=>String(x??''),
 unityHomeQuote:s=>({x:{date:marketDate,price:s.id==='s2'?sellPrice:100,currency:'EUR',dynamicExperimental:false},
   quality:{canCompare:true},technical:true,m:{ma50:100,ma200:90}}),
 unityPullbackAlert:s=>s.id==='s2'?{kind:'none',label:'',detail:'Trend schwach'}:
   {kind:'reached',low:98,high:102,close:100,date:marketDate},
 unityDeepDecision:()=>{deepCalls++;return {investmentReady:false,kind:'data'};},
 unityDecisionForStock:s=>({action:s.id==='s2'?'SELL':allowBuy?'BUY':'BLOCKED',testActionEligible:true}),
 unityCalc:()=>({f:{}}),
 depotPosition:s=>({qty:s.id==='s2'?5:0}),
 depotCapital:()=>({configured:true,free:1000-cache.transactions.filter(t=>t.type==='BUY'&&!t.voidedAt)
    .reduce((n,t)=>n+t.amount*t.fx+(Number(t.fee)||0),0)}),
 unityEuroRate:()=>({rate:1,source:'EUR = 1'}),
 depotMoney:n=>Number(n).toFixed(2)+' €',
 number:(n,d=2)=>Number(n).toFixed(d),
 id:()=> 'test-'+(++seq),
 put:async(store,entry)=>{const records=cache[store],index=records.findIndex(x=>x.id===entry.id);if(index>=0)records[index]=entry;else records.push(entry);},
 audit:async()=>{},refresh:async()=>{refreshes++;},
 db:{transaction:(stores,mode)=>{
   assert.deepEqual([...stores],['settings','audit']);
   assert.equal(mode,'readwrite');
   const writes=[];
   const tx={oncomplete:null,onerror:null,onabort:null,
     objectStore:name=>({put:entry=>writes.push({name,entry})})};
   queueMicrotask(()=>{
     for(const {name,entry} of writes){
       const rows=cache[name],i=rows.findIndex(x=>x.id===entry.id);
       if(i>=0)rows[i]=entry;else rows.push(entry);
     }
     tx.oncomplete?.();
   });
   return tx;
 }}
};
vm.createContext(sandbox);
vm.runInContext(source.slice(start,end),sandbox);
const invoke=(js)=>vm.runInContext(js,sandbox);
assert.match(invoke('unityAutoOrdersSummary()'),/Automatik · Testdepot/);
assert.match(invoke('unityAutoOrdersSummary()'),/Auftrag stoppen/);
assert.match(invoke('unityAutoOrdersSummary()'),/Betrag ändern/);
assert.match(invoke('unityAutoOrdersSummary()'),/Gesamtbudget für automatische Testkäufe/);
assert.match(invoke('unityAutoOrdersSummary()'),/Noch nicht festgelegt/);
assert.match(invoke('unityAutoStockPanel(sellStock)',Object.assign(sandbox,{sellStock})),/Automatischer Testverkauf/);
assert.match(invoke('unityAutoStockBadge(buyStock)',Object.assign(sandbox,{buyStock})),/vorgemerkt/);
assert.match(invoke('unityAutoBuyControls(buyStock,unityAutoBuy(buyStock),"technical")'),/Betrag noch festzulegen/);
assert.match(invoke('unityAutoBuyControls(buyStock,unityAutoBuy(buyStock),"technical")'),/Betrag speichern/);
assert.match(invoke('unityAutoBuyControls(buyStock,unityAutoBuy(buyStock),"technical")'),/100.00/);
(async()=>{
 await invoke('unityRunAutoTestBuys()');
 assert.equal(cache.transactions.length,0,'No fill from a close dated on/before activation date');
 const tenOld=Array.from({length:10},(_,i)=>({id:'auto-test-buy:old-'+i,kind:'auto-test-buy',
   active:true,allocationPct:10,createdAt:'2026-11-05T10:00:00Z'}));
 const migrationPlan=invoke('unityAutoMigrationPlan('+JSON.stringify(tenOld)+',1000,0,"2026-11-06T11:00:00Z")');
 assert.equal(migrationPlan.count,10,'Ten old orders should be convertible');
 assert.equal(migrationPlan.changes.reduce((n,o)=>n+o.allocationEur,0),1000,
   'Percentages fixed against identical 1000 EUR capital snapshot');
 assert.equal(migrationPlan.budget.limitEur,1000,'Auto budget limited to sum of migrated orders and free capital');
 assert.ok(migrationPlan.changes.every(o=>o.allocationPct===undefined));
 const before=cache.settings.find(x=>x.instrumentId==='s1'&&x.kind==='auto-test-buy');
 assert.equal(await invoke('unityAutoMigrateLegacy()'),true,'Refresh auto-migrates prior orders in one transaction');
 const migrated=cache.settings.find(x=>x.instrumentId==='s1'&&x.kind==='auto-test-buy');
 assert.equal(migrated.id,before.id);
 assert.equal(migrated.createdAt,before.createdAt,'Original trigger date must survive conversion');
 assert.equal(migrated.mode,'technical');
 assert.equal(migrated.active,true);
 assert.equal(migrated.allocationPct,undefined);
 assert.equal(migrated.allocationEur,20,'2% of the 1000 EUR free-capital snapshot is fixed at 20 EUR');
 assert.equal(migrated.euroMigration.previousPercent,2);
 assert.equal(invoke('unityAutoBudgetStatus().limit'),20,'Budget initially fixed to outstanding amount');
 assert.equal(cache.audit.length,1,'One migration audit written in same atomic transaction');
 assert.equal(await invoke('unityAutoMigrateLegacy()'),false,'Second refresh must not migrate or add another audit');
 assert.equal(cache.audit.length,1);
 assert.match(invoke('unityAutoBuyControls(buyStock,unityAutoBuy(buyStock),"technical")'),/Betrag gespeichert: 20.00 €/);
 await assert.rejects(invoke('unityAutoSetBudget(0)'),/mindestens/);
 await assert.rejects(invoke('unityAutoSetBudget(200.001)'),/Nachkommastellen/);
 assert.equal(await invoke('unityAutoSetBudget(300)'),true);
 assert.equal(invoke('unityAutoBudgetStatus().limit'),300);
 assert.equal(invoke('unityAutoBudgetStatus().remaining'),300);
 assert.equal(await invoke('unityAutoSetBudget(300)'),false,'Unchanged budget is no-op');
 const oldOrder=cache.settings.find(x=>x.instrumentId==='s1'&&x.kind==='auto-test-buy');
 assert.equal(await invoke('unityAutoBuyChangeAllocation(buyStock,100)'),true);
 const newOrder=cache.settings.find(x=>x.instrumentId==='s1'&&x.kind==='auto-test-buy');
 assert.equal(newOrder.id,oldOrder.id);
 assert.equal(newOrder.mode,'technical','Conversion must not alter mode');
 assert.equal(newOrder.createdAt,oldOrder.createdAt,'Conversion must not reset activation date');
 assert.equal(newOrder.active,true);
 assert.equal(newOrder.allocationPct,undefined,'Only Euro amounts remain after automatic migration');
 assert.equal(newOrder.allocationEur,100);
 assert.equal(cache.transactions.length,0,'Editing an order must not create trades');
 assert.equal(await invoke('unityAutoBuyChangeAllocation(buyStock,100)'),false,'Same euro amount no-op');
 await assert.rejects(invoke('unityAutoBuyChangeAllocation(buyStock,0)'),/mindestens/);
 await assert.rejects(invoke('unityAutoBuyChangeAllocation(buyStock,100.999)'),/Nachkommastellen/);
 assert.match(invoke('unityAutoBuyControls(buyStock,unityAutoBuy(buyStock),"technical")'),/Betrag gespeichert: 100.00 €/);
 assert.match(invoke('unityAutoOrdersSummary()'),/300.00 €/);
 assert.match(invoke('unityAutoOrdersSummary()'),/100.00 €/);
 // Ten independently armed BUY orders across a shared EUR spending limit.
 for(let i=3;i<=11;i++){
   const s={id:'s'+i,name:'Pilot '+i,ticker:'P'+i,currency:'EUR'};
   cache.instruments.push(s);
   cache.settings.push({id:'auto-test-buy:'+s.id,kind:'auto-test-buy',instrumentId:s.id,
     mode:'technical',allocationEur:100,active:true,createdAt:'2026-11-06T10:00:00Z'});
 }
 assert.equal(cache.settings.filter(x=>x.kind==='auto-test-buy'&&x.active).length,10);
 marketDate='2026-11-09';allowBuy=false;
 await invoke('unityRunAutoTestBuys()');
 assert.equal(cache.transactions.filter(t=>t.type==='BUY').length,0,'Central veto blocks all buys even with budget');
 allowBuy=true;
 await invoke('unityRunAutoTestBuys()');
 let buys=cache.transactions.filter(t=>t.type==='BUY');
 let sells=cache.transactions.filter(t=>t.type==='SELL');
 assert.equal(buys.length,3,'Cumulative 300 EUR cap permits only three 100 EUR purchases');
 assert.equal(sells.length,1,'Technical sell evaluated independently');
 assert.equal(buys.every(t=>Math.abs(t.quantity-1)<1e-8),true);
 assert.equal(buys.every(t=>/100.00 €/.test(t.note)),true);
 assert.equal(sells[0].quantity,5);
 assert.equal(sells[0].price,85);
 assert.equal(invoke('unityAutoBudgetStatus().spent'),300);
 assert.equal(invoke('unityAutoBudgetStatus().remaining'),0);
 assert.equal(cache.settings.filter(x=>x.kind==='auto-test-buy'&&x.active).length,7,
   'Orders waiting for more budget stay armed, never silently cancelled or duplicated');
 assert.match(invoke('unityAutoOrdersSummary()'),/Budgetrest reicht nicht aus/);
 await invoke('unityRunAutoTestBuys()');
 assert.equal(cache.transactions.length,4,'Cap must prevent duplicate or overspend on repeat refresh');
 assert.equal(await invoke('unityAutoSetBudget(500)'),true);
 assert.equal(invoke('unityAutoBudgetStatus().remaining'),200);
 marketDate='2026-11-10';
 await invoke('unityRunAutoTestBuys()');
 buys=cache.transactions.filter(t=>t.type==='BUY');
 assert.equal(buys.length,5,'Raising cap allows precisely two more armed buys');
 assert.equal(invoke('unityAutoBudgetStatus().spent'),500);
 assert.equal(invoke('unityAutoBudgetStatus().remaining'),0);
 assert.equal(cache.settings.filter(x=>x.kind==='auto-test-buy'&&x.active).length,5);
 // No partial fixed-amount trade if cap remainder is less than the promised EUR amount.
 assert.equal(await invoke('unityAutoSetBudget(550)'),true);
 marketDate='2026-11-11';
 await invoke('unityRunAutoTestBuys()');
 assert.equal(cache.transactions.filter(t=>t.type==='BUY').length,5,
   '50 EUR remaining must not create an unexpected partial 100 EUR position');
 // Sales never replenish a cumulative purchase spending limit.
 assert.equal(invoke('unityAutoBudgetStatus().spent'),500);
 assert.equal(invoke('unityAutoBudgetStatus().remaining'),50);
 assert.equal(deepCalls,0,'Strict evaluation is not called for technical orders');
 const idx=fs.readFileSync('index.html','utf8'),sw=fs.readFileSync('sw.js','utf8');
 assert.match(idx,/home\.js\?v=0\.15\.1\.2/);
 assert.match(sw,/home\.js\?v=0\.15\.1\.2/);
 assert.match(sw,/unity-lab-v0\.15\.1\.2/);
 console.log('Auto simulation: atomic once-only percentage-to-EUR migration, 10 armed orders, budget cap, no partial fills/double booking, offline version passed.');
})().catch(err=>{console.error(err);process.exitCode=1});
