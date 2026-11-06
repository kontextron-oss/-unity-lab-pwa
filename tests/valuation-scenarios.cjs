'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const today=new Date().toISOString().slice(0,10);
const s={isin:'IE00B8KQN827',ticker:'ETN',name:'Eaton',currency:'USD'};
const official='https://www.eaton.com/us/en-us/company/news-insights/news-releases/2026/eaton-reports-record-third-quarter-2026-results.html';
const guidance={isin:s.isin,ticker:s.ticker,sourceUrl:official,sourceHost:'www.eaton.com',
 fiscalYear:2026,publishedAt:today,reviewedAt:today,
 guidance:[{metric:'dilutedEPS',unit:'USD/shares',lower:10.39,upper:10.49,label:'Gewinn je Aktie'}]};
const finance={coreComplete:true,period:'2025-12-31',reportCurrency:'USD',
 valuation:{freeCashFlow:800,sharesOutstanding:100},
 priceRef:{price:65,date:today,exchange:'NYSE'},fx:{value:1}};
const source='https://www.eaton.com/us/en-us/company/investor-relations.html';
const assumptions={isin:s.isin,periodEnd:finance.period,currency:'USD',reviewed:true,
 reviewedBy:'verified-research-reviewer',analystReviewedAt:today,
 guidanceSourceUrl:official,
 debtRiskReview:{status:'reviewed',asOf:today,sourceUrl:source,sourceHost:'www.eaton.com',outcome:'acceptable'},
 years:5,marginOfSafetyPct:25,
 scenarios:{
  bear:{growthPct:-5,discountPct:16,terminalGrowthPct:0,rationale:'Prolonged cyclical slowdown'},
  base:{growthPct:4,discountPct:12,terminalGrowthPct:2,rationale:'Explicitly independently documented moderate-growth case'},
  bull:{growthPct:10,discountPct:10,terminalGrowthPct:3,rationale:'Strong execution with upside under reviewed demand scenario'}
 }};
const context={Date,Math,Number,String,Object,Array,JSON,Intl,URL,Promise,esc:x=>String(x),
 db:null,fetch:async(url)=>({ok:true,json:async()=>url.includes('issuer-guidance')?
   {schemaVersion:1,items:{[s.isin]:guidance}}:{schemaVersion:1,items:{}}}),
 unityFinancialStockSnapshot:()=>finance};
vm.createContext(context);
vm.runInContext(fs.readFileSync('valuation-scenarios.js','utf8'),context);
function output(config={}){context.stock=config.stock||s;context.options={
 financial:config.finance===undefined?finance:config.finance,
 guidance:config.guide===undefined?guidance:config.guide,
 assumptions:config.assumptions===undefined?assumptions:config.assumptions};
 return vm.runInContext('unityScenarioValuation(stock,options)',context)}
let result=output();
assert.equal(result.status,'scenario-only');
assert.equal(result.tradeApproved,false);
assert.equal(result.method,'illustrative-equity-fcf-proxy');
assert.equal(result.marginOfSafetyPct,25);
assert.ok(result.modelValues.bear.valueReportCurrency<result.modelValues.base.valueReportCurrency);
assert.ok(result.modelValues.base.valueReportCurrency<result.modelValues.bull.valueReportCurrency);
assert.equal(result.indicativeEntryZone.currency,'USD');
assert.ok(result.indicativeEntryZone.low<result.indicativeEntryZone.high);
assert.ok(!result.decision.includes('Kaufen'));
assert.equal(output({assumptions:null}).status,'blocked');
assert.equal(output({guide:null}).status,'blocked');
assert.equal(output({finance:{...finance,valuation:{...finance.valuation,freeCashFlow:null}}}).status,'blocked');
assert.equal(output({finance:{...finance,valuation:{...finance.valuation,sharesOutstanding:null}}}).status,'blocked');
assert.equal(output({assumptions:{...assumptions,isin:'US0000000001'}}).status,'blocked');
assert.equal(output({assumptions:{...assumptions,
 debtRiskReview:{...assumptions.debtRiskReview,outcome:'veto'}}}).status,'blocked');
assert.equal(output({assumptions:{...assumptions,
 guidanceSourceUrl:'https://unverified.example/'}}).status,'blocked');
assert.equal(output({assumptions:{...assumptions,
 scenarios:{...assumptions.scenarios,base:{...assumptions.scenarios.base,discountPct:1}}}}).status,'blocked');
assert.equal(output({assumptions:{...assumptions,
 scenarios:{...assumptions.scenarios,bear:{...assumptions.scenarios.bear,growthPct:30}}}}).status,'blocked');
const noQuote=output({finance:{...finance,priceRef:null,fx:null}});
assert.equal(noQuote.status,'scenario-only');
assert.equal(noQuote.indicativeEntryZone,null);
assert.match(noQuote.missing.join(' '),/Kurs/);
assert.equal(noQuote.tradeApproved,false);
assert.equal(output({guide:{...guidance,isin:'US0000000002'}}).status,'blocked');
context.stock=s;context.registry={[s.isin]:{...guidance,sourceUrl:'http://www.eaton.com/' }};
assert.equal(vm.runInContext('unityGuidanceEvidence(stock,registry)',context),null);
context.registry={[s.isin]:guidance};
assert.ok(vm.runInContext('unityGuidanceEvidence(stock,registry)',context));
const publicGuidance=JSON.parse(fs.readFileSync('data/issuer-guidance.json','utf8'));
assert.equal(publicGuidance.schemaVersion,1);
for(const [isin,g] of Object.entries(publicGuidance.items)){
 assert.equal(g.isin,isin);
 assert.ok(g.sourceUrl.startsWith('https://'+g.sourceHost+'/'));
 assert.ok(g.guidance.length>=2);
}
const empty=JSON.parse(fs.readFileSync('data/valuation-assumptions.json','utf8'));
assert.equal(Object.keys(empty.items).length,0,'Never deploy implicit growth/discount assumptions');
const ix=fs.readFileSync('index.html','utf8'),sw=fs.readFileSync('sw.js','utf8');
assert.match(ix,/valuation-scenarios\.js\?v=0\.15\.3\.9/);
assert.match(sw,/valuation-scenarios\.js\?v=0\.15\.3\.9/);
assert.match(sw,/unity-lab-v0\.15\.3\.9/);
console.log('Source-bound management guidance, 3-scenario owner-cashflow proxy, safety-margin band and strict no-trade vetos passed.');
