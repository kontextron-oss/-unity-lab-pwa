'use strict';
/* UNITY 0.17: SEC interest burden, debt repricing sensitivity and no double count. */
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const sec=JSON.parse(fs.readFileSync('data/sec-fundamentals.json','utf8')).items;
const debt=JSON.parse(fs.readFileSync('data/debt-pilot-evidence.json','utf8')).items;
const interest=JSON.parse(fs.readFileSync('data/financing-stress-evidence.json','utf8')).items;
const symbols=[
 {isin:'IE00B8KQN827',ticker:'ETN',q3_2026:198,q3_2025:67,nineMonths2026:505,
  nineMonths2025:171,delta:334,debtDelta:10211,ttmFcf:3795,gross:20106,stress1:201.06,stress2:402.12},
 {isin:'US92537N1081',ticker:'VRT',q3_2026:6.4,q3_2025:22.8,nineMonths2026:19.4,
  nineMonths2025:69.4,delta:-50,debtDelta:15.5,ttmFcf:3147.2,gross:2928.5,stress1:29.29,stress2:58.57}
];
const c={Date,Math,Number,String,Object,Array,JSON,Intl,URL,Promise,
 esc:x=>String(x).replaceAll('&','&amp;').replaceAll('<','&lt;')
  .replaceAll('>','&gt;').replaceAll('"','&quot;'),db:null};
vm.createContext(c);
vm.runInContext(fs.readFileSync('valuation-scenarios.js','utf8'),c);
function financial(s){
 const entry=sec[s.ticker];
 assert.equal(entry.isin,s.isin);
 return {instrument:{isin:s.isin},coreComplete:true,sourceKind:'sec',
  sourceUrl:entry.latestFiling.reportUrl,period:'2025-12-31',reportCurrency:'USD',
  core:{operatingCashFlow:entry.metrics.operatingCashFlow.value},
  valuation:{capitalExpenditure:entry.metrics.capitalExpenditure.value,
   freeCashFlow:entry.derived.freeCashFlow.value,sharesOutstanding:entry.metrics.sharesOutstanding.value}};
}
function prepare(s,change={}){
 c.s=s;c.dataRegistry={[s.isin]:debt[s.isin]};
 c.q=vm.runInContext('unityQuarterDebtEvidence(s,dataRegistry)',c);
 c.annual=financial(s);
 c.ttm=vm.runInContext('unityPilotTrailingCashFlow(s,{financial:annual,debt:q})',c);
 c.options={evidence:interest[s.isin],quarter:c.q,ttm:c.ttm,...change};
}
function run(s,change={}){prepare(s,change);return vm.runInContext('unityPilotFinancingStress(s,options)',c)}
function panel(s,change={}){prepare(s,change);return vm.runInContext('unityPilotFinancingStressPanel(s,options)',c)}
for(const s of symbols){
 const r=run(s);
 assert.equal(r.kind,'unity-financing-stress-audit-v1');
 assert.equal(r.status,'reported-interest-and-counterfactual-stress');
 assert.equal(r.netInterest.q3_2026,s.q3_2026);
 assert.equal(r.netInterest.q3_2025,s.q3_2025);
 assert.equal(r.netInterest.nineMonths2026,s.nineMonths2026);
 assert.equal(r.netInterest.nineMonths2025,s.nineMonths2025);
 assert.equal(r.netInterest.nineMonthsChange,s.delta);
 assert.equal(r.netInterest.q3Change,Math.round((s.q3_2026-s.q3_2025)*100)/100);
 assert.equal(r.netInterest.metric,'Net interest expense (after interest income), not cash interest paid');
 assert.equal(r.debt.currentGross,s.gross);
 assert.equal(r.debt.change,s.debtDelta);
 assert.equal(r.reportedTTMFcfProxy,s.ttmFcf);
 assert.equal(r.modelStress.length,2);
 assert.equal(r.modelStress[0].wholeGrossDebtAdditionalPreTax,s.stress1);
 assert.equal(r.modelStress[1].wholeGrossDebtAdditionalPreTax,s.stress2);
 assert.ok(r.modelStress.every(x=>x.isCashFlowAdjustment===false));
 assert.ok(r.modelStress.every(x=>x.isIssuerForecast===false));
 assert.ok(r.modelStress.every(x=>x.tradeApproved===false));
 assert.equal(r.modelStress[0].shiftBps,100);
 assert.equal(r.modelStress[1].shiftBps,200);
 assert.equal(r.sourceRefs[0].url,interest[s.isin].sourceUrl);
 assert.equal(r.normalizedFcf,null);
 assert.equal(r.entryZone,null);
 assert.equal(r.fairValue,null);
 assert.equal(r.tradeApproved,false);
 const h=panel(s);
 assert.match(h,/Offizielle Nettozinsaufwände/);
 assert.match(h,/Keine künftige Renditeprognose/);
 assert.match(h,/nicht<\/b> noch einmal davon abgezogen/);
 assert.match(h,/keine Kauf-Freigabe/);
 assert.equal(run(s,{evidence:null}).status,'blocked');
 assert.equal(run(s,{evidence:{...interest[s.isin],isin:'US0000000000'}}).status,'blocked');
 assert.equal(run(s,{evidence:{...interest[s.isin],cik:'0009999999'}}).status,'blocked');
 assert.equal(run(s,{evidence:{...interest[s.isin],audited:true}}).status,'blocked');
 assert.equal(run(s,{evidence:{...interest[s.isin],sourceUrl:'https://fake.example/'}}).status,'blocked');
 assert.equal(run(s,{evidence:{...interest[s.isin],filedAt:'2026-01-01'}}).status,'blocked');
 assert.equal(run(s,{evidence:{...interest[s.isin],currency:'EUR'}}).status,'blocked');
 assert.equal(run(s,{evidence:{...interest[s.isin],unit:'USD thousands'}}).status,'blocked');
 assert.equal(run(s,{evidence:{...interest[s.isin],netInterestExpense:null}}).status,'blocked');
 assert.equal(run(s,{evidence:{...interest[s.isin],netInterestExpense:{
  ...interest[s.isin].netInterestExpense,nineMonths2026:null}}}).status,'blocked');
 assert.equal(run(s,{evidence:{...interest[s.isin],netInterestExpense:{
  ...interest[s.isin].netInterestExpense,nineMonths2025:'69.4'}}}).status,'blocked');
 assert.equal(run(s,{quarter:{...c.q,sourceUrl:'https://fake.example/'}}).status,'blocked');
 assert.equal(run(s,{quarter:{...c.q,tradeApproved:true}}).status,'blocked');
 assert.equal(run(s,{quarter:{...c.q,reviewGateSatisfied:true}}).status,'blocked');
 assert.equal(run(s,{quarter:{...c.q,grossFinancialDebt:null}}).status,'blocked');
 assert.equal(run(s,{ttm:{...c.ttm,tradeApproved:true}}).status,'blocked');
 assert.equal(run(s,{ttm:{...c.ttm,normalised:true}}).status,'blocked');
 assert.equal(run(s,{ttm:{...c.ttm,ttmFcfProxy:null}}).status,'blocked');
 assert.equal(run(s,{ttm:null}).status,'blocked');
}
const v=run(symbols[1]);
assert.ok(v.debt.debtLessCash<0,'Vertiv net financial debt less cash is negative');
assert.ok(v.debt.debtLessCashToHistoricFcf<0);
const e=run(symbols[0]);
assert.ok(e.debt.debtLessCash>0);
assert.equal(e.modelStress[0].positiveBalanceIncreaseAdditionalPreTax,102.11);
assert.ok(Math.abs(v.modelStress[0].positiveBalanceIncreaseAdditionalPreTax-0.16)<1e-10);
c.s={isin:'CH0012221716',ticker:'ABBN'};c.options={};
assert.equal(vm.runInContext('unityPilotFinancingStress(s,options)',c),null);
const assumptions=JSON.parse(fs.readFileSync('data/valuation-assumptions.json','utf8'));
assert.equal(Object.keys(assumptions.items).length,0,'do not promote stress to a fair value input');
console.log('SEC net interest actuals, +100/+200bp illustrative sensitivity, correct negative net debt, no-double-count / no-trade guards passed.');
