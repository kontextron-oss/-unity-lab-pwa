'use strict';
/* Source-backed rolling cash flow, never a normalized forecast or a trade. */
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const sec=JSON.parse(fs.readFileSync('data/sec-fundamentals.json','utf8')).items;
const debt=JSON.parse(fs.readFileSync('data/debt-pilot-evidence.json','utf8')).items;
const fixtures=[
 {ticker:'ETN',isin:'IE00B8KQN827',expectedOCF:4908,expectedCapex:1113,expectedFCF:3795},
 {ticker:'VRT',isin:'US92537N1081',expectedOCF:3665.5,expectedCapex:518.3,expectedFCF:3147.2}
];
const ctx={Date,Math,Number,String,Object,Array,JSON,Intl,URL,Promise,
 esc:v=>String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'),db:null};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('valuation-scenarios.js','utf8'),ctx);
function finance(stock){
 const entry=sec[stock.ticker];
 assert.equal(entry.isin,stock.isin);
 assert.equal(entry.latestFiling.periodEnd,'2025-12-31');
 return {instrument:{isin:stock.isin},coreComplete:true,sourceKind:'sec',
   period:'2025-12-31',reportCurrency:'USD',
   sourceUrl:entry.latestFiling.reportUrl,
   core:{operatingCashFlow:entry.metrics.operatingCashFlow.value},
   valuation:{capitalExpenditure:entry.metrics.capitalExpenditure.value,
     freeCashFlow:entry.derived.freeCashFlow.value,
     sharesOutstanding:entry.metrics.sharesOutstanding.value}};
}
function qSnapshot(stock,record=debt[stock.isin]){
 ctx.s=stock;ctx.registry={[stock.isin]:record};
 return vm.runInContext('unityQuarterDebtEvidence(s,registry)',ctx);
}
function calculate(stock,change={}){
 ctx.s=stock;ctx.opts={
  financial:finance(stock),debt:qSnapshot(stock),...change};
 return vm.runInContext('unityPilotTrailingCashFlow(s,opts)',ctx);
}
function panel(stock,change={}){
 ctx.s=stock;ctx.opts={
  financial:finance(stock),debt:qSnapshot(stock),...change};
 return vm.runInContext('unityPilotTrailingCashFlowPanel(s,opts)',ctx);
}
for(const f of fixtures){
 const stock={ticker:f.ticker,isin:f.isin,currency:'USD'};
 const a=qSnapshot(stock);
 assert.equal(a.priorYearToDate.period,'2025-01-01/2025-09-30');
 assert.ok(a.priorYearToDate.operatingCashFlow>0);
 assert.ok(a.priorYearToDate.capitalExpenditure>=0);
 const r=calculate(stock);
 assert.equal(r.status,'reported-ttm-only');
 assert.equal(r.kind,'unity-rolling-ttm-fcf-bridge-v1');
 assert.equal(r.asOf,'2026-09-30');
 assert.equal(r.unit,'USD millions');
 assert.equal(r.normalised,false);
 assert.equal(r.tradeApproved,false);
 assert.equal(r.fairValue,null);
 assert.equal(r.entryZone,null);
 assert.equal(r.ttmOperatingCashFlow,f.expectedOCF);
 assert.equal(r.ttmCapitalExpenditure,f.expectedCapex);
 assert.ok(Math.abs(r.ttmFcfProxy-f.expectedFCF)<0.00001);
 assert.equal(r.ttmOperatingCashFlow,
   Math.round((r.bridge.fy2025.operatingCashFlow-
   r.bridge.minus9m2025.operatingCashFlow+
   r.bridge.plus9m2026.operatingCashFlow)*100)/100);
 assert.equal(r.ttmCapitalExpenditure,
   Math.round((r.bridge.fy2025.capitalExpenditure-
   r.bridge.minus9m2025.capitalExpenditure+
   r.bridge.plus9m2026.capitalExpenditure)*100)/100);
 assert.equal(r.sourceRefs.length,2);
 assert.equal(r.sourceRefs[1].url,debt[stock.isin].sourceUrl);
 assert.match(panel(stock),/TTM operativer Cashflow/);
 assert.match(panel(stock),/keine bloße Hochrechnung/);
 assert.match(panel(stock),/keine Einstiegszone/);
 assert.equal(calculate(stock,{financial:{...finance(stock),period:'2026-09-30'}}).status,'blocked');
 assert.equal(calculate(stock,{financial:{...finance(stock),sourceUrl:'https://attacker.example.com/report'}}).status,'blocked');
 assert.equal(calculate(stock,{financial:{...finance(stock),sourceKind:'unverified'}}).status,'blocked');
 assert.equal(calculate(stock,{financial:{...finance(stock),reportCurrency:'EUR'}}).status,'blocked');
 assert.equal(calculate(stock,{financial:{...finance(stock),core:{operatingCashFlow:null}}}).status,'blocked');
 assert.equal(calculate(stock,{financial:{...finance(stock),valuation:{capitalExpenditure:null}}}).status,'blocked');
 assert.equal(calculate(stock,{debt:{...a,isin:'US0000000000'}}).status,'blocked');
 assert.equal(calculate(stock,{debt:{...a,currency:'EUR'}}).status,'blocked');
 assert.equal(calculate(stock,{debt:{...a,sourceUrl:'https://attacker.example.com/'}}).status,'blocked');
 assert.equal(calculate(stock,{debt:{...a,priorYearToDate:{...a.priorYearToDate,period:'2024-01-01/2024-09-30'}}}).status,'blocked');
 assert.equal(calculate(stock,{debt:{...a,priorYearToDate:{...a.priorYearToDate,operatingCashFlow:null}}}).status,'blocked');
 assert.equal(calculate(stock,{debt:{...a,reviewGateSatisfied:true}}).status,'blocked');
 assert.equal(calculate(stock,{debt:{...a,audited:true}}).status,'blocked');
 assert.equal(calculate(stock,{debt:null}).status,'blocked');
 const fakeSource=JSON.parse(JSON.stringify(debt[stock.isin]));
 fakeSource.priorYearToDate.operatingCashFlow=null;
 assert.equal(qSnapshot(stock,fakeSource),null,
   'Q3 2025 comparison absent must block the SEC source parser itself');
}
ctx.s={isin:'CH0012221716',ticker:'ABBN'};
ctx.opts={};
assert.equal(vm.runInContext('unityPilotTrailingCashFlow(s,opts)',ctx),null);
console.log('TTM 2026: 2025 audited annual minus 9M2025 plus 9M2026 SEC: Eaton 3,795m and Vertiv 3,147.2m USD FCF proxy; no fake normalized FCF or trade.');
