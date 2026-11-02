'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const s={id:'s1',name:'Schneider Electric',ticker:'SU',isin:'FR0000121972',exchange:'Paris',currency:'EUR'};
const stamp=new Date().toISOString().slice(0,10);
const item={isin:s.isin,currency:s.currency,date:stamp,price:420,exchange:'Paris',points:[{date:stamp,close:420}]};
const cache={settings:[{id:'portfolio-capital',amount:5000}],instruments:[s],transactions:[
 {id:'buy1',instrumentId:s.id,type:'BUY',quantity:10,amount:3935.52,price:393.552,fx:1,fee:0,executedAt:'2026-10-30T12:00:00Z',createdAt:'2026-10-30T12:00:00Z'}
],histories:[],fundamentals:[],strategies:[]};
const box={Date,Math,Number,Array,JSON,cache,stocks:()=>cache.instruments,
 unityMarket:{generatedAt:new Date().toISOString()},unityMarketLoading:false,
 unityMarketItem:()=>item,unityDataQuality:()=>({canCompare:true}),
 unityMetrics:()=>null,unityDisplayQuote:()=>({price:item.price,currency:item.currency,date:item.date,precision:'day',label:'Schlusskurs'}),
 unityEuroRate:cur=>({rate:cur==='EUR'?1:1.2,date:stamp,source:'test EZB'}),
 unityBusinessDaysSince:()=>0,unityChartData:()=>[{close:390},{close:420}],
 unityChartSvg:()=>'<svg></svg>',unityChartPanel:()=>'<svg></svg>',
 unityCalc:()=>({veto:['Bilanz prüfen'],action:'Keine Freigabe'}),
 esc:x=>String(x??''),number:(n,d=2)=>Number(n).toFixed(d),euro:n=>Number(n).toFixed(2)+' €',
 unityPct:n=>Number.isFinite(n)?n.toFixed(1)+' %':'–',
 document:{addEventListener(){}},render(){},put:async()=>{},audit:async()=>{},refresh:async()=>{},
 depotTradeHistory:()=>'',localNow:()=>new Date().toISOString()
};
vm.createContext(box);
vm.runInContext(fs.readFileSync('depot.js','utf8'),box);
vm.runInContext(fs.readFileSync('home.js','utf8'),box);
const capital=()=>vm.runInContext('depotCapital()',box);
let p=capital();
assert.equal(p.free,1064.48);
assert.equal(p.invested,3935.52);
assert.equal(p.market,4200);
assert.equal(p.total,5264.48);
assert.ok(Math.abs(p.gain-264.48)<1e-7);
assert.ok(Math.abs(p.gainPct-5.2896)<1e-7);
assert.equal(p.unrealized,264.48);
assert.equal(p.realized,0);
assert.equal(p.complete,true);
let home=vm.runInContext('unityHome()',box);
assert.match(home,/5264.48 €/);
assert.match(home,/Gewinn \/ Verlust gesamt: \+264.48 €/);
assert.match(home,/Einzahlungen netto/);
assert.match(home,/Depotwert aktuell/);
assert.match(home,/Gekaufte Aktien/);
assert.match(home,/Ø Einstand/);
assert.match(home,/IM TESTDEPOT|Im Testdepot/i);
assert.match(home,/Startkapital ändern/);
assert.doesNotMatch(home,/class="home-big-number">1064.48/);
assert.match(vm.runInContext('depotOverview()',box),/Gesamtvermögen inklusive freiem Kapital/);
// A 2nd bought stock in CHF must use current EUR-per-CHF rate.
const chf={id:'s2',name:'ABB',ticker:'ABBN',isin:'CH0012221716',currency:'CHF',exchange:'SIX'};
cache.instruments.push(chf);
cache.transactions.push({id:'b2',instrumentId:'s2',type:'BUY',quantity:2,price:100,amount:200,fx:1.1,fee:0,executedAt:'2026-10-30T13:00:00Z',createdAt:'2026-10-30T13:00:00Z'});
box.unityMarketItem=isin=>isin===chf.isin?{isin,currency:'CHF',price:120,date:stamp,exchange:'SIX',points:[{date:stamp,close:120}]}:item;
p=capital();
assert.ok(Math.abs(p.free-844.48)<1e-8);
assert.ok(Math.abs(p.market-4488)<1e-7);
assert.ok(Math.abs(p.total-5332.48)<1e-7);
assert.ok(Math.abs(p.gain-332.48)<1e-7);
home=vm.runInContext('unityHome()',box);
assert.equal((home.match(/class="home-holding-card"/g)||[]).length,2);
// If any open position cannot be priced, never substitute free cash as total.
box.unityEuroRate=cur=>cur==='CHF'?null:{rate:1,date:stamp,source:'EUR'};
p=capital();
assert.equal(p.complete,false);
assert.equal(p.missingCount,1);
assert.ok(Number.isNaN(p.total));
home=vm.runInContext('unityHome()',box);
assert.match(home,/Gesamtvermögen nicht berechenbar/);
assert.match(home,/Freies Kapital wird nicht als Gesamtvermögen ausgegeben/);
assert.doesNotMatch(home,/class="home-big-number"[^>]*>844.48/);
assert.match(home,/Bewertung offen/);
// Recovered FX restores total and quote visibility without any data migration.
box.unityEuroRate=cur=>({rate:cur==='EUR'?1:1.2,date:stamp,source:'test EZB'});
assert.equal(capital().total,5332.48);
// A sell alters free cash and realizes the profit; formula still reconciles.
cache.transactions.push({id:'sale2',instrumentId:'s2',type:'SELL',quantity:1,price:130,amount:130,fx:1.2,fee:2,executedAt:'2026-10-31T10:00:00Z',createdAt:'2026-10-31T10:00:00Z'});
p=capital();
assert.ok(Math.abs(p.realized-44)<1e-6);
assert.ok(Math.abs(p.gain-(p.realized+p.unrealized))<1e-6);
assert.equal(p.complete,true);
console.log('Portfolio wealth: €5k funded, €5,264.48 value, gains, CHF conversion, missing FX and realized sale passed.');
