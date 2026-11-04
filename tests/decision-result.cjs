'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const stock={id:'s1',name:'Schneider Electric',isin:'FR0000121972',currency:'EUR',exchange:'Paris'};
const points=Array.from({length:220},(_,i)=>({date:'2026-01-'+String(i%28+1).padStart(2,'0'),close:100+i*.02+(i%2?.04:-.04)}));
let market={price:points.at(-1).close,date:new Date().toISOString().slice(0,10),exchange:'Paris',points};
const cache={fundamentals:[],histories:[],strategies:[],analyses:[]};
const sandbox={Date,Math,Number,Array,JSON,Intl,cache,
 keys:['valuation','quality','rr','flows','timing','alternatives'],
 labels:['Bewertung','Qualität','Chance/Risiko','Kapitalfluss','Timing','Alternativen'],
 defaults:{valuation:30,quality:20,rr:20,flows:15,timing:10,alternatives:5},
 unityMarketItem:()=>market,unityDataQuality:()=>({canCompare:true}),quote:()=>null,
 unityFundPilotItem:()=>({latestFiling:{periodEnd:'2026-09-26'},metrics:{revenue:{value:1},netIncome:{value:1},assets:{value:1},equity:{value:1},operatingCashFlow:{value:1}},derived:{revenueGrowth:{value:1},equityRatio:{value:50}}}),
 document:{addEventListener(){}},
 number:(v,d=2)=>Number(v).toFixed(d),esc:v=>String(v??''),
 stocks:()=>[stock],stamp:v=>String(v),id:()=>String(Math.random()),
 put:async()=>{},audit:async()=>{},refresh:async()=>{},
 unityCompanyView:()=>'',unityFundPilotPanel:()=>'',unityHomeDecision:()=>({action:'Beobachten – keine operative Freigabe',buy:'Noch nicht freigegeben',sell:'Nicht entscheidbar',reason:'Quellenlage unvollständig'})
};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('analysis.js','utf8'),sandbox);
const result=()=>vm.runInContext('unityDecisionResult('+JSON.stringify(stock)+')',sandbox);
let d=result();
assert.equal(d.kind,'review');
assert.match(d.action,/Technische Kaufzone/);
assert.equal(d.approved,false);
assert.match(d.approval,/Keine geprüfte Kauf-Freigabe/);
assert.match(d.zone,/EUR/);
assert.equal(d.fullScore,'Daten fehlen'); // missing fundamentals do not create a fake rating
assert.match(d.source,/Inoffizieller Tagesschlusskurs/);
assert.ok(d.blockers.some(x=>/Fundamentaldaten/.test(x)));
assert.equal(d.rr,'Nicht berechenbar');
assert.match(vm.runInContext('unityDecisionResultPanel('+JSON.stringify(stock)+')',sandbox),/Offene Prüfungen/);
assert.match(vm.runInContext('analysisView()',sandbox),/Automatisches UNITY-Ergebnis/);
assert.match(fs.readFileSync('home.js','utf8'),/unityDecisionResultPanel\(s\)/);
// A real numeric RR < 2 is a hard negative rule, even with positive price trend.
cache.fundamentals=[{id:stock.id,stop:market.price-5,target:market.price+5}];
d=result();
assert.equal(d.kind,'stop');
assert.match(d.action,/Nicht kaufen/);
assert.match(d.rr,/1,00:1/);
assert.equal(d.approved,false);
// Stale quote must override a positive technical candidate.
cache.fundamentals=[];
market={...market,date:'2026-01-02'};
d=result();
assert.equal(d.kind,'data');
assert.match(d.action,/Kursdatum prüfen/);
// Completely absent references do not invent price, zone, or score.
sandbox.unityMarketItem=()=>null;
d=result();
assert.equal(d.kind,'data');
assert.equal(d.reference,'Nicht verfügbar');
assert.equal(d.zone,'Noch nicht bestimmbar');
assert.equal(d.approved,false);
console.log('UNITY decision brief: candidate, no-buy approval, RR hard rule, stale and missing data passed.');
