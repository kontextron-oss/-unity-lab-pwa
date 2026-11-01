'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const s1={id:'a',name:'ABB',isin:'CH0012221716',ticker:'ABBN',currency:'CHF',exchange:'SIX',createdAt:'2026-01-01T00:00:00Z'};
const s2={id:'b',name:'Schneider Electric',isin:'FR0000121972',ticker:'SU',currency:'EUR',exchange:'Paris',createdAt:'2026-01-02T00:00:00Z'};
const s3={id:'c',name:'Siemens Energy',isin:'DE000ENER6Y0',ticker:'ENR',currency:'EUR',exchange:'Xetra',createdAt:'2026-01-03T00:00:00Z'};
let instruments=[s1,s2,s3],transactions=[],events=[],refreshes=0,sequence=0;
const sandbox={Date,Math,Number,Array,JSON,Set,Map,
 stocks:()=>instruments,cache:{instruments,transactions},
 unityMarket:{generatedAt:'2026-10-30T20:00:00Z'},unityMarketLoading:false,
 unityMarketItem:()=>({price:240,date:'2026-10-30'}),unityDisplayQuote:()=>({price:240,currency:'EUR',date:'2026-10-30',precision:'day',source:'test EOD'}),unityEuroRate:currency=>({rate:currency==='EUR'?1:1.08,date:'2026-10-30',source:'test ECB'}),unityMetrics:()=>null,unityDataQuality:()=>({canCompare:true}),
 unityChartData:()=>[],unityCalc:()=>({veto:[]}),unityChartPanel:()=>'<svg/>',
 depotPositions:()=>[],depotPosition:()=>({qty:2,cost:100,pnl:NaN,buys:1,sells:0}),
 depotMoney:n=>Number(n).toFixed(2)+' €',depotTradeHistory:()=>'<div>history</div>',
 depotLedger:()=>({qty:2}),depotActiveTrades:id=>transactions.filter(t=>t.instrumentId===id),localNow:()=> '2026-10-30T10:00',
 number:(v,d=2)=>Number(v).toFixed(d),euro:v=>Number(v).toFixed(2)+' €',esc:v=>String(v??''),unityPct:v=>Number.isFinite(v)?v.toFixed(1)+' %':'–',
 document:{addEventListener(){}},render(){},alert(){},confirm:()=>true,
 id:()=>String(++sequence),put:async(store,entry)=>{if(store==='transactions')transactions.push(entry);events.push(store);},
 audit:async(...args)=>events.push(args),refresh:async()=>refreshes++,
 db:{transaction:()=>{
   const tx={oncomplete:null,onerror:null,onabort:null,objectStore:()=>({put:(entry)=>{
     const i=instruments.findIndex(s=>s.id===entry.id);instruments[i]=entry;
   }})};
   queueMicrotask(()=>tx.oncomplete?.());return tx;
 }}
};
vm.createContext(sandbox);vm.runInContext(fs.readFileSync('home.js','utf8'),sandbox);
(async()=>{
 assert.equal(vm.runInContext("unityHomeStocks().map(s=>s.id).join(',')",sandbox),'a,b,c');
 assert.match(vm.runInContext('unityHome()',sandbox),/data-home-drag="a"/);
 await vm.runInContext("unityHomeReorder('c','a')",sandbox);
 assert.equal(vm.runInContext("unityHomeStocks().map(s=>s.id).join(',')",sandbox),'c,a,b');
 assert.deepEqual(instruments.map(s=>s.watchOrder),[1,2,0]);
 await vm.runInContext("unityHomeShift('c',1)",sandbox);
 assert.equal(vm.runInContext("unityHomeStocks().map(s=>s.id).join(',')",sandbox),'a,c,b');
 assert.ok(refreshes>=2);
 const buy={instrumentId:'b',type:'BUY',quantity:'3',price:'240',fx:'1',executedAt:'2026-10-30T10:00',note:'UNITY Test'};
 assert.match(vm.runInContext("(()=>{unityHomeTradeMode='BUY';return unityHomeTradeActions("+JSON.stringify(s2)+")})()",sandbox),/Testkauf speichern/);
 assert.equal(await vm.runInContext("unityHomeSaveTrade("+JSON.stringify(buy)+")",sandbox),true);
 assert.equal(transactions.length,1);
 assert.equal(transactions[0].amount,720);
 assert.equal(transactions[0].type,'BUY');
 assert.equal(transactions[0].source,'UNITY Lab · Testhandel');
 assert.equal(transactions[0].fxSource,'test ECB');
 assert.equal(transactions[0].decisionSnapshot.source,'UNITY EOD-Analyse · keine Handelsfreigabe');
 const sell={...buy,type:'SELL',quantity:'1'};
 assert.equal(await vm.runInContext("unityHomeSaveTrade("+JSON.stringify(sell)+")",sandbox),true);
 assert.equal(transactions[1].type,'SELL');
 await assert.rejects(vm.runInContext("unityHomeSaveTrade("+JSON.stringify({...sell,quantity:'3'})+")",sandbox),/Nicht genügend/);
 assert.equal(transactions[0].fx,1); // manually submitted FX cannot override the automatic EUR rate
 assert.equal(transactions.length,2);
 const chfBuy={...buy,instrumentId:'a',quantity:'1',price:'9999',fx:'9999'};
 assert.equal(await vm.runInContext("unityHomeSaveTrade("+JSON.stringify(chfBuy)+")",sandbox),true);
 assert.equal(transactions[2].price,240);
 assert.equal(transactions[2].fx,1.08);
 assert.ok(Math.abs(transactions[2].amount*transactions[2].fx-259.2)<0.000001);
 assert.match(vm.runInContext("unityHomeTradeActions("+JSON.stringify(s1)+")",sandbox),/Automatische EUR-Umrechnung|Kaufen · Simulation/);
 assert.match(vm.runInContext("unityHomeSecurityDetails("+JSON.stringify(s2)+",null)",sandbox),/BID\/ASK/);
 console.log('Mobile reorder persisted; test buy/sell validated and recorded without real orders.');
})().catch(err=>{console.error(err);process.exitCode=1});
