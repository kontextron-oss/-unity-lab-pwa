'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const ctx={Date,Math,Number,String,Object,Array,JSON,Intl,URL,
 esc:v=>String(v)};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('own-model.js','utf8'),ctx);
const empty=JSON.parse(fs.readFileSync('data/unity-model-forecasts.json','utf8'));
assert.equal(empty.schemaVersion,1);
assert.equal(empty.measuredSampleSize,0);
assert.equal(empty.verifiedForecastSkill,null);
ctx.document=empty;vm.runInContext('unityOwnModelJournal=document',ctx);
const etn={isin:'IE00B8KQN827',ticker:'ETN',name:'Eaton'};
ctx.stock=etn;
assert.equal(vm.runInContext('unityOwnModelEntries(stock).length',ctx),0);
assert.equal(vm.runInContext('unityOwnModelForecastPanel(stock)',ctx),'');
const fp='0123456789abcdef'.repeat(4),id='unity-revenue-momentum-shrink-v1:ETN:FY2026';
const fixture={schemaVersion:1,modelCalibrated:false,measuredSampleSize:0,
 counts:{'awaiting-audited-target-year':1,verified:0},
 forecasts:{
  [id]:{
   forecastFingerprint:fp,status:'awaiting-audited-target-year',verified:null,
   frozen:{
    id,modelId:'unity-revenue-momentum-shrink-v1',
    createdAt:'2026-11-07T00:30:00Z',ticker:'ETN',isin:etn.isin,cik:'0001551182',
    metric:'revenue',targetPeriodEnd:'2026-12-31',basePeriodEnd:'2025-12-31',
    historicGrowthPct:10.33,projectedGrowthPct:5.16,
    predictedRevenueUSD:28_870_000_000,flatRevenueBenchmarkUSD:27_448_000_000,
    inputs:{current:{value:27_448_000_000,
      sourceUrl:'https://data.sec.gov/api/xbrl/companyfacts/CIK0001551182.json'}}
   }
  }
 }};
ctx.document=fixture;vm.runInContext('unityOwnModelJournal=document',ctx);
const entries=vm.runInContext('unityOwnModelEntries(stock)',ctx);
assert.equal(entries.length,1);
const panel=vm.runInContext('unityOwnModelForecastPanel(stock)',ctx);
assert.match(panel,/UNITY-eigene Prognose/);
assert.match(panel,/Ergebnisprüfung noch offen/);
assert.match(panel,/28,87 Mrd/);
assert.match(panel,/Unveränderliches Prognoseprotokoll/);
assert.doesNotMatch(panel,/Kauf freigegeben/);
const overview=vm.runInContext('unityOwnModelOverview()',ctx);
assert.match(overview,/1 im Voraus protokollierte Modellhypothesen/);
assert.match(overview,/0 später überprüfte Ergebnisse/);
const measured=JSON.parse(JSON.stringify(fixture));
measured.measuredSampleSize=1;
measured.forecasts[id].status='verified';
measured.forecasts[id].verified={valueUSD:29_000_000_000,
 absoluteErrorPct:0.45,baselineAbsoluteErrorPct:5.35};
ctx.document=measured;vm.runInContext('unityOwnModelJournal=document',ctx);
assert.match(vm.runInContext('unityOwnModelForecastPanel(stock)',ctx),/Modellfehler/);
assert.match(vm.runInContext('unityOwnModelOverview()',ctx),/noch keine verifizierte Prognoseleistung/i);
ctx.stock={isin:'US0000000001',ticker:'ETN'};
assert.equal(vm.runInContext('unityOwnModelForecastPanel(stock)',ctx),'','Wrong ISIN must not inherit Eaton forecasts');
ctx.stock={isin:etn.isin,ticker:'NOTETN'};
assert.equal(vm.runInContext('unityOwnModelForecastPanel(stock)',ctx),'','Wrong ticker must not inherit identity');
const html=fs.readFileSync('index.html','utf8'),sw=fs.readFileSync('sw.js','utf8');
assert.match(html,/own-model\.js\?v=0\.16\.4/);
assert.match(sw,/data\/unity-model-forecasts\.json/);
assert.match(sw,/unity-lab-v0\.16\.4/);
console.log('UNITY independent forecast lab: source identity, immutable research panel, comparison, unknown skill and no-trade passed.');
