'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {createPaperDB}=require('./fake-paper-indexeddb.cjs');
const qDate='2026-11-09',nextDate='2026-11-10';
const stock={id:'a',ticker:'ABBN',name:'ABB',currency:'EUR',exchange:'Xetra'};
let order={id:'auto-test-buy:a',kind:'auto-test-buy',instrumentId:'a',mode:'technical',
  active:true,allocationEur:100,createdAt:'2026-11-06T10:00:00Z'};
const cash={id:'portfolio-capital',amount:1000};
const cap={id:'auto-test-buy-total-budget',limitEur:200};
const cache={settings:[cash,cap,order],transactions:[],audit:[]};
const fake=createPaperDB(cache);
let seq=0;
const sandbox={Date,Math,JSON,Number,Array,Object,Set,cache,db:fake,
 id:()=> 'audit-seq-'+(++seq),
 put:async(store,entry)=>{const arr=cache[store],n=arr.findIndex(x=>x.id===entry.id);if(n<0)arr.push(entry);else arr[n]=entry},
 audit:async()=>{},refresh:async()=>{},depotMoney:n=>Number(n).toFixed(2)+' €',esc:x=>String(x??'')};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('paper-order-engine.js','utf8'),sandbox);
const invoke=(expression)=>vm.runInContext(expression,Object.assign(sandbox,{stock,quote,fx,order,qDate,nextDate}));
let quote={x:{date:qDate,exchange:'Xetra',currency:'EUR',price:100,dynamicExperimental:false},
  valid:true,technical:true,quality:{canCompare:true}};
let fx={rate:1,date:qDate,source:'EUR'};
const currentOrder=()=>cache.settings.find(x=>x.id===order.id);
const transactions=()=>cache.transactions.filter(x=>x.type==='BUY'||x.type==='SELL');
(async()=>{
 assert.throws(()=>invoke('unityPaperPolicyValidate({spreadBps:220,slippageBps:0,feeEur:1})'),/Spread/);
 assert.throws(()=>invoke('unityPaperPolicyValidate({spreadBps:10,slippageBps:10,feeEur:1.123})'),/Spread/);
 assert.equal(invoke('unityPaperPolicy().feeEur'),1);
 let model=invoke('unityPaperFillModel(100,"BUY",1,unityPaperPolicy(),100)');
 assert.ok(model.price>100&&model.price<101,'Spread and slippage move estimated buy price');
 assert.ok(Math.abs(model.totalEur-100)<1e-7,'EUR 100 fixed spend includes 1 EUR fee');
 assert.ok(model.quantity<1);
 assert.equal(invoke('unityPaperFillModel(100,"BUY",1,unityPaperPolicy(),1)'),null);
 let sellModel=invoke('unityPaperFillModel(100,"SELL",1,unityPaperPolicy(),NaN,1)');
 assert.ok(sellModel.price<100&&sellModel.price>99);
 assert.ok(sellModel.totalEur<99);
 assert.equal(invoke('unityPaperQuoteValid(stock,quote,fx)'),true);
 assert.equal(invoke('unityPaperFillId(order)').startsWith('unity-auto-fill-v1:'),true);
 const beforeSignal=await invoke('unityPaperAtomicFill(order,stock,"BUY",quote,fx,{})');
 assert.equal(beforeSignal.status,'blocked','Cannot fill a test order without a persistent trigger');
 let signal=await invoke('unityPaperArmOrder(order,{quoteDate:qDate,limit:102,price:100})');
 assert.equal(signal.status,'triggered');
 assert.equal(currentOrder().triggerQuoteDate,qDate);
 assert.equal(cache.transactions.length,0,'Trigger itself cannot produce a trade');
 assert.equal(cache.audit.filter(x=>x.type==='PAPER_ORDER_TRIGGER').length,1);
 assert.equal((await invoke('unityPaperArmOrder(order,{quoteDate:qDate,limit:102,price:100})')).status,'already-triggered');
 order=currentOrder();
 assert.equal((await invoke('unityPaperAtomicFill(order,stock,"BUY",quote,fx,{})')).status,'waiting',
   'Same EOD never becomes a fictive retroactive execution');
 quote={...quote,x:{...quote.x,date:nextDate}};
 fx={...fx,date:nextDate};
 const result=await invoke('unityPaperAtomicFill(order,stock,"BUY",quote,fx,{reasonCode:"technical-entry"})');
 assert.equal(result.status,'filled');
 assert.equal(cache.transactions.length,1);
 assert.equal(cache.settings.find(x=>x.id===order.id).active,false);
 assert.equal(cache.settings.find(x=>x.id===order.id).executionTradeId,result.trade.id);
 assert.ok(result.trade.decisionSnapshot.simulatedModel);
 assert.equal(result.trade.decisionSnapshot.triggerQuoteDate,qDate);
 assert.equal(result.trade.decisionSnapshot.quoteDate,nextDate);
 assert.ok(result.trade.price>100,'Paper fill includes configured costs');
 assert.equal(result.trade.fee,1);
 assert.ok(Math.abs(result.trade.amount*result.trade.fx+result.trade.fee-100)<1e-6);
 assert.equal(invoke('unityPaperSpendFromRows(cache.transactions)'),100);
 assert.equal(invoke('unityPaperCashFromRows(cache.settings,cache.transactions)'),900);
 assert.equal(cache.audit.filter(x=>x.type==='AUTO_TEST_BUY').length,1);
 assert.equal((await invoke('unityPaperAtomicFill(order,stock,"BUY",quote,fx,{})')).status,'already-settled');
 assert.equal(cache.transactions.length,1,'Repeated processing must not double fill');
 // The exact same order id is reused after user reactivation, but createdAt differs.
 const again={...order,active:true,createdAt:'2026-11-10T21:00:00Z',
   triggerQuoteDate:nextDate,triggeredAt:'2026-11-10T21:00:00Z'};
 cache.settings[cache.settings.findIndex(x=>x.id===order.id)]=again;
 order=again;
 quote={...quote,x:{...quote.x,date:'2026-11-11'}};
 fx={...fx,date:'2026-11-11'};
 fake.failNextPut('transactions');
 await assert.rejects(invoke('unityPaperAtomicFill(order,stock,"BUY",quote,fx,{})'),/Injected simulated storage failure/,
   'Simulated write failure must abort every store');
 assert.equal(cache.transactions.length,1,'No extra transaction survived aborted write');
 assert.equal(currentOrder().active,true,'The order remains open after abort');
 assert.equal(cache.audit.filter(x=>x.type==='AUTO_TEST_BUY').length,1,'No audit pretends the aborted order filled');
 // A failure AFTER the trade store accepted its put must still roll back
 // all earlier writes in the same atomic transaction.
 fake.failNextPut('settings');
 await assert.rejects(invoke('unityPaperAtomicFill(order,stock,"BUY",quote,fx,{})'),/Injected simulated storage failure/);
 assert.equal(cache.transactions.length,1,'A later settings-store failure rolls back the trade insertion');
 assert.equal(currentOrder().active,true,'Order not silently closed after a partial crash');
 assert.equal(cache.audit.filter(x=>x.type==='AUTO_TEST_BUY').length,1);
 fake.failNextPut('audit');
 await assert.rejects(invoke('unityPaperAtomicFill(order,stock,"BUY",quote,fx,{})'),/Injected simulated storage failure/);
 assert.equal(cache.transactions.length,1,'Even a late audit-store failure must roll back both order and trade');
 assert.equal(currentOrder().active,true);
 const resumed=await invoke('unityPaperAtomicFill(order,stock,"BUY",quote,fx,{})');
 assert.equal(resumed.status,'filled','Recovery after aborted transaction can settle exactly once');
 assert.equal(cache.transactions.length,2);
 assert.notEqual(resumed.trade.id,result.trade.id,'Reactivated order must get a new deterministic fill ID');
 assert.equal(invoke('unityPaperSpendFromRows(cache.transactions)'),200);
 // A third order must be blocked by budget even though wallet still has cash.
 const third={id:'auto-test-buy:b',kind:'auto-test-buy',instrumentId:'b',mode:'technical',
   active:true,allocationEur:100,createdAt:'2026-11-10T07:00:00Z',
   triggeredAt:'2026-11-10T20:00:00Z',triggerQuoteDate:'2026-11-10',triggerLimit:110};
 const b={id:'b',ticker:'SU',currency:'EUR'};
 cache.settings.push(third);
 const blocked=await vm.runInContext('unityPaperAtomicFill(third,b,"BUY",quote,fx,{})',
   Object.assign(sandbox,{third,b}));
 assert.equal(blocked.status,'blocked');
 assert.match(blocked.reason,/Budgetrest/);
 assert.equal(cache.transactions.length,2);
 // A manually edited budget can permit the next test order.
 cache.settings.find(x=>x.id==='auto-test-buy-total-budget').limitEur=300;
 const added=await vm.runInContext('unityPaperAtomicFill(third,b,"BUY",quote,fx,{})',sandbox);
 assert.equal(added.status,'filled');
 assert.equal(invoke('unityPaperSpendFromRows(cache.transactions)'),300);
 // All SELL allocations have separate protective triggers and cannot sell twice.
 const sellOrder={id:'auto-test-sell:a',kind:'auto-test-sell',instrumentId:'a',
   mode:'technical',active:true,createdAt:'2026-11-10T08:00:00Z',
   triggerQuoteDate:'2026-11-10',triggeredAt:'2026-11-10T20:00:00Z'};
 cache.settings.push(sellOrder);
 const sell=await vm.runInContext('unityPaperAtomicFill(sellOrder,stock,"SELL",quote,fx,{reasonCode:"technical-exit"})',
   Object.assign(sandbox,{sellOrder}));
 assert.equal(sell.status,'filled');
 assert.ok(sell.trade.quantity>0);
 assert.ok(sell.trade.price<100);
 assert.equal(cache.settings.find(x=>x.id===sellOrder.id).active,false);
 assert.equal((await vm.runInContext('unityPaperAtomicFill(sellOrder,stock,"SELL",quote,fx,{})',sandbox)).status,'already-settled');
 assert.equal(cache.transactions.filter(x=>x.type==='SELL').length,1);
 assert.ok(Math.abs(invoke('unityPaperQtyFromRows(cache.transactions,"a")'))<1e-8);
 // Quote trust and limit gates: never invent an executable price.
 let invalidQuote={...quote,x:{...quote.x,currency:'CHF'}};
 assert.equal(vm.runInContext('unityPaperQuoteValid(stock,invalidQuote,fx)',Object.assign(sandbox,{invalidQuote})),false);
 const limitOrder={id:'auto-test-buy:c',kind:'auto-test-buy',instrumentId:'c',active:true,
   mode:'technical',allocationEur:100,createdAt:'2026-11-10T10:00:00Z',
   triggerQuoteDate:'2026-11-10',triggeredAt:'2026-11-10T21:00:00Z',triggerLimit:99};
 cache.settings.push(limitOrder);
 const c={id:'c',ticker:'C',currency:'EUR'};
 const limitation=await vm.runInContext('unityPaperAtomicFill(limitOrder,c,"BUY",quote,fx,{})',
   Object.assign(sandbox,{limitOrder,c}));
 assert.equal(limitation.status,'limit-exceeded','Buy must never chase a price beyond the signalled ceiling');
 assert.equal(cache.transactions.length,4);
 assert.match(invoke('unityPaperCostsPanel()'),/Modellkosten und Ausführungsannahmen/);
 assert.match(invoke('unityPaperCostsPanel()'),/keine handelbaren Kurse/);
 console.log('UNITY paper-order 0.15.2: D+1 modeled fills, slippage/fees, cash/budget atomicity, abort/retry, exact-once, sell and limit gates passed.');
})().catch(err=>{console.error(err);process.exitCode=1});
