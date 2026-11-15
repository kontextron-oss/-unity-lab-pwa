'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const stock={id:'review-1',isin:'DE0000000001'};
const item={points:[
  {date:'2026-01-02',close:100},{date:'2026-01-03',close:101},{date:'2026-01-04',close:102},
  {date:'2026-01-05',close:103},{date:'2026-01-06',close:104},{date:'2026-01-07',close:105},
  {date:'2026-01-08',close:106},{date:'2026-01-09',close:107},{date:'2026-01-10',close:108}
]};
const box={Number,String,Math,Array,Object,unityMarketForStock:()=>item,esc:x=>String(x??'')};
vm.createContext(box);vm.runInContext(fs.readFileSync('decision-review.js','utf8'),box);
const record={mode:'strict',sourceAt:'2026-01-01',decisionSnapshot:{priceRef:{price:100,currency:'EUR',date:'2026-01-01'},reviewPlan:[{sessions:5,label:'5 Handelstage'},{sessions:20,label:'20 Handelstage'},{sessions:60,label:'60 Handelstage'}]}};
box.record=record;box.stock=stock;
const result=vm.runInContext('unityDecisionReview(record,stock)',box);
assert.equal(result.checkpoints[0].state,'completed');
assert.equal(result.checkpoints[0].point.close,104);
assert.ok(Math.abs(result.checkpoints[0].change-4)<1e-9);
assert.equal(result.checkpoints[1].state,'pending');
assert.equal(record.decisionSnapshot.reviewPlan.length,3,'Review must not change the immutable snapshot');
assert.match(vm.runInContext('unityDecisionReviewPanel(stock,[record])',box),/Lernkontrolle · 5 \/ 20 \/ 60 Handelstage/);
assert.match(vm.runInContext('unityDecisionReviewPanel(stock,[record])',box),/\+4\.0 %/);
console.log('UNITY decision review: 5/20/60-session checkpoints, pending state and immutable snapshots passed.');
