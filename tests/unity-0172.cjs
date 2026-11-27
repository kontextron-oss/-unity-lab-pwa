'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const sandbox={
  Date,Number,String,Math,Array,Object,Map,Set,
  unityMarketForStock:()=>({points:Array.from({length:65},(_,i)=>({
    date:new Date(Date.UTC(2026,0,i+2)).toISOString().slice(0,10),close:100+i
  }))}),esc:x=>String(x??'')
};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('readiness-audit.js','utf8'),sandbox);
vm.runInContext(fs.readFileSync('decision-review.js','utf8'),sandbox);
const mk=(name,keys,adverse=[],technicalReady=true)=>({
  s:{name},technicalReady,adverse,
  missing:keys.map(key=>({key,label:key}))
});
sandbox.rows=[
  mk('ABB',['earnings','filing','valuation']),
  mk('Schneider',['earnings','filing']),
  mk('Negative Aktie',['earnings'],['belegtes negatives Signal']),
  mk('Ohne Kursreihe',['filing'],[],false)
];
const gaps=vm.runInContext('unityPrioritySourceGaps(rows,3)',sandbox);
assert.equal(gaps.length,3);
assert.equal(gaps[0].key,'earnings');
assert.equal(gaps[0].count,2);
assert.equal(gaps[1].key,'filing');
assert.equal(gaps[1].count,2);
assert.equal(gaps[2].key,'valuation');
const bad={mode:'strict',createdAt:'2026-02-01',decisionSnapshot:{
  priceRef:{price:null,date:'2026-01-01'},reviewPlan:[{sessions:5}]
}};
sandbox.bad=bad;
assert.equal(vm.runInContext('unityDecisionReview(bad,{})',sandbox).available,false);
assert.equal(vm.runInContext('unityDecisionReview(bad,{})',sandbox).checkpoints[0].state,'pending');
sandbox.good={mode:'strict',createdAt:'2026-01-01',decisionSnapshot:{
  priceRef:{price:100,date:'2026-01-01T15:00:00Z'},
  reviewPlan:[{sessions:5},{sessions:20},{sessions:60}]
}};
const good=vm.runInContext('unityDecisionReview(good,{})',sandbox);
assert.equal(good.available,true);
assert.equal(good.checkpoints[0].point.close,104);
assert.equal(Math.round(good.checkpoints[0].change),4);
assert.equal(good.checkpoints[2].state,'completed');
sandbox.recs=[sandbox.good,sandbox.bad];
const panel=vm.runInContext('unityDecisionReviewPanel({},recs)',sandbox);
assert.match(panel,/vollständige Kursreferenz/,'Most recent decision must win even when incomplete');
assert.equal(sandbox.good.decisionSnapshot.priceRef.price,100);
assert.equal(sandbox.bad.decisionSnapshot.priceRef.price,null);
const html=fs.readFileSync('index.html','utf8');
const worker=fs.readFileSync('sw.js','utf8');
assert.match(html,/Unity Lab 0\.18\.0/);
assert.match(worker,/unity-lab-v0\.18\.0/);
for(const asset of ['readiness-audit.js?v=0.17.2-gaps-20261115','decision-review.js?v=0.17.2-gaps-20261115']){
  assert.ok(html.includes(asset),'HTML missing '+asset);
  assert.ok(worker.includes(asset),'Offline precache missing '+asset);
}
console.log('UNITY 0.17.2 priority, safety, learning and cache tests passed.');
