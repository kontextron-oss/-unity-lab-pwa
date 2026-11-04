'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const date=new Date().toISOString().slice(0,10);
const stock={id:'s1',name:'Beispiel AG',isin:'DE0000000001',ticker:'BEI',providerSymbol:'BEI.DE',currency:'EUR',exchange:'Xetra'};
function points(slope=0.05,wobble=0.25){
  return Array.from({length:260},(_,i)=>({date:'2025-'+String(i+1),close:100+i*slope+Math.sin(i/3)*wobble}));
}
let item={isin:stock.isin,currency:'EUR',providerSymbol:stock.providerSymbol,date,points:points()};
item.price=item.points.at(-1).close;
const peerItems={};
for(let i=0;i<7;i++){const p=points(.03+i*.001,.15);peerItems['@P'+i]={isin:'',providerSymbol:'P'+i,currency:'EUR',date,points:p,price:p.at(-1).close}}
let model={t:{n:260,last:item.price,ma50:item.price/1.005,ma200:item.price/1.08,rsi:55},
 p:item.price,score:NaN,parts:{valuation:NaN,quality:NaN},margin:NaN,rr:NaN,
 q:{quotedAt:date+'T00:00:00Z'},f:{}};
let candidate={status:'candidate',buy:'Kaufzone aktiv',score:82};
let market={items:peerItems};
let filing=null;
const box={Date,Math,Number,Array,JSON,Intl,
 unityMarket:market,unityMarketForStock:()=>item,unityMarketItem:()=>item,
 unityDataQuality:()=>({canCompare:true}),
 unityBusinessDaysSince:day=>day===date?0:Infinity,
 unityCalc:()=>model,unityCandidate:()=>candidate,
 unityFundPilotItem:()=>filing,
 unityDisplayQuote:()=>({price:item.price,currency:'EUR'}),
 unityEuroRate:()=>({rate:1}),
 depotCapital:()=>({configured:true,total:5000,free:1600}),
 esc:x=>String(x??'')};
vm.createContext(box);
vm.runInContext(fs.readFileSync('decision-policy.js','utf8'),box);
const run=()=>vm.runInContext('unityDeepDecision(st)',Object.assign(box,{st:stock}));
let d=run();
assert.equal(d.kind,'technical');
assert.match(d.decision,/JA – technischer Testkauf/);
assert.equal(d.investmentReady,false);
assert.equal(d.realOrderApproved,false);
assert.equal(d.simulationPossible,true);
assert.ok(d.missing.some(x=>/Unternehmensberichte/.test(x)));
assert.ok(Number.isFinite(d.vol20));
assert.ok(Number.isFinite(d.relativeStrength));
assert.ok(d.peerCount>=5);
assert.ok(d.scenarioStop<item.price&&d.scenarioTarget>item.price);
let p=vm.runInContext('unityDeepDecisionPanel(st)',box);
assert.match(p,/Entscheidung jetzt/);
assert.match(p,/Relative Stärke/);
assert.match(p,/20-Tage-Volatilität/);
assert.match(p,/Nicht vollständig/);
assert.match(p,/data-policy-testbuy="s1"/);
assert.match(p,/Konservatives Testdepot-Szenario/);
const r=vm.runInContext('unityDeepSimPosition(st,unityDeepDecision(st))',box);
assert.ok(r&&r.units>0&&r.loss<=50.001&&r.amount<=250.001&&r.amount<=1600.001);
// A reliable new filing with all needed ratios and source/provenance
const period='2025-12-31',prior='2024-12-31';
filing={status:'metrics-partial',checkedAt:new Date().toISOString(),
 latestFiling:{periodEnd:period,reportUrl:'https://filings.xbrl.org/123/report.json'},
 priorFiling:{periodEnd:prior},derived:{}};
for(const [name,value] of Object.entries({revenueGrowth:7,netIncomeGrowth:8,equityRatio:43,netMargin:14,operatingCashFlowMargin:18})){
 filing.derived[name]={unit:'percent',value,periodEnd:period};
 if(name==='revenueGrowth'||name==='netIncomeGrowth')filing.derived[name].priorPeriodEnd=prior;
}
const earningsDate=new Date(Date.now()+30*86400000).toISOString().slice(0,10);
model={...model,score:78,parts:{valuation:76,quality:81},margin:17,rr:2.8,
 f:{balanceChecked:true,guidanceChecked:true,earningsConfirmed:true,earningsDate,
   dataSource:'https://investor.example.com/annual-report',thesis:'Beständiges Geschäftsmodell',risks:'Bewertung / Nachfrage'}};
d=run();
assert.equal(d.kind,'positive');assert.equal(d.investmentReady,true);
assert.match(d.decision,/JA – geprüften Einstieg im Testdepot/);
assert.equal(d.realOrderApproved,false);
// Recorded RR below 2:1 vetoes the full case even if everything else is green.
model.rr=1.2;d=run();
assert.equal(d.kind,'no');assert.match(d.decision,/NEIN – Chance\/Risiko/);
// Earnings next week blocks the case.
model.rr=2.5;model.f.earningsDate=new Date(Date.now()+2*86400000).toISOString().slice(0,10);
d=run();assert.equal(d.kind,'wait');assert.match(d.decision,/Ereignisrisiko/);
// No favorable price/technical setup: wait.
model.f.earningsDate=earningsDate;
candidate={...candidate,status:'wait',buy:'Abwarten'};
d=run();assert.equal(d.kind,'no');
candidate={...candidate,status:'candidate'};
model.t.ma50=item.price/1.08;d=run();assert.equal(d.kind,'wait');
model.t.ma50=item.price/1.005;
// Experimentally sourced price is NOT sufficient for a technical 'yes'.
item.dynamicExperimental=true;d=run();
assert.equal(d.kind,'data');assert.equal(d.realOrderApproved,false);
item.dynamicExperimental=false;item.date='2020-01-01';d=run();assert.equal(d.kind,'data');
item.date=date;item.points=item.points.slice(-40);d=run();assert.equal(d.kind,'data');
// No comparable peers -> no fabricated alpha; still a cautious technical evaluation.
item.points=points();item.price=item.points.at(-1).close;model.t.last=item.price;
market.items={};d=run();assert.ok(Number.isNaN(d.relativeStrength));assert.ok(d.missing.some(x=>/Relative Stärke/.test(x)));
assert.match(fs.readFileSync('index.html','utf8'),/decision-policy\.js\?v=0\.13\.\d+/);
assert.match(fs.readFileSync('sw.js','utf8'),/decision-policy\.js\?v=0\.13\.\d+/);
assert.match(fs.readFileSync('analysis.js','utf8'),/deepDecision:/);
assert.match(fs.readFileSync('home.js','utf8'),/b\.dataset\.policyTestbuy/);
console.log('UNITY deep policy: yes/no, source gates, peer relative strength, volatility, RR hard rule, earnings, sizing and archival passed.');
