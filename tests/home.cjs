'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');
assert.match(html,/function overview\(\)\{return typeof unityHome/);
assert.match(html,/home\.js/);
assert.match(html,/unityHomeManagePanel\(\)/);
const s={id:'s1',name:'Schneider Electric',ticker:'SU',isin:'FR0000121972',currency:'EUR',exchange:'Paris'};
const x={name:s.name,isin:s.isin,price:237,date:'2026-10-30',exchange:'Paris',currency:'EUR',points:[{date:'2026-10-29',close:240},{date:'2026-10-30',close:237}]};
const m={last:237,trend:'Abwärtstrend',technicalIndex:32,rsi:42,stale:false};
let selected=[s];
const sandbox={Date,Math,Number,Array,JSON,stocks:()=>selected,depotPositions:()=>[],unityMarket:{generatedAt:'2026-10-31T08:00:00Z'},
 unityMarketLoading:false,unityMarketItem:isin=>isin===s.isin?x:null,unityMetrics:()=>m,
 unityDataQuality:()=>({canCompare:true}),unityChartData:()=>x.points,
 unityCalc:()=>({veto:['Bilanz nicht belegt','Earnings nicht bestätigt']}),unityChartPanel:()=>'<svg>diagram</svg>',
 number:(v,d=2)=>Number(v).toFixed(d),euro:v=>Number(v).toFixed(2)+' €',esc:v=>String(v??''),unityPct:v=>Number.isFinite(v)?v.toFixed(1)+' %':'–',
 document:{addEventListener(){}},render(){},put:async()=>{},audit:async()=>{},refresh:async()=>{},alert(){},localNow:()=> '2026-11-01T10:00',
 depotPosition:()=>({qty:0,cost:0,pnl:NaN,buys:0,sells:0}),depotMoney:n=>Number(n).toFixed(2)+' €',depotTradeHistory:()=>'<div>transactions</div>',
};
vm.createContext(sandbox);vm.runInContext(fs.readFileSync('home.js','utf8'),sandbox);
const home=vm.runInContext('unityHome()',sandbox);
assert.match(home,/Mein Depot/);assert.match(home,/Schneider Electric/);assert.match(home,/237.00 EUR/);
assert.match(home,/Aktuell/);assert.match(home,/data-home-open/);assert.match(home,/data-home-drag/);assert.match(home,/nicht in Echtzeit/);
assert.match(home,/Aktie hinzufügen/);
const verdict=vm.runInContext("unityHomeDecision("+JSON.stringify(s)+")",sandbox);
assert.equal(verdict.action,'Technisch schwach');
assert.equal(verdict.buy,'Noch nicht freigegeben');
assert.match(verdict.reason,/langfristige Kurstrend/);
const detail=vm.runInContext("unityHomeDetail('s1')",sandbox);
assert.match(detail,/diagram/);assert.match(detail,/Vollständige UNITY-Analyse/);
assert.match(detail,/Noch nicht freigegeben/);assert.match(detail,/Testkauf/);assert.match(detail,/Wertpapierdetails/);
assert.match(vm.runInContext('unityHomeManagePanel()',sandbox),/Ausblenden/);assert.match(vm.runInContext('unityHomeManagePanel()',sandbox),/nach oben/);
selected=[];const empty=vm.runInContext('unityHome()',sandbox);
assert.match(empty,/noch keine Aktien ausgewählt/);assert.doesNotMatch(empty,/70.423/);
console.log('Home dashboard: selected stocks, EOD period, trend, chart drilldown, analysis verdict, empty state passed.');
