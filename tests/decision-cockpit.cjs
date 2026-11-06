'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('decision-cockpit.js','utf8');
const html=fs.readFileSync('index.html','utf8');
const sw=fs.readFileSync('sw.js','utf8');
const stocks=[
 {id:'a',name:'Alpha Grid',ticker:'ALPG',isin:'DE0001111111',currency:'EUR',providerSymbol:'ALPG.DE'},
 {id:'b',name:'Beta Cooling',ticker:'BTAC',isin:'US2222222222',currency:'USD',providerSymbol:'BTAC'},
 {id:'c',name:'Missing Stock',ticker:'MISS',isin:'US3333333333',currency:'USD',providerSymbol:'MISS'}
];
function points(){
 return Array.from({length:260},(_,i)=>({date:new Date(Date.UTC(2025,0,1+i)).toISOString().slice(0,10),
   close:100+0.045*i+Math.sin(i/3.5)*.65}));
}
const p=points(),quote={date:p.at(-1).date,price:p.at(-1).close,points:p,currency:'EUR'};
const box={Date,Math,Number,String,Array,JSON,Map,Intl,stocks:()=>stocks,
 cache:{fundamentals:[]},esc:x=>String(x).replaceAll('<','&lt;'),
 unityMarketForStock:s=>s.id==='a'?quote:null,
 unityDataQuality:()=>({canCompare:true}),
 unityDeepFilingEvidence:()=>({verified:false}),
 unityResearchRecent:()=>null
};
vm.createContext(box);vm.runInContext(source,box);
const run=(expr)=>vm.runInContext(expr,box);
const core={
 market:{
  date:'2026-11-03',last:110,r5:3,r21:6,r63:13,r252:29,
  trend:true,inZone:true,rsi:56,extension:1.5,vol20:22,
  overheat:false,overheated:false,stressed:false,mood:'Positive Preisreaktion',
  volumeOk:false,volumeRatio:NaN
 },marketOk:true,fundamentalOk:false,f:null,official:null
};
(async()=>{
 box.input=core;
 let decision=run('unityCockpitClassify(input)');
 assert.equal(decision.kind,'data');
 assert.equal(decision.priority,100);
 assert.equal(decision.gates.flows,false);
 assert.equal(decision.socialSentimentMeasured,false);
 assert.equal(decision.institutionalFlowsMeasured,false);
 assert.match(decision.action,/technischer Radar/);
 assert.match(decision.short,/Kein gemessenes Medien/);
 assert.ok(decision.missing.some(x=>x.includes('Earnings')));
 assert.ok(decision.missing.some(x=>x.includes('Institutionelle')));
 // An irrelevant official filing cannot itself be positive investment evidence.
 box.input={...core,official:{filedAt:'2026-11-03',form:'8-K',label:'Meldung'}};
 decision=run('unityCockpitClassify(input)');
 assert.equal(decision.kind,'data');
 assert.ok(decision.evidence.some(x=>x.includes('amtliche Unternehmensmeldung')));
 // Positive technical data cannot override earnings within 7 days.
 box.input={...core,f:{earningsConfirmed:true,earningsDate:new Date(Date.now()+2*86400000).toISOString()}};
 assert.equal(run('unityCockpitClassify(input)').kind,'blocked');
 // RR below 2 is a hard veto, never a high-scoring favorite.
 box.input={...core,f:{stop:108,target:111}};
 assert.equal(run('unityCockpitClassify(input)').kind,'blocked');
 // Overheating and selling pressure are independent psych/risk warnings.
 box.input={...core,market:{...core.market,overheated:true}};
 assert.equal(run('unityCockpitClassify(input)').kind,'blocked');
 box.input={...core,market:{...core.market,stressed:true}};
 assert.equal(run('unityCockpitClassify(input)').kind,'blocked');
 box.input={...core,market:{...core.market,trend:false}};
 assert.equal(run('unityCockpitClassify(input)').kind,'wait');
 box.input={...core,market:{...core.market,inZone:false}};
 assert.equal(run('unityCockpitClassify(input)').kind,'watch');
 box.input={...core,market:null,marketOk:false};
 decision=run('unityCockpitClassify(input)');
 assert.equal(decision.kind,'data');
 assert.ok(Number.isNaN(decision.priority));
 assert.equal(decision.gates.market,false);
 // A verified, fully gated deep evaluation may designate a test favorite.
 box.unityDeepDecision=()=>({investmentReady:true,valuationReady:true});
 box.input={...core,fundamentalOk:true,stock:stocks[0],f:{
  earningsConfirmed:true,earningsDate:new Date(Date.now()+30*86400000).toISOString()
 }};
 assert.equal(run('unityCockpitClassify(input)').kind,'investment');
 delete box.unityDeepDecision;
 // Raw close-only history must not claim observed trading volume / social media mood.
 box.item=quote;
 const stats=run('unityCockpitMarket(item)');
 assert.ok(stats&&Number.isFinite(stats.rsi));
 assert.equal(stats.volumeOk,false);
 assert.ok(Number.isNaN(stats.volumeRatio));
 const list=run('unityCockpitSorted()');
 assert.equal(list.length,3); // entire active master list, even missing quotes
 assert.equal(list.find(x=>x.stock.id==='c').kind,'data');
 const overview=run('unityCockpitOverview()');
 assert.match(overview,/Alle 3 Aktien/);
 assert.match(overview,/data-analyze/);
 assert.match(overview,/Alpha Grid/);
 assert.match(overview,/Missing Stock/);
 const panel=run('unityCockpitPanel(stocks()[0])');
 assert.match(panel,/Entscheidungsmoderator/);
 assert.match(panel,/Soziale Medien/);
 assert.match(panel,/nicht unabhängig gemessen/);
 assert.doesNotMatch(panel,/Aktie kaufen!/);
 assert.match(html,/decision-cockpit\.js\?v=0\.13\.\d+/);
 assert.match(sw,/decision-cockpit\.js\?v=0\.13\.\d+/);
 assert.match(sw,/unity-lab-v0\.(13|14|15)\.\d+/);
 assert.match(fs.readFileSync('analysis.js','utf8'),/unityCockpitPanel\(s\)/);
 assert.match(fs.readFileSync('capital-radar.js','utf8'),/unityCockpitOverview\(\)/);
 console.log('UNITY decision cockpit: all stocks, 3 horizons, psychology-proxy disclaimer, earnings/RR/overheating veto, no false capital-flow evidence passed.');
})().catch(e=>{console.error(e);process.exitCode=1});
