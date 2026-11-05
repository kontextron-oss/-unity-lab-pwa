'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const active={id:'a',name:'Aktivwert'},watch={id:'w',name:'Beobachtung'},archived={id:'r',name:'Archivwert',watchArchivedAt:'2026-10-01T00:00:00Z'};
const sandbox={
  stockRecords:()=>[active,watch,archived],stocks:()=>[active,watch],
  depotPosition:s=>({qty:s.id==='a'?2:0}),esc:v=>String(v??'')
};
vm.createContext(sandbox);vm.runInContext(fs.readFileSync('research-lifecycle.js','utf8'),sandbox);
assert.equal(vm.runInContext('unityResearchLifecycle({id:"a"}).key',sandbox),'active');
assert.equal(vm.runInContext('unityResearchLifecycle({id:"w"}).key',sandbox),'watch');
assert.equal(vm.runInContext('unityResearchLifecycle({id:"r",watchArchivedAt:"2026-10-01T00:00:00Z"}).key',sandbox),'archive');
assert.deepEqual([...vm.runInContext('unityResearchRefreshTargets("background").map(s=>s.id)',sandbox)],['a']);
assert.deepEqual([...vm.runInContext('unityResearchRefreshTargets("manual").map(s=>s.id)',sandbox)],['a','w']);
const panel=vm.runInContext('unityResearchLifecyclePanel()',sandbox);
assert.match(panel,/1 aktiv · 1 Beobachtung · 1 Archiv/);
assert.match(panel,/Archivieren löscht nichts/);
console.log('Research lifecycle: active priority, watch refresh, archive retention passed.');
