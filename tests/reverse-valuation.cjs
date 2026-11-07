'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const guidance=JSON.parse(fs.readFileSync('data/issuer-guidance.json','utf8')).items;
const day=new Date().toISOString().slice(0,10);
const cases=[
 {stock:{id:'eaton',isin:'IE00B8KQN827',ticker:'ETN',currency:'USD',name:'Eaton'},
  fcf:3_553_000_000,shares:387_900_000,price:341.72,epsLo:10.39,epsHi:10.49},
 {stock:{id:'vertiv',isin:'US92537N1081',ticker:'VRT',currency:'USD',name:'Vertiv'},
  fcf:1_893_800_000,shares:382_553_680,price:182.82,epsLo:6.29,epsHi:6.29}
];
const ctx={Date,Math,Number,String,Object,Array,JSON,Intl,URL,
 esc:v=>String(v), unityGuidanceEvidence:(s,registry)=>{
   const g=registry?.[s.isin];
   return g&&g.isin===s.isin&&g.sourceUrl.startsWith('https://')?g:null
 }};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('reverse-valuation.js','utf8'),ctx);
function analyze(sample,mods={}){
 ctx.stock=mods.stock||sample.stock;
 ctx.options={
   financial:mods.financial??{
    instrument:{isin:sample.stock.isin},coreComplete:true,sourceKind:'sec',
    reportCurrency:'USD',period:'2025-12-31',
    valuation:{freeCashFlow:sample.fcf,sharesOutstanding:sample.shares},
    priceRef:{price:sample.price,date:day,exchange:'NYSE'},
    quoteInReportCurrency:sample.price
   },
   guidance:mods.guidance===undefined?guidance[sample.stock.isin]:mods.guidance
 };
 return vm.runInContext('unityReverseValuation(stock,options)',ctx);
}
for(const sample of cases){
 const r=analyze(sample);
 assert.equal(r.status,'diagnostic');
 assert.equal(r.tradeApproved,false);
 assert.equal(r.entryZone,null);
 assert.equal(r.guidanceSource,guidance[sample.stock.isin].sourceUrl);
 assert.equal(r.underlyingPeriod,'2025-12-31');
 assert.equal(r.forwardGaapPE.fiscalYear,2026);
 assert.ok(Math.abs(r.forwardGaapPE.low-sample.price/sample.epsHi)<0.02);
 assert.ok(Math.abs(r.forwardGaapPE.high-sample.price/sample.epsLo)<0.02);
 assert.equal(r.impliedAnnualFcfGrowth.length,3);
 assert.ok(r.impliedAnnualFcfGrowth.every(x=>typeof x.impliedGrowthPct==='number'));
 assert.ok(r.impliedAnnualFcfGrowth[0].impliedGrowthPct<
           r.impliedAnnualFcfGrowth[1].impliedGrowthPct);
 assert.ok(r.impliedAnnualFcfGrowth[1].impliedGrowthPct<
           r.impliedAnnualFcfGrowth[2].impliedGrowthPct);
 assert.equal(r.assumptions.nature,'unreviewed sensitivity – NOT a company forecast');
 const expected10=sample.stock.ticker==='ETN'?29.57:29.29;
 assert.ok(Math.abs(r.impliedAnnualFcfGrowth[1].impliedGrowthPct-expected10)<0.2,
   'Reverse DCF should stay stable for audited FY2025 FCF and sourced closing price');
 assert.equal(r.decision.startsWith('Beobachten'),true);
 assert.ok(r.fcfPerShare>0);
}
assert.equal(analyze(cases[0],{stock:{...cases[0].stock,isin:'OTHER'}}).status,'blocked');
assert.equal(analyze(cases[0],{financial:{
 instrument:{isin:cases[0].stock.isin},coreComplete:true,sourceKind:'sec',period:'2025-12-31',
 valuation:{freeCashFlow:3_553_000_000,sharesOutstanding:null},
 quoteInReportCurrency:341.72,priceRef:{date:day}
}}).status,'blocked');
const stale={instrument:{isin:cases[0].stock.isin},coreComplete:true,sourceKind:'sec',
 period:'2025-12-31',valuation:{freeCashFlow:3_553_000_000,sharesOutstanding:387_900_000},
 quoteInReportCurrency:341.72,priceRef:{date:'2020-01-01'}};
assert.equal(analyze(cases[0],{financial:stale}).status,'blocked');
assert.equal(analyze(cases[0],{guidance:null}).forwardGaapPE,null);
assert.equal(analyze(cases[0],{guidance:{...guidance[cases[0].stock.isin],
 isin:'US9999999999'}}).forwardGaapPE,null);
assert.equal(analyze(cases[0],{guidance:{...guidance[cases[0].stock.isin],
 guidance:[{metric:'adjustedEPS',horizon:'FY2026',unit:'USD/shares',lower:13,upper:14,nonGAAP:true}]}}).forwardGaapPE,null);
ctx.baseline=3_553_000_000/387_900_000;
const projected=vm.runInContext('unityReverseDcfPerShare(baseline,10,10,2,5)',ctx);
ctx.target=projected;
assert.ok(Math.abs(vm.runInContext('unityReverseImpliedGrowth(baseline,target,10,2,5)',ctx)-10)<.02);
assert.equal(vm.runInContext('unityReverseDcfPerShare(1,5,3,2,5)',ctx),null);
const index=fs.readFileSync('index.html','utf8');
const sw=fs.readFileSync('sw.js','utf8');
assert.match(index,/reverse-valuation\.js\?v=0\.16\.5/);
assert.match(sw,/reverse-valuation\.js\?v=0\.16\.5/);
assert.match(sw,/unity-lab-v0\.17\.0-rc1/);
console.log('UNITY 0.16 Eaton/Vertiv: strict same-ISIN 2026 GAAP forward P/E, reverse DCF and no-trade coverage passed.');
