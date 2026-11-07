'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const checkpoints=JSON.parse(fs.readFileSync('data/foresight-checkpoints.json','utf8')).checkpoints;
const sec=JSON.parse(fs.readFileSync('data/sec-fundamentals.json','utf8'));
const g=JSON.parse(fs.readFileSync('data/issuer-guidance.json','utf8')).items;
const etn={isin:'IE00B8KQN827',ticker:'ETN',name:'Eaton'};
const vrt={isin:'US92537N1081',ticker:'VRT',name:'Vertiv'};
const abb={isin:'CH0012221716',ticker:'ABBN.SW',name:'ABB'};
const ctx={Date,Math,Number,String,Object,Array,JSON,Intl,URL,Set,
 esc:String,unityIsCryptoAsset:()=>false,
 unityGuidanceEvidence:(s)=>g[s.isin]||null,
 unityFundPilotItem:s=>sec.items[s.ticker]||null,
 unityIssuerCalendarItem:()=>null,
 unityIssuerCalendarFresh:()=>false,
 unityReverseValuation:s=>s.ticker==='VRT'?
   {status:'diagnostic',impliedAnnualFcfGrowth:[{id:'r10',impliedGrowthPct:29.29}]}:
   {status:'limited',impliedAnnualFcfGrowth:[]}
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('foresight.js','utf8'),ctx);
ctx.registry=checkpoints;
vm.runInContext('unityForesightData={schemaVersion:1,checkpoints:registry}',ctx);
function snapshot(stock,options){ctx.stock=stock;ctx.options=options||{};
 return vm.runInContext('unityForesightSnapshot(stock,options)',ctx)}
function setOutcome(doc){ctx.result=doc;vm.runInContext('unityForesightOutcomes=result',ctx);}
function register(checkpoint,value){
 return {id:checkpoint.id,isin:checkpoint.isin,ticker:checkpoint.ticker,metric:checkpoint.metric,
  periodEnd:checkpoint.periodEnd,recordedAt:checkpoint.recordedAt,
  guidanceSourceUrl:checkpoint.sourceUrl,forecast:checkpoint.forecast,
  status:'verified',verified:{
    value,filedAt:'2027-02-21',
    sourceUrl:sec.items[checkpoint.ticker].latestFiling.reportUrl,
    periodEnd:checkpoint.periodEnd,unit:checkpoint.unit,
    concept:'us-gaap:'+(checkpoint.metric==='revenue'?
      'RevenueFromContractWithCustomerExcludingAssessedTax':'EarningsPerShareDiluted'),
    category:'within-guidance',errorPercent:0
  }};
}
const current=snapshot(vrt);
const rev=current.checkpoints.find(x=>x.metric==='revenue');
assert.equal(rev.FY2025,10_229_900_000);
assert.equal(rev.measurement.status,'awaiting-audited-FY2026');
let audited={schemaVersion:1,generatedAt:'2027-03-10T00:00:00Z',source:'SEC public annual audit',entries:{}};
for(const c of checkpoints){
 audited.entries[c.id]=register(c,c.forecast.kind==='range'?
   (c.forecast.low+c.forecast.high)/2:c.forecast.value);
}
setOutcome(audited);
let s=snapshot(vrt);
assert.ok(s.checkpoints.every(x=>x.measurement?.auditStatus==='verified'));
assert.equal(s.checkpoints.find(x=>x.metric==='revenue').measurement.value,14_650_000_000);
ctx.snap=s;
assert.equal(vm.runInContext('unityForesightPriority(snap).rank',ctx),2);
assert.equal(s.tradeApproved,false);
assert.equal(s.entryZone,null);
const tampered=JSON.parse(JSON.stringify(audited));
const cVrt=checkpoints.find(c=>c.ticker==='VRT'&&c.metric==='revenue');
tampered.entries[cVrt.id].isin='US9999999999';
setOutcome(tampered);
assert.equal(snapshot(vrt).checkpoints.find(x=>x.metric==='revenue').measurement.auditStatus,undefined);
tampered.entries[cVrt.id].isin=cVrt.isin;
tampered.entries[cVrt.id].verified.concept='ifrs-full:Revenue';
setOutcome(tampered);
assert.equal(snapshot(vrt).checkpoints.find(x=>x.metric==='revenue').measurement.auditStatus,undefined);
const revised=JSON.parse(JSON.stringify(audited));
revised.entries[cVrt.id].status='revision-review';
revised.entries[cVrt.id].observedCandidate={value:15_900_000_000,filedAt:'2027-04-08'};
setOutcome(revised);
s=snapshot(vrt);
assert.equal(s.checkpoints.find(x=>x.metric==='revenue').measurement.value,14_650_000_000);
assert.equal(s.checkpoints.find(x=>x.metric==='revenue').measurement.auditStatus,'revision-review');
ctx.snap=s;
assert.equal(vm.runInContext('unityForesightPriority(snap).rank',ctx),0);
ctx.stock=vrt;
const html=vm.runInContext('unityForesightPanel(stock)',ctx);
assert.match(html,/SEC-Nachmeldung weicht/);
assert.match(html,/Abweichung prüfen/);
// On the FY2026 update, prior SEC annual FY2025 remains available for
// comparison and the UI must never mistake the FY2026 outcome as 2025 baseline.
const fake=JSON.parse(JSON.stringify(sec.items.VRT));
fake.latestFiling.periodEnd='2026-12-31';
fake.priorFiling={periodEnd:'2025-12-31'};
fake.priorMetrics=JSON.parse(JSON.stringify(sec.items.VRT.metrics));
fake.metrics.revenue.value=14_650_000_000;
fake.metrics.revenue.periodEnd='2026-12-31';
fake.metrics.revenue.filed='2027-02-21';
fake.metrics.epsDiluted.value=6.29;
fake.metrics.epsDiluted.periodEnd='2026-12-31';
fake.metrics.epsDiluted.filed='2027-02-21';
const fromUpdated=snapshot(vrt,{report:fake});
const point=fromUpdated.checkpoints.find(x=>x.metric==='revenue');
assert.equal(point.FY2025,10_229_900_000);
assert.ok(point.expectedYoYPct.low>40);
const sourceMissing={...fake,priorFiling:null,priorMetrics:{}};
const noLookahead=snapshot(vrt,{report:sourceMissing});
assert.equal(noLookahead.checkpoints[0].FY2025,null);
setOutcome({schemaVersion:1,entries:{}});
ctx.list=[etn,vrt,abb];
const master=vm.runInContext('unityForesightMaster(list)',ctx);
assert.equal(master.total,3);
assert.equal(master.trackedTargets,3);
assert.equal(master.tradeApproved,false);
const ix=fs.readFileSync('index.html','utf8'),sw=fs.readFileSync('sw.js','utf8');
assert.match(ix,/foresight\.js\?v=0\.16\.5/);
assert.match(sw,/data\/foresight-outcomes\.json/);
assert.match(sw,/unity-lab-v0\.16\.5/);
console.log('UNITY 0.16.5: SEC outcome journal, precommit integrity, 2025 historical base and priority alert safety checks passed.');
