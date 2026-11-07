'use strict';
/* UNITY 0.17: pilot valuation evidence must never silently become approval. */
const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const day=new Date().toISOString().slice(0,10);
const stock={isin:'US92537N1081',ticker:'VRT',currency:'USD'};
const finance={
 coreComplete:true,period:'2025-12-31',reportCurrency:'USD',
 valuation:{freeCashFlow:500,sharesOutstanding:100},
 priceRef:{price:100,date:day,exchange:'NYSE'},fx:{value:1}
};
const guide={isin:stock.isin,ticker:stock.ticker,
 publishedAt:day,reviewedAt:day,
 sourceUrl:'https://investors.vertiv.com/news',sourceHost:'investors.vertiv.com',
 guidance:[{metric:'revenue',unit:'USD',lower:1,upper:2,label:'Umsatz'}]
};
const model={status:'blocked',modelValues:null,marginOfSafetyPct:null,
 indicativeEntryZone:null,tradeApproved:false};
const context={Date,Math,Number,String,Object,Array,JSON,Intl,URL,Promise,
 esc:x=>String(x),db:null};
vm.createContext(context);
vm.runInContext(fs.readFileSync('valuation-scenarios.js','utf8'),context);
const evalAudit=(overrides={},instrument=stock)=>{
 context.stock=instrument;
 context.options={financial:finance,guidance:guide,assumptions:null,
  model,calendar:null,calendarFresh:false,...overrides};
 return vm.runInContext('unityPilotValuationAudit(stock,options)',context);
};
const byKey=(r,key)=>r.gates.find(g=>g.key===key);
let audit=evalAudit();
assert.equal(audit.kind,'unity-valuation-evidence-audit-v1');
assert.equal(audit.total,7);
assert.equal(audit.readyCount,3);
assert.deepEqual(Array.from(audit.gates.filter(g=>g.ready),g=>g.key),
 ['annual','cashflow','guidance']);
assert.equal(audit.tradeApproved,false);
assert.equal(audit.sourceReady,false);
assert.equal(audit.nextSteps.length,4);
assert.equal(byKey(audit,'debt').ready,false);
assert.equal(byKey(audit,'valuation').ready,false);
assert.equal(byKey(audit,'market').ready,false);
assert.equal(byKey(audit,'earnings').ready,false);
assert.equal(evalAudit({}, {isin:'CH0012221716',currency:'CHF'}),null);
assert.equal(byKey(evalAudit({guidance:{...guide,isin:'US0000000000'}}),'guidance').ready,false);
assert.equal(byKey(evalAudit({guidance:{...guide,sourceUrl:'http://invalid.example.com'}}),'guidance').ready,false);
assert.equal(byKey(evalAudit({guidance:{...guide,publishedAt:'2020-01-01'}}),'guidance').ready,false);
assert.equal(byKey(evalAudit({financial:{...finance,valuation:{...finance.valuation,freeCashFlow:null}}}),'cashflow').ready,false);
assert.equal(byKey(evalAudit({financial:{...finance,coreComplete:false}}),'annual').ready,false);
const assumption={
 isin:stock.isin,periodEnd:finance.period,currency:'USD',
 guidanceSourceUrl:guide.sourceUrl,
 debtRiskReview:{
  status:'reviewed',isin:stock.isin,periodEnd:finance.period,
  currency:'USD',grossDebt:100,cashAndEquivalents:50,
  cashFlowBasisVerified:true,outcome:'acceptable',asOf:day,
  sourceUrl:'https://investors.vertiv.com/debt',
  sourceHost:'investors.vertiv.com'
 }
};
const modeled={status:'scenario-only',tradeApproved:false,
 modelValues:{bear:{},base:{},bull:{}},marginOfSafetyPct:25,
 indicativeEntryZone:{referencePrice:100,currency:'USD'}};
audit=evalAudit({assumptions:assumption,model:modeled});
assert.equal(byKey(audit,'debt').ready,true);
assert.equal(byKey(audit,'valuation').ready,true);
assert.equal(byKey(audit,'market').ready,true);
assert.equal(byKey(audit,'earnings').ready,false);
assert.equal(audit.tradeApproved,false);
assert.equal(audit.sourceReady,false);
const calendar={status:'confirmed-future-earnings',
 nextEarnings:'2099-01-01',sourceUrl:'https://investors.vertiv.com/earnings'};
audit=evalAudit({assumptions:assumption,model:modeled,calendar,calendarFresh:true});
assert.equal(audit.readyCount,7);
assert.equal(audit.sourceReady,true);
assert.equal(audit.tradeApproved,false,'all evidence present is STILL not a trade approval');
assert.equal(byKey(evalAudit({assumptions:assumption,model:modeled,
 calendar,calendarFresh:false}),'earnings').ready,false);
assert.equal(byKey(evalAudit({assumptions:{...assumption,
  debtRiskReview:{...assumption.debtRiskReview,grossDebt:null}},model:modeled}),
 'valuation').ready,false,'incomplete debt blocks valuation gate');
assert.equal(byKey(evalAudit({assumptions:assumption,model:{
 ...modeled,tradeApproved:true}}),'valuation').ready,false,
 'a trading-enabled model cannot be treated as research-only evidence');
context.stock=stock;context.options={financial:finance,guidance:guide,assumptions:null,
 model,calendar:null,calendarFresh:false};
const markup=vm.runInContext('unityPilotValuationAuditPanel(stock,options)',context);
assert.match(markup,/UNITY 0\.17/);
assert.match(markup,/3 \/ 7/);
assert.match(markup,/keine Handelsfreigabe/);
const assumptionsLive=JSON.parse(fs.readFileSync('data/valuation-assumptions.json','utf8'));
assert.deepEqual(assumptionsLive.items,{},'No invented fair value parameters in public data');
console.log('UNITY 0.17 Eaton/Vertiv evidence gates, issuer integrity, stale-source vetos, and strict no-trade rules passed.');
