'use strict';
/* UNITY 0.17: research-only forward sensitivity, never fair value or an order. */
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const sec=JSON.parse(fs.readFileSync('data/sec-fundamentals.json','utf8')).items;
const debtRegistry=JSON.parse(fs.readFileSync('data/debt-pilot-evidence.json','utf8')).items;
const date=new Date().toISOString().slice(0,10);
const securities=[
 {isin:'IE00B8KQN827',ticker:'ETN',currency:'USD',name:'Eaton',expFcf:3_553_000_000},
 {isin:'US92537N1081',ticker:'VRT',currency:'USD',name:'Vertiv',expFcf:1_893_800_000}
];
const context={Date,Math,Number,String,Object,Array,JSON,Intl,URL,Promise,
 esc:x=>String(x).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'),
 db:null};
vm.createContext(context);
vm.runInContext(fs.readFileSync('valuation-scenarios.js','utf8'),context);
const financial=stock=>{
 const annual=sec[stock.ticker];
 assert.equal(annual.isin,stock.isin);
 return {
  instrument:{isin:stock.isin},coreComplete:annual.status==='metrics-complete',
  sourceKind:'sec',sourceUrl:annual.latestFiling.reportUrl,
  period:annual.latestFiling.periodEnd,reportCurrency:annual.reportCurrency,
  valuation:{
   freeCashFlow:annual.metrics.operatingCashFlow.value-annual.metrics.capitalExpenditure.value,
   sharesOutstanding:annual.metrics.sharesOutstanding.value
  },
  priceRef:null,quoteInReportCurrency:null,fx:null
 };
};
function getDebt(stock,registry=debtRegistry){
 context.stock=stock;context.registry=registry;
 return vm.runInContext('unityQuarterDebtEvidence(stock,registry)',context);
}
function run(stock,changes={}){
 context.stock=stock;
 context.opts={
  financial:financial(stock),
  debt:getDebt(stock),
  ...changes
 };
 return vm.runInContext('unityPilotScenarioSensitivity(stock,opts)',context);
}
function panel(stock,changes={}){
 context.stock=stock;context.opts={financial:financial(stock),debt:getDebt(stock),...changes};
 return vm.runInContext('unityPilotScenarioSensitivityPanel(stock,opts)',context);
}
function independentDCF(fcf,g,r,t,years=5){
 let flow=fcf,sum=0;
 for(let y=1;y<=years;y++){
  flow*=1+g/100;
  sum+=flow/(1+r/100)**y;
 }
 return sum+flow*(1+t/100)/(r/100-t/100)/(1+r/100)**years;
}
for(const stock of securities){
 const m=financial(stock),base=m.valuation.freeCashFlow/m.valuation.sharesOutstanding;
 assert.equal(m.valuation.freeCashFlow,stock.expFcf);
 const s=run(stock);
 assert.equal(s.status,'sensitivity-only');
 assert.equal(s.fiscalCashFlowPeriod,'2025-12-31');
 assert.equal(s.quarterRiskPeriod,'2026-09-30');
 assert.equal(s.assumptionStatus,'hypothetical-not-reviewed');
 assert.equal(s.reportCurrency,'USD');
 assert.equal(s.scenarios.length,3);
 assert.equal(s.scenarios.map(x=>x.id).join(','),'bear,base,bull');
 assert.equal(s.fairValue,null);
 assert.equal(s.entryZone,null);
 assert.equal(s.tradeApproved,false);
 assert.equal(s.referencePrice,null);
 assert.equal(s.referenceDate,null);
 assert.equal(s.financingChangePct,getDebt(stock).debtChangePct);
 assert.equal(s.quarterRisk.audited,false);
 assert.equal(s.quarterRisk.nineMonthOperatingCashFlow,getDebt(stock).yearToDate.operatingCashFlow);
 assert.equal(s.quarterRisk.nineMonthCapitalExpenditure,getDebt(stock).yearToDate.capitalExpenditure);
 assert.equal(s.sourceRefs.length,2);
 assert.ok(Math.abs(s.cashFlowPerShare-base)<1e-12);
 assert.ok(s.scenarios[0].modelBarValuePerShare<s.scenarios[1].modelBarValuePerShare);
 assert.ok(s.scenarios[1].modelBarValuePerShare<s.scenarios[2].modelBarValuePerShare);
 for(const c of s.scenarios){
  assert.equal(c.isIssuerForecast,false);
  assert.equal(c.investmentReady,false);
  assert.equal(c.years,5);
  assert.equal(c.relativeToReferencePct,null);
  assert.ok(Math.abs(c.modelBarValuePerShare-
   independentDCF(base,c.growthPct,c.discountPct,c.terminalGrowthPct))<1e-9);
 }
 const h=panel(stock);
 assert.match(h,/Drei Cashflow-Szenarien/);
 assert.match(h,/mathematische Modellbarwerte/);
 assert.match(h,/keine fairen Unternehmenswerte/);
 assert.match(h,/nicht in den FY2025-Cashflow hineingerechnet/);
 assert.equal(run(stock,{financial:{...m,period:'2026-12-31'}}).status,'blocked');
 assert.equal(run(stock,{financial:{...m,sourceKind:'unverified'}}).status,'blocked');
 assert.equal(run(stock,{financial:{...m,sourceUrl:'https://data.sec.gov/other-issuer'}}).status,'blocked');
 assert.equal(run(stock,{financial:{...m,instrument:{isin:'US0000000000'}}}).status,'blocked');
 assert.equal(run(stock,{financial:{...m,reportCurrency:'EUR'}}).status,'blocked');
 assert.equal(run(stock,{financial:{...m,coreComplete:false}}).status,'blocked');
 assert.equal(run(stock,{financial:{...m,valuation:{...m.valuation,freeCashFlow:0}}}).status,'blocked');
 assert.equal(run(stock,{financial:{...m,valuation:{...m.valuation,sharesOutstanding:null}}}).status,'blocked');
 assert.equal(run(stock,{debt:null}).status,'blocked');
 assert.equal(run(stock,{debt:{...getDebt(stock),audited:true}}).status,'blocked');
 assert.equal(run(stock,{debt:{...getDebt(stock),currency:'EUR'}}).status,'blocked');
 assert.equal(run(stock,{debt:{...getDebt(stock),isin:'US0000000000'}}).status,'blocked');
 assert.equal(run(stock,{debt:{...getDebt(stock),sourceUrl:'https://attacker.example'}}).status,'blocked');
 const quoteFinancial={...m,priceRef:{date,exchange:'NYSE',price:200},
  quoteInReportCurrency:200,fx:{value:1}};
 const quoted=run(stock,{financial:quoteFinancial});
 assert.equal(quoted.referencePrice,200);
 assert.equal(quoted.referenceDate,date);
 assert.ok(quoted.scenarios.every(x=>typeof x.relativeToReferencePct==='number'));
 assert.equal(quoted.tradeApproved,false);
 assert.equal(quoted.entryZone,null);
 const stale=run(stock,{financial:{...quoteFinancial,priceRef:{...quoteFinancial.priceRef,
  date:'2020-01-01'}}});
 assert.equal(stale.referencePrice,null);
 const wrongFx=run(stock,{financial:{...quoteFinancial,fx:null}});
 assert.equal(wrongFx.referencePrice,null);
}
context.stock={isin:'CH0012221716',ticker:'ABBN',currency:'CHF'};
context.opts={financial:null,debt:null};
assert.equal(vm.runInContext('unityPilotScenarioSensitivity(stock,opts)',context),null);
const noDebt=run(securities[0],{debt:null});
assert.match(noDebt.missing.join(' '),/SEC-Quartalsabgleich/);
assert.equal(noDebt.scenarios,null);
assert.equal(noDebt.tradeApproved,false);
const assumptions=JSON.parse(fs.readFileSync('data/valuation-assumptions.json','utf8'));
assert.equal(Object.keys(assumptions.items).length,0,
 'public investment-ready valuation assumptions must not be invented');
console.log('UNITY 0.17 Eaton/Vertiv historical FY2025 FCF, Q3 2026 risk, 3 mathematical scenarios, hard blocks and no-trade checks passed.');
