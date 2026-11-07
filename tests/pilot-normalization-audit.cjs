'use strict';
/* UNITY 0.17: normalization audit may expose sources, never adjust future FCF. */
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const evidence=JSON.parse(fs.readFileSync('data/normalization-evidence.json','utf8')).items;
const sec=JSON.parse(fs.readFileSync('data/sec-fundamentals.json','utf8')).items;
const quarter=JSON.parse(fs.readFileSync('data/debt-pilot-evidence.json','utf8')).items;
const c={Date,Math,Number,String,Object,Array,JSON,Intl,URL,Promise,
 esc:x=>String(x).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'),
 db:null};
vm.createContext(c);
vm.runInContext(fs.readFileSync('valuation-scenarios.js','utf8'),c);
const stocks=[
 {ticker:'ETN',isin:'IE00B8KQN827',expectedWC:-1050,expectedAcquisition:11079,expectedTTM:3795},
 {ticker:'VRT',isin:'US92537N1081',expectedWC:540.5,expectedAcquisition:278.1,expectedTTM:3147.2}
];
function financial(s){
 const d=sec[s.ticker];
 assert.equal(d.isin,s.isin);
 return {instrument:{isin:s.isin},coreComplete:true,sourceKind:'sec',
  sourceUrl:d.latestFiling.reportUrl,period:'2025-12-31',reportCurrency:'USD',
  core:{operatingCashFlow:d.metrics.operatingCashFlow.value},
  valuation:{capitalExpenditure:d.metrics.capitalExpenditure.value,
   freeCashFlow:d.derived.freeCashFlow.value,
   sharesOutstanding:d.metrics.sharesOutstanding.value}};
}
function run(s,changes={}){
 const d=quarter[s.isin],f=financial(s);
 c.s=s;
 c.debtInput={...d};
 c.debtRegistry={[s.isin]:c.debtInput};
 const q=vm.runInContext('unityQuarterDebtEvidence(s,debtRegistry)',c);
 c.q=q;
 c.ttmFinancial=f;
 const t=vm.runInContext('unityPilotTrailingCashFlow(s,{financial:ttmFinancial,debt:q})',c);
 c.evidence=evidence[s.isin]; c.ttm=t;
 c.reviewOptions={evidence:c.evidence,quarter:q,ttm:t,...changes};
 return vm.runInContext('unityPilotNormalizationReview(s,reviewOptions)',c);
}
function panel(s,changes={}){
 run(s,changes);
 return vm.runInContext('unityPilotNormalizationReviewPanel(s,reviewOptions)',c);
}
for(const s of stocks){
 const r=run(s);
 assert.equal(r.kind,'unity-fcf-normalization-gate-v1');
 assert.equal(r.status,'disclosure-complete-normalization-open');
 assert.equal(r.completeness,'insufficient-for-forward-normalization');
 assert.equal(r.normalizedTTMFcf,null);
 assert.equal(r.reportedTTMFcfProxy,s.expectedTTM);
 assert.equal(r.fairValue,null);
 assert.equal(r.entryZone,null);
 assert.equal(r.tradeApproved,false);
 assert.equal(r.investmentReady,false);
 assert.equal(r.blockers.length,5);
 assert.equal(r.sourceRefs[0].url,evidence[s.isin].sourceUrl);
 assert.equal(r.potentialDistortions.workingCapital.in9m2026,s.expectedWC);
 assert.equal(r.potentialDistortions.acquisitions.in9m2026,s.expectedAcquisition);
 assert.equal(r.potentialDistortions.workingCapital.automaticAdjustmentAllowed,false);
 assert.equal(r.potentialDistortions.acquisitions.automaticAdjustmentAllowed,false);
 assert.equal(r.potentialDistortions.acquisitions.classification,'investing-cash-flow-not-ocf');
 assert.equal(r.comparisonScope.includes('total'),s.ticker==='VRT');
 assert.ok(!('normalized' in r.potentialDistortions));
 const html=panel(s);
 assert.match(html,/Berichteter TTM-Cashflow-Proxy/);
 assert.match(html,/keine Kauf-Freigabe/);
 assert.match(html,/nicht automatisch hinzu- oder abgerechnet/);
 assert.equal(run(s,{evidence:null}).status,'blocked');
 assert.equal(run(s,{evidence:{...evidence[s.isin],isin:'US0000000000'}}).status,'blocked');
 assert.equal(run(s,{evidence:{...evidence[s.isin],cik:'0009999999'}}).status,'blocked');
 assert.equal(run(s,{evidence:{...evidence[s.isin],sourceUrl:'https://attacker.example/'}}).status,'blocked');
 assert.equal(run(s,{evidence:{...evidence[s.isin],audited:true}}).status,'blocked');
 assert.equal(run(s,{evidence:{...evidence[s.isin],filedAt:'2026-01-01'}}).status,'blocked');
 assert.equal(run(s,{evidence:{...evidence[s.isin],unit:'EUR millions'}}).status,'blocked');
 assert.equal(run(s,{evidence:{...evidence[s.isin],
  operatingWorkingCapitalMovement:{...evidence[s.isin].operatingWorkingCapitalMovement,in9m2026:null}}}).status,'blocked');
 assert.equal(run(s,{evidence:{...evidence[s.isin],
  acquisitionCashPaid:{...evidence[s.isin].acquisitionCashPaid,in9m2026:-1}}}).status,'blocked');
 assert.equal(run(s,{quarter:{...r.quarter,sourceUrl:'https://attacker.example/'}}).status,'blocked');
 assert.equal(run(s,{ttm:{...c.ttm,tradeApproved:true}}).status,'blocked');
 assert.equal(run(s,{ttm:{...c.ttm,normalised:true}}).status,'blocked');
 assert.equal(run(s,{ttm:{...c.ttm,ttmFcfProxy:null}}).status,'blocked');
 const copied=JSON.parse(JSON.stringify(evidence[s.isin]));
 copied.operatingWorkingCapitalMovement.scope='<img src=x onerror=alert(1)>';
 const escaped=panel(s,{evidence:copied});
 assert.ok(!escaped.includes('<img'));
}
const e=run(stocks[0]);
assert.equal(e.potentialDistortions.borrowings.in9m2026,9871);
assert.equal(e.potentialDistortions.borrowings.classification,'financing-not-operating-cash-flow');
assert.equal(e.potentialDistortions.expectedFullYearCapex.value,1150);
assert.equal(e.potentialDistortions.expectedFullYearCapex.classification,'company-outlook-not-executed');
const v=run(stocks[1]);
assert.equal(v.potentialDistortions.softwareCapitalized.in9m2026,5.3);
assert.equal(v.potentialDistortions.softwareCapitalized.automaticAdjustmentAllowed,false);
c.s={isin:'CH0012221716',ticker:'ABBN'};
c.reviewOptions={};
assert.equal(vm.runInContext('unityPilotNormalizationReview(s,reviewOptions)',c),null);
const assumptions=JSON.parse(fs.readFileSync('data/valuation-assumptions.json','utf8'));
assert.equal(Object.keys(assumptions.items).length,0);
console.log('UNITY 0.17 normalization: acquisitions, WC, financing, software, source gates, no auto add-backs or trades passed.');
