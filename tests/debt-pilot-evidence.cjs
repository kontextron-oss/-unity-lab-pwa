'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const data=JSON.parse(fs.readFileSync('data/debt-pilot-evidence.json','utf8'));
assert.equal(data.schemaVersion,1);
assert.equal(data.items.IE00B8KQN827.audited,false);
assert.equal(data.items.US92537N1081.audited,false);
const context={Date,Math,Number,String,Object,Array,JSON,Intl,URL,Promise,
 esc:x=>String(x).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'),
 db:null};
vm.createContext(context);
vm.runInContext(fs.readFileSync('valuation-scenarios.js','utf8'),context);
const symbols={
 IE00B8KQN827:{isin:'IE00B8KQN827',ticker:'ETN',currency:'USD'},
 US92537N1081:{isin:'US92537N1081',ticker:'VRT',currency:'USD'}
};
function audit(isin,registry=data.items){
 context.pilotStock=symbols[isin];context.registry=registry;
 return vm.runInContext('unityQuarterDebtEvidence(pilotStock,registry)',context);
}
function markup(isin,registry=data.items){
 context.pilotStock=symbols[isin];context.registry=registry;
 return vm.runInContext('unityQuarterDebtPanel(pilotStock,registry)',context);
}
function tamper(isin,cb){
 const registry=JSON.parse(JSON.stringify(data.items));
 cb(registry[isin]);
 return audit(isin,registry);
}
const etn=audit('IE00B8KQN827'),vrt=audit('US92537N1081');
assert.equal(etn.kind,'unity-unaudited-10q-debt-evidence-v1');
assert.equal(etn.grossFinancialDebt,20106);
assert.equal(etn.cashAndEquivalents,528);
assert.equal(etn.shortTermInvestments,290);
assert.equal(etn.debtLessCash,19578);
assert.equal(etn.yearToDate.operatingCashFlow,2943);
assert.equal(etn.yearToDate.capitalExpenditure,721);
assert.equal(etn.yearToDate.fcfProxy,2222);
assert.equal(etn.unit,'USD millions');
assert.equal(etn.audited,false);
assert.equal(etn.tradeApproved,false);
assert.equal(etn.reviewGateSatisfied,false);
assert.equal(vrt.grossFinancialDebt,2928.5);
assert.equal(vrt.cashAndEquivalents,3512.9);
assert.equal(vrt.shortTermInvestments,198.8);
assert.ok(Math.abs(vrt.debtLessCash-(-584.4))<0.000001);
assert.equal(vrt.yearToDate.operatingCashFlow,2660.6);
assert.equal(vrt.yearToDate.capitalExpenditure,425);
assert.equal(vrt.yearToDate.fcfProxy,2235.6);
assert.equal(vrt.yearToDate.additionalCapitalizedSoftware,5.3);
assert.equal(vrt.tradeApproved,false);
assert.equal(vrt.reviewGateSatisfied,false);
assert.equal(tamper('IE00B8KQN827',r=>r.isin='US92537N1081'),null);
assert.equal(tamper('IE00B8KQN827',r=>r.cik='0001674101'),null);
assert.equal(tamper('IE00B8KQN827',r=>r.sourceUrl='http://example.org'),null);
assert.equal(tamper('IE00B8KQN827',r=>r.sourceUrl='https://www.sec.gov/Archives/edgar/data/1674101/fake.htm'),null);
assert.equal(tamper('IE00B8KQN827',r=>r.periodEnd='2025-12-31'),null);
assert.equal(tamper('IE00B8KQN827',r=>r.audited=true),null);
assert.equal(tamper('IE00B8KQN827',r=>r.filedAt='2020-01-01'),null);
assert.equal(tamper('IE00B8KQN827',r=>r.debtComponents[0].amount=-1),null);
assert.equal(tamper('IE00B8KQN827',r=>r.debtComponents.push({...r.debtComponents[0]})),4);
assert.equal(tamper('IE00B8KQN827',r=>r.yearToDate.period='2026-01-01/2026-12-31'),null);
assert.equal(tamper('US92537N1081',r=>r.debtComponents[1].key='currentLongTermDebt'),null);
assert.equal(tamper('US92537N1081',r=>r.cashAndEquivalents=null),null);
assert.equal(tamper('US92537N1081',r=>r.priorYearComparison.debtComponents[0].amount=null),null);
assert.equal(tamper('US92537N1081',r=>r.yearToDate.capitalExpenditure=-1),null);
const htmlEtn=markup('IE00B8KQN827');
const htmlVrt=markup('US92537N1081');
assert.match(htmlEtn,/SEC-Quartalsbericht/);
assert.match(htmlVrt,/ungeprüfter Quartalsbericht/);
assert.match(htmlEtn,/keine abschließende Nettoverschuldungs-/);
assert.match(htmlVrt,/9 Monate 2026/);
assert.match(htmlEtn,/Risikofreigabe bleibt offen/);
const injection=JSON.parse(JSON.stringify(data.items));
injection.IE00B8KQN827.debtComponents[0].label='<img src=x onerror=alert(1)>';
const htmlSafe=markup('IE00B8KQN827',injection);
assert.ok(!htmlSafe.includes('<img'),'Untrusted labels must be HTML-escaped');
assert.match(htmlSafe,/&lt;img/);
// The official 2026 Q3 figures are explanatory evidence, not independent
// analyst-approved forward assumptions. Even a complete source report must not
// unlock an investment decision.
context.pilotStock=symbols.US92537N1081;
context.researchOptions={
 financial:{coreComplete:true,period:'2025-12-31',reportCurrency:'USD',
  valuation:{freeCashFlow:1893800000,sharesOutstanding:382553680}},
 guidance:null,assumptions:null,
 model:{status:'blocked',tradeApproved:false,modelValues:null},
 calendar:null,calendarFresh:false};
const check=vm.runInContext('unityPilotValuationAudit(pilotStock,researchOptions)',context);
assert.equal(check.gates.find(g=>g.key==='debt').ready,false);
assert.equal(check.tradeApproved,false);
console.log('UNITY 0.17 SEC Q3 debt (Eaton/Vertiv), source checks, 9M-vs-FY, escaping and no-trade invariants passed.');
