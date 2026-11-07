'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const api=require('../sync-plan.js');
const sha=async text=>crypto.createHash('sha256').update(text,'utf8').digest('hex');
const STORES=['instruments','quotes','transactions','strategies','audit',
 'fundamentals','histories','analyses','settings'];
const d1='e2012345-ffff-44aa-8bcd-123456789abc',d2='f2012345-ffff-44aa-8bcd-123456789abc';
const day='2026-11-07T10:00:00.000Z';
function fresh(){return Object.fromEntries(STORES.map(n=>[n,[]]))}
function withStock(id='abb',name='ABB'){const a=fresh();a.instruments.push({id,name,isin:'CH0012221716'});return a}
async function sealed(deviceId,records,sequence=1,parentHash=null){
 return api.create({deviceId,records,sequence,createdAt:day,parentHash},sha)
}
const cloned=x=>JSON.parse(JSON.stringify(x));
async function bad(packet,needle){
 await assert.rejects(api.verify(packet,sha),needle)
}
(async()=>{
 assert.equal(api.FORMAT,'unity-sync-manifest');
 assert.equal(api.SCHEMA,1);
 assert.deepEqual([...api.STORES],STORES);
 assert.equal(api.canonical({b:2,a:1}),api.canonical({a:1,b:2}));
 assert.throws(()=>api.canonical({unexpected:undefined}),/Nicht-JSON-Daten/);
 assert.throws(()=>api.canonical({a:Infinity}),/Nicht-JSON-Daten/);
 const cyclic={x:1};cyclic.self=cyclic;
 assert.throws(()=>api.canonical(cyclic),/Zyklische Datenstruktur/);
 const localRecords=withStock();
 localRecords.analyses.push({id:'plan:abb',decision:'BEOBACHTEN',version:1});
 localRecords.transactions.push({id:'hyp-buy-1',source:'synthetic',side:'BUY',amountEur:200});
 localRecords.settings.push({id:'unity-lab-incremental-checkpoint-v1',token:'LOCAL ONLY'},
  {id:'unity-exchange-export-meta-v1',secret:'LOCAL ONLY'},
  {id:'visual-preferences',theme:'dark'});
 const a=await sealed(d1,localRecords);
 const av=await api.verify(a,sha);
 assert.equal(av.valid,true);
 assert.equal(av.recordCount,4);
 assert.equal(av.executionPermission,false);
 assert.equal(av.containsRecordContent,false);
 assert.equal(a.stores.settings['unity-lab-incremental-checkpoint-v1'],undefined);
 assert.equal(a.stores.settings['unity-exchange-export-meta-v1'],undefined);
 assert.ok(a.stores.settings['visual-preferences']);
 assert.ok(/^[a-f0-9]{64}$/.test(a.sha256));
 assert.ok(!JSON.stringify(a).includes('CH0012221716'),'manifest must not leak record content');
 assert.ok(!JSON.stringify(a).includes('synthetic'),'manifest must not leak paper-order contents');
 assert.ok(!JSON.stringify(a).includes('LOCAL ONLY'));
 const a2=await sealed(d1,cloned(localRecords));
 assert.equal(a.sha256,a2.sha256,'deterministic content hashes');
 assert.equal(a.stores.instruments.abb,a2.stores.instruments.abb);
 const b=await sealed(d2,cloned(localRecords));
 const clean=await api.plan(a,b,sha);
 assert.equal(clean.actions.length,0);
 assert.equal(clean.counts.same,4);
 assert.equal(clean.conflictCount,0);
 assert.equal(clean.eligibleForAutomaticMerge,false);
 assert.equal(clean.canWrite,false);
 assert.equal(clean.canDelete,false);
 assert.equal(clean.tradeApproved,false);
 assert.equal(clean.executionPermission,false);
 const remoteRec=cloned(localRecords);
 remoteRec.instruments.push({id:'amd',name:'AMD',isin:'US0079031078'});
 const incoming=await sealed(d2,remoteRec);
 const additions=await api.plan(a,incoming,sha);
 assert.equal(additions.counts.remoteOnly,1);
 assert.equal(additions.actions[0].id,'amd');
 assert.equal(additions.actions[0].requiresApproval,true);
 assert.equal(additions.actions[0].automaticOverwrite,false);
 assert.equal(additions.actions[0].automaticDelete,false);
 assert.equal(additions.actions[0].automaticOrderExecution,false);
 const localAdded=await api.plan(incoming,a,sha);
 assert.equal(localAdded.counts.localOnly,1);
 const changed=cloned(remoteRec);changed.instruments[0].name='ABB new';
 const incoming2=await sealed(d2,changed);
 const diff=await api.plan(a,incoming2,sha);
 assert.equal(diff.counts.conflict,1);
 assert.equal(diff.counts.remoteOnly,1);
 assert.equal(diff.conflictCount,1);
 assert.equal(diff.actions.find(x=>x.id==='abb').decision,'conflict');
 assert.ok(diff.actions.every(x=>x.requiresApproval&&x.automaticDelete===false));
 // Three-way merge classification: changes are informative, still no write.
 const base=await sealed(d2,localRecords);
 const onlyLocal=cloned(localRecords);onlyLocal.instruments[0].name='ABB SE';
 const onlyRemote=cloned(localRecords);onlyRemote.analyses[0].decision='REDUZIEREN';
 const la=await sealed(d1,onlyLocal),ra=await sealed(d2,onlyRemote);
 const plan=await api.plan(la,ra,sha,base);
 assert.equal(plan.counts.localChanged,1);
 assert.equal(plan.counts.remoteChanged,1);
 assert.equal(plan.counts.same,2);
 assert.equal(plan.canWrite,false);
 assert.equal(plan.baseHash,base.sha256);
 const conflictRemote=cloned(onlyRemote);conflictRemote.instruments[0].name='ABBY';
 const conflict=await api.plan(la,await sealed(d2,conflictRemote),sha,base);
 assert.equal(conflict.counts.conflict,1);
 // A disappearance is never interpreted as permission to delete.
 const vanished=cloned(localRecords);vanished.instruments=[];
 const deletion=await api.plan(await sealed(d1,vanished),await sealed(d2,localRecords),sha,base);
 assert.equal(deletion.counts.deleteReview,1);
 assert.equal(deletion.actions.find(x=>x.id==='abb').automaticDelete,false);
 assert.equal(deletion.canDelete,false);
 // A same-device revision must explicitly descend from the previous version.
 const next=await sealed(d1,localRecords,2,a.sha256);
 const seq=await api.plan(a,next,sha);
 assert.equal(seq.actions.length,0);
 const sameRevisionDifferent=cloned(localRecords);sameRevisionDifferent.instruments[0].name='ABB (modified)';
 await assert.rejects(api.plan(a,await sealed(d1,sameRevisionDifferent,1),sha),/Gleiche Geräteversion/);
 const fork=await sealed(d1,localRecords,4,'f'.repeat(64));
 await assert.rejects(api.plan(a,fork,sha),/Divergierende Revisionen/);
 const duplicate=cloned(localRecords);duplicate.instruments.push(cloned(duplicate.instruments[0]));
 await assert.rejects(sealed(d1,duplicate),/Doppelte lokale Datensatz-ID/);
 const missing=cloned(localRecords);delete missing.analyses;
 await assert.rejects(sealed(d1,missing),/neun bekannten Datenbereiche/);
 const poison=cloned(localRecords);poison.instruments.push({id:'__proto__',name:'X'});
 await assert.rejects(sealed(d1,poison),/stabile ID/);
 const badValue=cloned(localRecords);badValue.analyses[0].data=new Date();
 await assert.rejects(sealed(d1,badValue),/Objekttyp unzulässig/);
 const invalid=cloned(a);invalid.complete=false;await bad(invalid,/Teillisten/);
 const executable=cloned(a);executable.executionPermission=true;await bad(executable,/Börsenaufträgen/);
 const unsigned=cloned(a);unsigned.sha256='f'.repeat(64);await bad(unsigned,/Prüfsumme fehlerhaft/);
 const injected=cloned(a);injected.password='LEAK';await bad(injected,/Unbekannte/);
 const tampered=cloned(a);tampered.stores.instruments.abb='e'.repeat(64);
 await bad(tampered,/Prüfsumme fehlerhaft/);
 const trunc=cloned(a);trunc.stores.instruments.abb='z'.repeat(64);
 await bad(trunc,/Ungültiger SHA-256/);
 const wrongDate=cloned(a);wrongDate.createdAt='2026-02-30T10:00:00.000Z';
 await bad(wrongDate,/Zeitstempel/);
 const notUuid=cloned(a);notUuid.deviceId='iphone1';await bad(notUuid,/Geräteidentität/);
 const rollback=cloned(a);rollback.sequence=0;await bad(rollback,/Revision/);
 await assert.rejects(sealed(d1,localRecords,1,null).then(x=>api.plan(x,{},sha)),/Manifestfelder/);
 const idx=fs.readFileSync('index.html','utf8');
 const inc=fs.readFileSync('incremental.js','utf8');
 const gate=fs.readFileSync('pcloud-direct.js','utf8');
 assert.match(idx,/indexedDB\.open\('unity-lab',3\)/);
 assert.match(inc,/UNITY_INC_FORMAT='unity-lab-incremental'/);
 assert.match(gate,/UNITY_PCLOUD_GATEWAY = ''/);
 const code=fs.readFileSync('sync-plan.js','utf8');
 for(const disallowed of ['fetch(','indexedDB.','localStorage.','caches.','XMLHttpRequest','navigator.sendBeacon','globalThis.fetch','document.cookie'])
  assert.ok(!code.includes(disallowed),'pure read-only sync helper must not write or network: '+disallowed);
 const page={};vm.runInNewContext(code,{globalThis:page,TextEncoder,Date,Map,Set,Buffer,Promise});
 assert.equal(page.UNITY_SYNC_PLAN.FORMAT,api.FORMAT);
 assert.equal(typeof page.UNITY_SYNC_PLAN.plan,'function');
 console.log('UNITY sync v1: same, additions, conflicts, three-way changes, explicit deletion veto, tamper, unknown schema, no order/writes/cloud sync checks passed.');
})().catch(e=>{console.error(e);process.exitCode=1});
