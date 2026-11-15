'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const selected=[
 {id:'a',name:'ABB',isin:'A',currency:'EUR'},
 {id:'s',name:'Schneider',isin:'S',currency:'EUR'},
 {id:'n',name:'Nicht technisch',isin:'N',currency:'EUR'}
];
const ready={
 a:{technicalReady:true,adverse:[],missing:[{key:'filing',label:'Geprüfte Unternehmenszahlen'},{key:'valuation',label:'Bewertungsgrundlage'}]},
 s:{technicalReady:true,adverse:[],missing:[{key:'filing',label:'Geprüfte Unternehmenszahlen'},{key:'earnings',label:'Ergebnis-Termin'}]},
 n:{technicalReady:false,adverse:[],missing:[{key:'risks',label:'Risiken und Widerlegung'}]}
};
const box={Object,Array,String,Number,Math,esc:x=>String(x??''),unityIsCryptoAsset:()=>false};
vm.createContext(box);vm.runInContext(fs.readFileSync('readiness-audit.js','utf8'),box);
box.unityReadinessEvidence=s=>({s,...ready[s.id]});
box.selected=selected;
const priorities=vm.runInContext('unityReadinessPriorities(selected)',box);
assert.equal(priorities.length,3);
assert.equal(priorities[0].key,'filing','Common issuer evidence must outrank isolated documentation gaps');
assert.equal(priorities[0].affected,2);
assert.deepEqual(Array.from(priorities[0].names),['ABB','Schneider']);
assert.equal(priorities.some(x=>x.key==='risks'),false,'Non-candidates must not distort current data work');
assert.match(vm.runInContext('unityReadinessPriorityPanel(selected)',box),/Nächste drei Datenlücken/);
assert.match(vm.runInContext('unityReadinessPriorityPanel(selected)',box),/ABB · Schneider/);
console.log('UNITY readiness priority: candidate-only, source-first, top-three gaps passed.');
