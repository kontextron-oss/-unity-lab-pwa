'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const day=new Date().toISOString().slice(0,10);
const ABB={id:'abb',name:'ABB',isin:'CH0012221716',ticker:'ABBN',exchange:'SIX',currency:'CHF'};
const source='https://library.e.abb.com/public/abb-financial-report-2025.pdf';
const period='2025-12-31',prior='2024-12-31';
const five={revenue:33220,netIncome:4823,assets:44885,equity:16646,operatingCashFlow:5469};
const makeFacts=(stats,p=period)=>Object.fromEntries(Object.entries(stats).map(([key,v])=>[key,{
 value:v*1e6,currency:'USD',periodEnd:p,sourceUrl:source,sourceType:'issuer-audited-annual-report'
}]));
const report={isin:ABB.isin,reportCurrency:'USD',status:'issuer-pdf-metrics-complete',
 latestFiling:{periodEnd:period,reportUrl:source,sourceType:'issuer-audited-annual-report'},
 annualReport:{periodEnd:period,sourceUrl:source,coreMetricsValidated:true,stale:false},
 metrics:makeFacts(five),priorMetrics:{},priorFiling:null};
const quote={x:{price:50,date:day,currency:'CHF',exchange:'SIX'},quality:{canCompare:true},valid:true};
const ecb={CHF:{rate:1.09,date:day},USD:{rate:.89,date:day},EUR:{rate:1,date:day}};
const fxLookup=currency=>ecb[currency]||null;
const s={Date,Math,Number,String,Object,Array,JSON,Intl,URL,
 unityFundPilotItem:x=>x.isin===ABB.isin?report:null,
 unityHomeQuote:()=>quote,unityEuroRate:fxLookup,
 stocks:()=>[ABB,{id:'new',name:'Neue Aktie',isin:'GB0000000001',ticker:'NEW',currency:'GBP'}],
 esc:x=>String(x),unityIsCryptoAsset:x=>x?.ticker==='BTC'};
vm.createContext(s);
vm.runInContext(fs.readFileSync('financial-metrics.js','utf8'),s);
const view=(obj=ABB,options={})=>vm.runInContext('unityFinancialStockSnapshot(instrument, opts)',Object.assign(s,{instrument:obj,opts:options}));
let r=view();
assert.equal(r.coreComplete,true);
assert.equal(r.sourceKind,'issuer-pdf');
assert.equal(r.tradeApproved,false);
assert.equal(r.reportCurrency,'USD');
assert.equal(r.quoteCurrency,'CHF');
assert.equal(r.fx.source,'EZB-Referenzkurs; indikativ, nicht handelbar');
assert.ok(Math.abs(r.quoteInReportCurrency-50*1.09/.89)<0.000001);
assert.equal(r.ratios.netMargin,14.52);
assert.equal(r.ratios.equityRatio,37.09);
assert.equal(r.ratios.operatingCashFlowMargin,16.46);
assert.equal(r.ratios.cashConversion,113.39);
assert.equal(r.priorComparable,false);
assert.equal(r.ratios.revenueGrowth,null);
assert.equal(r.valuation.pe,null,'No P/E without audited EPS');
assert.equal(r.valuation.pb,null,'No book-to-price multiple without exact shares outstanding');
assert.equal(r.valuation.freeCashFlowYield,null,'No fictitious free-cash-flow yield');
assert.match(r.missing.join(' '),/Vorjahreszahlen/);
assert.doesNotThrow(()=>JSON.stringify(r));
// A matched prior-year period unlocks only the appropriate comparisons.
report.priorFiling={periodEnd:prior};
report.priorMetrics=makeFacts({revenue:30583,netIncome:3904},prior);
r=view();
assert.equal(r.priorComparable,true);
assert.equal(r.ratios.revenueGrowth,Math.round((33220/30583-1)*10000)/100);
assert.equal(r.ratios.netIncomeGrowth,Math.round((4823/3904-1)*10000)/100);
report.priorFiling={periodEnd:'2022-12-31'};
r=view();
assert.equal(r.priorComparable,false,'Distant prior-year values must not pass');
report.priorFiling=null;
// Wrong fiscal period, stale status and mismatching source must fail closed.
report.metrics.revenue.periodEnd='2024-12-31';
assert.equal(view().coreComplete,false);
report.metrics.revenue.periodEnd=period;
report.metrics.revenue.sourceUrl='https://example.org/impostor.pdf';
assert.equal(view().coreComplete,false);
report.metrics.revenue.sourceUrl=source;
report.annualReport.stale=true;
assert.equal(view().coreComplete,false);
report.annualReport.stale=false;
// Failure and stale FX must never be silently converted.
ecb.USD={rate:.89,date:'2024-01-01'};
r=view();assert.equal(r.fx,null);assert.equal(r.quoteInReportCurrency,null);
ecb.USD={rate:.89,date:day};
ecb.CHF={rate:1.09,date:'2024-01-01'};
r=view();assert.equal(r.fx,null,'Mismatched FX dates must be blocked');
ecb.CHF={rate:1.09,date:day};
// Same report and stock currency requires no FX adapter.
const reportEUR={...report,reportCurrency:'EUR',latestFiling:{
 periodEnd:period,reportUrl:'https://filings.xbrl.org/xx/reports/viewer.html'},
 status:'metrics-complete',
 metrics:Object.fromEntries(Object.entries(five).map(([k,v])=>[k,{value:v*1e6,periodEnd:period,
   currency:'EUR',sourceUrl:'https://filings.xbrl.org/xx/report.json'}]))};
const euroStock={...ABB,currency:'EUR'};
r=view(euroStock,{report:reportEUR,quote:{x:{price:200,currency:'EUR',date:day,exchange:'Paris'},valid:true,quality:{canCompare:true}},fxLookup:()=>null});
assert.equal(r.fx.value,1);assert.equal(r.quoteInReportCurrency,200);
assert.equal(r.sourceKind,'esef');assert.equal(r.coreComplete,true);
// US source P/E only with reported diluted earnings per share (never inferred net income / random share count).
const sec='https://data.sec.gov/api/xbrl/companyfacts/CIK0000123456.json';
const secStock={id:'usa',name:'US issuer',ticker:'TST',isin:'US0000000001',currency:'USD',exchange:'NYSE'};
const secFact=(v,k,unit='USD')=>({value:v,periodEnd:period,currency:'USD',sourceUrl:sec,concept:'us-gaap:'+k,unit});
const secReport={status:'metrics-complete',reportCurrency:'USD',
 latestFiling:{periodEnd:period,reportUrl:sec},
 metrics:Object.fromEntries(Object.entries(five).map(([k,v])=>[k,secFact(v*1e6,k)]))};
secReport.metrics.epsDiluted=secFact(10,'EarningsPerShareDiluted','USD/shares');
secReport.metrics.sharesDiluted=secFact(150e6,'WeightedAverageNumberOfDilutedSharesOutstanding','shares');
r=view(secStock,{report:secReport,quote:{x:{price:200,currency:'USD',date:day,exchange:'NYSE'},valid:true,quality:{canCompare:true}},fxLookup:fxLookup});
assert.equal(r.valuation.pe,20);
assert.equal(r.valuation.pb,null,'Diluted weighted shares are not year-end outstanding shares');
assert.equal(r.valuation.freeCashFlowYield,null);
assert.equal(r.tradeApproved,false);
// Year-end shares, cash and SEC debt COMPONENTS now keep their exact units.
secReport.metrics.sharesOutstanding={...secFact(100e6,'CommonStockSharesOutstanding','shares'),currency:null};
secReport.metrics.capitalExpenditure=secFact(50e6,'PaymentsToAcquirePropertyPlantAndEquipment');
secReport.metrics.cashAndEquivalents=secFact(120e6,'CashAndCashEquivalentsAtCarryingValue');
secReport.metrics.debtLongTermNoncurrent=secFact(300e6,'LongTermDebtNoncurrent');
secReport.metrics.shortTermBorrowings=secFact(10e6,'ShortTermBorrowings');
r=view(secStock,{report:secReport,quote:{x:{price:200,currency:'USD',date:day,exchange:'NYSE'},valid:true,quality:{canCompare:true}},fxLookup});
assert.equal(r.valuation.sharesOutstanding,100e6);
assert.equal(r.valuation.pb,Math.round(100*200/(five.equity*1e6/100e6))/100);
const auditedFcf=five.operatingCashFlow*1e6-50e6;
assert.equal(r.valuation.freeCashFlow,auditedFcf);
assert.equal(r.valuation.freeCashFlowYield,Math.round(10000*auditedFcf/(200*100e6))/100);
assert.equal(r.valuation.cashAndEquivalents,120e6);
assert.equal(r.valuation.debtLongTermReported,300e6);
assert.equal(r.valuation.shortTermBorrowings,10e6);
assert.equal(r.valuation.netDebt,null,'Partial debt disclosures may not imply net debt');
assert.equal(r.valuation.debtCoverage,'partial');
assert.equal(r.tradeApproved,false);

// No cross-company data reuse, added equities receive an explicit missing status.
const ds=vm.runInContext('unityFinancialMasterDataset(stocks())',s);
assert.equal(ds.total,2);assert.equal(ds.counts.coreComplete,1);
assert.equal(ds.records[1].sourceKind,'unverified');
assert.equal(ds.records[1].coreComplete,false);
assert.equal(ds.records[1].tradeApproved,false);
// Crypto is excluded from the public equity fundamentals model.
s.stocks=()=>[ABB,{ticker:'BTC',id:'btc'}];
assert.equal(vm.runInContext('unityFinancialMasterDataset(stocks())',s).total,1);
const panel=vm.runInContext('unityFinancialSnapshotPanel(instrument)',Object.assign(s,{instrument:ABB}));
assert.match(panel,/Einheitliche Finanzkennzahlen/);
assert.match(panel,/EZB/);
assert.match(panel,/keine Handelsfreigabe/);
assert.match(panel,/14,52/);
const index=fs.readFileSync('index.html','utf8'),sw=fs.readFileSync('sw.js','utf8');
assert.match(index,/financial-metrics\.js\?v=0\.16\.2/);
assert.match(sw,/financial-metrics\.js\?v=0\.16\.2/);
assert.match(sw,/unity-lab-v0\.16\.2/);
console.log('UNITY standardized issuer facts, USD/CHF FX, same-period ratios, no fake P/E, and full watchlist no-trade checks passed.');
