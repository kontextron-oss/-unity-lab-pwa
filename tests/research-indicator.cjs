'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');
assert.match(html,/home-research-flag/);
assert.match(html,/research=typeof unityResearchIndicator/); // same indicator in all-stock view
assert.match(html,/0\.13\.\d+/);
const stock={id:'amd',name:'AMD',ticker:'AMD',isin:'US0079031078',providerSymbol:'AMD',exchange:'NASDAQ',currency:'USD'};
const points=Array.from({length:220},(_,i)=>({date:'2026-01-'+String(i+1),close:100+i*.2}));
const quote={isin:stock.isin,price:points.at(-1).close,date:'2026-11-02',points};
let metric={rsi:52,technicalIndex:100,trend:'Aufwärtstrend',stale:false};
let list=[stock];
const context={
 Date,Math,Number,Array,JSON,
 stocks:()=>list,unityMarket:{generatedAt:'2026-11-02T16:00:00Z'},unityMarketLoading:false,
 unityMarketItem:()=>quote,unityMetrics:()=>metric,unityDataQuality:()=>({canCompare:true}),
 unityFundPilotItem:()=>({latestFiling:{periodEnd:'2026-09-26'},metrics:{revenue:{value:1},netIncome:{value:1},assets:{value:1},equity:{value:1},operatingCashFlow:{value:1}}}),
 unityChartData:(item,range)=>range==='1M'?item.points.slice(-22):range==='3M'?item.points.slice(-66):item.points.slice(-2),
 unityDisplayQuote:()=>({price:quote.price,currency:stock.currency,date:quote.date,precision:'day',source:'test'}),
 unityEuroRate:()=>({rate:.86,date:'2026-11-02',source:'test'}),
 unityCalc:()=>({veto:[],action:'Keine Handelsfreigabe'}),unityChartPanel:()=>'<svg/>',
 number:(n,d=2)=>Number(n).toFixed(d),euro:n=>Number(n).toFixed(2)+' €',
 esc:x=>String(x??''),unityPct:n=>Number.isFinite(n)?n.toFixed(1)+' %':'–',
 document:{addEventListener(){}},render(){},put:async()=>{},audit:async()=>{},refresh:async()=>{},alert(){},
 depotPositions:()=>[],depotPosition:()=>({qty:0,pnl:NaN,cost:0,buys:0,sells:0}),depotMoney:n=>Number(n).toFixed(2)+' €',
 depotTradeHistory:()=>'',localNow:()=> '2026-11-02T17:00'
};
vm.createContext(context);vm.runInContext(fs.readFileSync('home.js','utf8'),context);
const status=()=>vm.runInContext('unityResearchIndicator(st)',Object.assign(context,{st:stock}));
assert.equal(status().label,'Analyse sinnvoll');
assert.match(status().detail,/Aufwärtstrend/);
let home=vm.runInContext('unityHome()',context);
assert.match(home,/home-research-research/);
assert.match(home,/Analyse sinnvoll/);
assert.match(home,/Keine Kaufempfehlung|Keine Kauf- oder Verkaufsfreigabe|Keine Kaufempfehlung/i); // explanation in summary
metric={rsi:76,technicalIndex:85,trend:'Aufwärtstrend',stale:false};
assert.equal(status().label,'Beobachten');
metric={rsi:42,technicalIndex:25,trend:'Abwärtstrend',stale:false};
assert.equal(status().label,'Derzeit nachrangig');
metric=null;
assert.equal(status().label,'Daten prüfen');
assert.equal(status().kind,'data');
home=vm.runInContext('unityHome()',context);
assert.match(home,/home-research-data/);
assert.doesNotMatch(home,/Lohnt sich nicht/);
metric={rsi:52,technicalIndex:100,trend:'Aufwärtstrend',stale:false};
quote.points=quote.points.slice(0,2);
assert.equal(status().kind,'data'); // price alone is insufficient for a research ranking
quote.points=points;
list=Array.from({length:23},(_,i)=>({...stock,id:'s'+i,name:i===17?'AMD':'Aktie '+i,ticker:i===17?'AMD':'T'+i}));
home=vm.runInContext('unityHome()',context);
assert.equal((home.match(/class="home-research-flag /g)||[]).length,23);
assert.match(home,/AMD/);
console.log('Four research states, missing-data distinction and 23 iPhone stock labels passed.');
