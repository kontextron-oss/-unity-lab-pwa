'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');
assert.match(html,/function overview\(\)\{return typeof unityHome/);
assert.match(html,/home\.js/);
assert.match(html,/function watchlistCards\(\)/);
const s={id:'s1',name:'Schneider Electric',ticker:'SU',isin:'FR0000121972',currency:'EUR',exchange:'Paris'};
const x={name:s.name,isin:s.isin,price:237,date:'2026-10-30',exchange:'Paris',currency:'EUR',points:[{date:'2026-10-29',close:240},{date:'2026-10-30',close:237}]};
const m={last:237,trend:'Abwärtstrend',technicalIndex:32,rsi:42,stale:false};
let selected=[s];
const sandbox={Date,Math,Number,Array,JSON,stocks:()=>selected,depotPositions:()=>[],unityMarket:{generatedAt:'2026-10-31T08:00:00Z'},
 unityMarketLoading:false,unityMarketItem:isin=>isin===s.isin?x:null,unityMetrics:()=>m,
 unityDataQuality:()=>({canCompare:true}),unityDisplayQuote:()=>({price:x.price,date:x.date,exchange:x.exchange,precision:'day',label:'Letzter Börsenschlusskurs'}),unityChartData:()=>x.points,
 unityCalc:()=>({veto:['Bilanz nicht belegt','Earnings nicht bestätigt']}),unityChartPanel:()=>'<svg>diagram</svg>',
 number:(v,d=2)=>Number(v).toFixed(d),euro:v=>Number(v).toFixed(2)+' €',esc:v=>String(v??''),unityPct:v=>Number.isFinite(v)?v.toFixed(1)+' %':'–',
 document:{addEventListener(){}},render(){},put:async()=>{},audit:async()=>{},refresh:async()=>{},alert(){},localNow:()=> '2026-11-01T10:00',
 depotPosition:()=>({qty:0,cost:0,pnl:NaN,buys:0,sells:0}),depotMoney:n=>Number(n).toFixed(2)+' €',depotTradeHistory:()=>'<div>transactions</div>',
};
vm.createContext(sandbox);vm.runInContext(fs.readFileSync('home.js','utf8'),sandbox);
const home=vm.runInContext('unityHome()',sandbox);
assert.match(home,/Mein Depot/);assert.match(home,/Schneider Electric/);assert.match(home,/237.00 EUR/);
assert.match(home,/Aktuell/);assert.match(home,/data-home-open/);assert.match(home,/data-home-drag/);assert.match(home,/keine garantierten Echtzeitkurse/);
assert.match(home,/Aktie hinzufügen/);
const verdict=vm.runInContext("unityHomeDecision("+JSON.stringify(s)+")",sandbox);
assert.equal(verdict.action,'Technisch schwach');
assert.equal(verdict.buy,'Noch nicht freigegeben');
assert.match(verdict.reason,/langfristige Kurstrend/);
const detail=vm.runInContext("unityHomeDetail('s1')",sandbox);
assert.match(detail,/diagram/);assert.match(detail,/Vollständige UNITY-Analyse/);
assert.match(detail,/Noch nicht freigegeben/);assert.match(detail,/Kaufen · Simulation/);assert.match(detail,/Wertpapierdetails/);
assert.match(vm.runInContext('unityHomeManagePanel()',sandbox),/Ausblenden/);assert.match(vm.runInContext('unityHomeManagePanel()',sandbox),/nach oben/);
selected=[];const empty=vm.runInContext('unityHome()',sandbox);
assert.match(empty,/noch keine Aktien ausgewählt/);assert.doesNotMatch(empty,/70.423/);
// Price direction is informational; RSI and 200-day history are not required.
assert.equal(vm.runInContext("unityHomeDisplayedChange("+JSON.stringify(s)+","+JSON.stringify(x)+",null,'1D')",sandbox),-1.25);
sandbox.unityMetrics=()=>null;
selected=[s];
const simple=vm.runInContext('unityHome()',sandbox);
assert.match(simple,/-1.3 %/);
assert.match(simple,/237.00 EUR/);
assert.match(simple,/data-home-open/);
assert.doesNotMatch(simple,/home-pre-decision/);
sandbox.unityMarketItem=()=>null;
sandbox.unityReferenceQuoteItem=()=>x;
const shortHistory=vm.runInContext('unityHome()',sandbox);
assert.match(shortHistory,/237.00 EUR/);
assert.match(shortHistory,/-1.3 %/);

// No artificial 15/17-stock cutoff: the 18th stock (AMD) and all later values render.
selected=Array.from({length:22},(_,i)=>({...s,id:'stock-'+i,name:i===17?'AMD':'Aktie '+i,ticker:i===17?'AMD':'T'+i,createdAt:'2026-01-01T00:00:00Z'}));
const extended=vm.runInContext('unityHome()',sandbox);
assert.equal((extended.match(/data-home-open="/g)||[]).length,22);
assert.match(extended,/AMD/);
assert.match(extended,/Aktie 21/);
console.log('Home dashboard: selected stocks, EOD period, trend, chart drilldown, analysis verdict, empty state passed.');
