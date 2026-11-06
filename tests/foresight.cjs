'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const registry=JSON.parse(fs.readFileSync('data/foresight-checkpoints.json','utf8'));
const guides=JSON.parse(fs.readFileSync('data/issuer-guidance.json','utf8')).items;
const sec=JSON.parse(fs.readFileSync('data/sec-fundamentals.json','utf8')).items;
const etn={isin:'IE00B8KQN827',ticker:'ETN',name:'Eaton',currency:'USD'};
const vrt={isin:'US92537N1081',ticker:'VRT',name:'Vertiv',currency:'USD'};
const abb={isin:'CH0012221716',ticker:'ABBN.SW',name:'ABB',currency:'CHF'};
const unknown={isin:'GB0000000123',ticker:'NEW',name:'Nicht angebunden'};
const stockData={ETN:sec.ETN,VRT:sec.VRT};
const ctx={Date,Math,Number,String,Object,Array,JSON,Intl,URL,Set,
 esc:x=>String(x),unityIsCryptoAsset:s=>s?.ticker==='BTC',
 unityGuidanceEvidence:(s,map)=>{
  const g=map?.[s.isin]||guides[s.isin];
  if(!g||g.isin!==s.isin||!g.sourceUrl||!g.reviewedAt)return null;
  return g;
 },
 unityFundPilotItem:s=>stockData[s.ticker]||null,
 unityIssuerCalendarItem:()=>null,unityIssuerCalendarFresh:()=>false,
 unityReverseValuation:s=>s.ticker==='ETN'?
  {status:'diagnostic',impliedAnnualFcfGrowth:[{id:'r10',impliedGrowthPct:29.57}]}:
  s.ticker==='VRT'?
  {status:'diagnostic',impliedAnnualFcfGrowth:[{id:'r10',impliedGrowthPct:29.29}]}:null
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('foresight.js','utf8'),ctx);
ctx.manifest=registry;
vm.runInContext('unityForesightData=manifest',ctx);
function snapshot(s,options={}){ctx.stock=s;ctx.opts=options;
 return vm.runInContext('unityForesightSnapshot(stock,opts)',ctx)}
function compare(stock,c,report){ctx.stock=stock;ctx.c=c;ctx.report=report;
 return vm.runInContext('unityForesightCompare(stock,c,report)',ctx)}
assert.equal(registry.schemaVersion,1);
assert.equal(registry.checkpoints.length,3);
assert.equal(new Set(registry.checkpoints.map(c=>c.id)).size,3);
for(const c of registry.checkpoints){
 ctx.c=c;assert.equal(vm.runInContext('unityForesightValidatedCheckpoint(c)',ctx),true);
 assert.ok(c.sourceUrl===guides[c.isin].sourceUrl);
 assert.ok(c.sourcePublishedAt<=c.recordedAt&&c.recordedAt<c.periodEnd);
 assert.equal(c.outcome.status,'pending');
 assert.equal(c.outcome.value,null);
}
const etnSnap=snapshot(etn);
assert.equal(etnSnap.checkpoints.length,1);
assert.equal(etnSnap.checkpoints[0].metric,'epsDiluted');
assert.equal(etnSnap.checkpoints[0].measurement.status,'awaiting-audited-FY2026');
assert.equal(etnSnap.checkpoints[0].measurement.value,null);
assert.equal(etnSnap.checkpoints[0].FY2025,10.45);
assert.ok(etnSnap.checkpoints[0].expectedYoYPct.low<0);
assert.ok(etnSnap.checkpoints[0].expectedYoYPct.high>0);
assert.equal(etnSnap.calendar.confirmed,false);
assert.equal(etnSnap.expectations.status,'demanding-under-assumption');
assert.equal(etnSnap.tradeApproved,false);
assert.equal(etnSnap.entryZone,null);
const vrtSnap=snapshot(vrt);
assert.equal(vrtSnap.checkpoints.length,2);
const sales=vrtSnap.checkpoints.find(c=>c.metric==='revenue');
assert.equal(sales.FY2025,10_229_900_000);
assert.ok(sales.expectedYoYPct.low>40&&sales.expectedYoYPct.high<46);
const eps=vrtSnap.checkpoints.find(c=>c.metric==='epsDiluted');
assert.equal(eps.FY2025,3.41);
assert.ok(eps.expectedYoYPct.point>80&&eps.expectedYoYPct.point<90);
assert.equal(vrtSnap.tradeApproved,false);
const abbSnap=snapshot(abb);
assert.equal(abbSnap.checkpoints.length,0);
assert.equal(abbSnap.status,'documented-forward-guidance'===abbSnap.status?
 'documented-forward-guidance':'qualitative-or-unregistered-guidance');
const missing=snapshot(unknown);
assert.equal(missing.status,'insufficient-data');
assert.equal(missing.tradeApproved,false);
ctx.list=[etn,vrt,abb,unknown,{ticker:'BTC',isin:'XBT'}];
const master=vm.runInContext('unityForesightMaster(list)',ctx);
assert.equal(master.total,4);
assert.equal(master.withPreRegisteredCheckpoints,2);
assert.equal(master.trackedTargets,3);
assert.equal(master.withGuidance,3);
assert.equal(master.snapshots.length,master.total);
assert.equal(master.tradeApproved,false);
// A later filing can measure the previously frozen forecasts, but a 2025
// report cannot retrospectively claim to have measured FY2026 guidance.
function filed2026(stock,source2025,field,number){
 const d=JSON.parse(JSON.stringify(source2025));
 d.latestFiling.periodEnd='2026-12-31';
 d.latestFiling.published='2027-02-21';
 const f={...d.metrics[field],value:number,periodEnd:'2026-12-31',filed:'2027-02-21'};
 d.metrics[field]=f;
 d.isin=stock.isin;
 return d;
}
const cETN=registry.checkpoints.find(c=>c.ticker==='ETN');
const cVRTRevenue=registry.checkpoints.find(c=>c.ticker==='VRT'&&c.metric==='revenue');
const cVRTEPS=registry.checkpoints.find(c=>c.ticker==='VRT'&&c.metric==='epsDiluted');
assert.equal(compare(etn,cETN,sec.ETN).status,'awaiting-audited-FY2026');
assert.equal(compare(vrt,cVRTRevenue,filed2026(vrt,sec.VRT,'revenue',14_650_000_000)).status,'within-guidance');
assert.equal(compare(vrt,cVRTRevenue,filed2026(vrt,sec.VRT,'revenue',15_200_000_000)).status,'above-guidance');
assert.equal(compare(vrt,cVRTRevenue,filed2026(vrt,sec.VRT,'revenue',14_000_000_000)).status,'below-guidance');
assert.equal(compare(etn,cETN,filed2026(etn,sec.ETN,'epsDiluted',10.44)).status,'within-guidance');
const midpoint=compare(vrt,cVRTEPS,filed2026(vrt,sec.VRT,'epsDiluted',6.59));
assert.equal(midpoint.status,'point-deviation','Point guidance cannot be judged against a fabricated range');
assert.ok(midpoint.errorPercent>0);
// No lookahead; identity, filing date, source, form and accounting basis matter.
const wrongIssuer=filed2026(vrt,sec.VRT,'revenue',14_650_000_000);
wrongIssuer.isin=etn.isin;
assert.equal(compare(vrt,cVRTRevenue,wrongIssuer).status,'awaiting-audited-FY2026');
const wrongConcept=filed2026(vrt,sec.VRT,'revenue',14_650_000_000);
wrongConcept.metrics.revenue.concept='ifrs-full:Revenue';
assert.equal(compare(vrt,cVRTRevenue,wrongConcept).status,'awaiting-audited-FY2026');
const wrongCurrency=filed2026(vrt,sec.VRT,'revenue',14_650_000_000);
wrongCurrency.reportCurrency='EUR';
assert.equal(compare(vrt,cVRTRevenue,wrongCurrency).status,'awaiting-audited-FY2026');
const wrongDate=filed2026(vrt,sec.VRT,'revenue',14_650_000_000);
wrongDate.metrics.revenue.filed='2026-11-06';
assert.equal(compare(vrt,cVRTRevenue,wrongDate).status,'awaiting-audited-FY2026');
const stale=filed2026(vrt,sec.VRT,'revenue',14_650_000_000);
stale.status='stale-previous';
assert.equal(compare(vrt,cVRTRevenue,stale).status,'awaiting-audited-FY2026');
const wrongSource=filed2026(vrt,sec.VRT,'revenue',14_650_000_000);
wrongSource.metrics.revenue.sourceUrl='https://example.com/bad';
assert.equal(compare(vrt,cVRTRevenue,wrongSource).status,'awaiting-audited-FY2026');
// Confirmed future events only: unknown or stale dates never invented.
const calendar=()=>vm.runInContext('unityForesightCalendar(stock)',ctx);
ctx.stock=etn;
assert.equal(calendar().confirmed,false);
ctx.unityIssuerCalendarItem=()=>({
 status:'confirmed-future-earnings',nextEarnings:'2026-11-18',
 sourceUrl:'https://www.eaton.com/us/en-us/company/news-insights.html'
});
ctx.unityIssuerCalendarFresh=()=>true;
assert.equal(calendar().date,'2026-11-18');
ctx.unityIssuerCalendarFresh=()=>false;
assert.equal(calendar().confirmed,false);
ctx.unityIssuerCalendarItem=()=>null;
const panel=vm.runInContext('unityForesightPanel(stock)',ctx);
assert.match(panel,/Vorausschau/);
assert.match(panel,/FY2026/);
assert.match(panel,/10,39/);
assert.doesNotMatch(panel,/Kaufen/);
ctx.list=[etn,vrt,abb,unknown];
const view=vm.runInContext('unityForesightOverview(list)',ctx);
assert.match(view,/Gesamte Aktienliste/);
assert.match(view,/4 Titel berücksichtigt/);
const ix=fs.readFileSync('index.html','utf8'),sw=fs.readFileSync('sw.js','utf8');
assert.match(ix,/foresight\.js\?v=0\.16\.1/);
assert.match(sw,/foresight\.js\?v=0\.16\.1/);
assert.match(sw,/data\/foresight-checkpoints\.json/);
assert.match(sw,/unity-lab-v0\.16\.1/);
console.log('UNITY 0.16.1 foresight: prospectively frozen management targets, FY2025 baselines, FY2026 outcome audit, no invented dates/learning scores or trades passed.');
