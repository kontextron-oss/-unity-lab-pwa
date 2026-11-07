'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),nodeCrypto=require('node:crypto');
const html=fs.readFileSync('index.html','utf8');
const sw=fs.readFileSync('sw.js','utf8');
const files=['sync-plan','sync-transfer','sync-crypto','sync-ui'];
const stores=['instruments','quotes','transactions','strategies','audit',
 'fundamentals','histories','analyses','settings'];
for(const name of files){
 assert.match(html,new RegExp(name+'\\.js\\?v=0\\.17\\.0-rc1'));
 assert.match(sw,new RegExp(name+'\\.js\\?v=0\\.17\\.0-rc1'));
}
assert.match(html,/unity-sync-manual-panel/);
assert.match(html,/unity-sync-import-new/);
assert.match(html,/unity-sync-share/);
assert.match(html,/unity-sync-confirm/);
assert.match(html,/unitySyncImportNew\(\)/);
assert.match(html,/indexedDB\.open\('unity-lab',3\)/);
const clone=x=>JSON.parse(JSON.stringify(x));
function fresh(){
 return Object.fromEntries(stores.map(s=>[s,[]]));
}
let data=fresh();
data.instruments.push({id:'abb',name:'ABB',ticker:'ABBN',isin:'CH0012221716',
 exchange:'SIX',currency:'CHF',createdAt:'2026-01-01T00:00:00.000Z'});
data.analyses.push({id:'analysis-abb',instrumentId:'abb',note:'Beobachten'});
const elements={};
for(const id of ['unity-sync-password','unity-sync-status','unity-sync-share',
 'unity-sync-confirm','unity-sync-file','unity-sync-review','unity-sync-import-new'])
 elements[id]={value:'',hidden:true,files:[],innerHTML:'',textContent:''};
const uploads=[],confirms=[],added=[],writes=[];
let refreshes=0;
const File=globalThis.File||require('node:buffer').File;
const ctx={
 Date,Math,Number,String,Array,Object,Map,Set,Buffer,Promise,TextEncoder,TextDecoder,
 Uint8Array,JSON,File,crypto:nodeCrypto.webcrypto,STORES:stores,
 cache:{settings:[]},
 document:{getElementById:id=>elements[id]||null},
 navigator:{
  share:async x=>{uploads.push(x);return undefined},
  canShare:()=>true
 },
 confirm:msg=>{confirms.push(msg);return true},
 all:async n=>clone(data[n]),
 put:async(n,obj)=>{writes.push([n,obj]);data[n]=data[n].filter(x=>x.id!==obj.id);data[n].push(clone(obj))},
 bulkInsert:async x=>{
  const copied=clone(data);
  for(const n of stores)for(const entry of x[n]||[]){
   if(copied[n].some(v=>v.id===entry.id))throw Error('Duplicate ID');
   copied[n].push(clone(entry));added.push({n,id:entry.id});
  }
  data=copied;
 },
 refresh:async()=>{refreshes++;ctx.cache={settings:clone(data.settings)}},
 esc:x=>String(x).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'),
 unityDownloadBackup:f=>uploads.push({files:[f],download:true}),
 console
};
vm.createContext(ctx);
for(const file of files)vm.runInContext(fs.readFileSync(file+'.js','utf8'),ctx);
const run=code=>vm.runInContext(code,ctx);
(async()=>{
 ctx.cache={settings:clone(data.settings)};
 elements['unity-sync-password'].value='Ein-sehr-langes-unabhaengiges-Austauschpasswort';
 await run('unitySyncPrepare()');
 assert.equal(elements['unity-sync-password'].value,'','password cleared');
 assert.equal(elements['unity-sync-share'].hidden,false);
 assert.match(elements['unity-sync-status'].textContent,/verschlüsselt vorbereitet/);
 assert.equal(uploads.length,0,'must not automatically share');
 await run('unitySyncShare()');
 assert.equal(uploads.length,1);
 assert.equal(elements['unity-sync-confirm'].hidden,false);
 assert.equal(writes.length,0,'do not mark pCloud saved until explicit confirmation');
 await run('unitySyncConfirm()');
 assert.equal(writes.length,1);
 assert.equal(writes[0][0],'settings');
 assert.equal(writes[0][1].id,'unity-sync-export-v1');
 assert.equal(writes[0][1].revision,1);
 assert.equal(refreshes,1);
 const encrypted=uploads[0].files[0];
 const wrapped=JSON.parse(await encrypted.text());
 assert.equal(wrapped.format,'unity-sync-delta-encrypted');
 assert.ok(!JSON.stringify(wrapped).includes('Beobachten'));
 const savedFirst=clone(data);
 const stock=clone(data.instruments[0]);
 const analysis=clone(data.analyses[0]);
 data.analyses[0].note='Aktualisierte Analyse';
 ctx.cache.settings=clone(data.settings);
 elements['unity-sync-password'].value='Ein-sehr-langes-unabhaengiges-Austauschpasswort';
 await run('unitySyncPrepare()');
 assert.match(elements['unity-sync-status'].textContent,/1 neue oder veränderte/);
 await run('unitySyncShare()');
 assert.equal(uploads.length,2);
 await run('unitySyncConfirm()');
 assert.equal(writes[1][1].revision,2);
 assert.equal(refreshes,2);
 // Import first encrypted delta on a separate fresh installation, no checkpoint.
 data=fresh();ctx.cache={settings:[]};
 elements['unity-sync-file'].files=[encrypted];
 elements['unity-sync-password'].value='Ein-sehr-langes-unabhaengiges-Austauschpasswort';
 await run('unitySyncInspect()');
 assert.match(elements['unity-sync-review'].innerHTML,/Nur im Import/);
 assert.equal(elements['unity-sync-import-new'].hidden,false);
 assert.equal(data.instruments.length,0,'review cannot insert anything');
 assert.equal(data.analyses.length,0,'review cannot insert anything');
 assert.equal(writes.length,2,'review cannot update checkpoint');
 await run('unitySyncImportNew()');
 assert.equal(data.instruments.length,1);
 assert.equal(data.analyses.length,1);
 assert.equal(data.transactions.length,0);
 assert.equal(data.settings.length,0);
 assert.equal(added.length,2);
 assert.equal(refreshes,3);
 assert.match(confirms.at(-1),/keine Aufträge ausgeführt/);
 // When content differs, importer must not overwrite the local record.
 data=fresh();data.instruments.push({...stock,name:'ABB lokal geändert'});
 ctx.cache={settings:[]};
 elements['unity-sync-file'].files=[encrypted];
 elements['unity-sync-password'].value='Ein-sehr-langes-unabhaengiges-Austauschpasswort';
 await run('unitySyncInspect()');
 assert.match(elements['unity-sync-review'].innerHTML,/Konflikt/);
 assert.equal(data.instruments[0].name,'ABB lokal geändert');
 await run('unitySyncImportNew()');
 assert.equal(data.instruments[0].name,'ABB lokal geändert');
 assert.equal(data.analyses.length,1,'only genuinely new analysis may be added');
 // Local data changed since review -> no import allowed.
 data=fresh();ctx.cache={settings:[]};
 elements['unity-sync-file'].files=[encrypted];
 elements['unity-sync-password'].value='Ein-sehr-langes-unabhaengiges-Austauschpasswort';
 await run('unitySyncInspect()');
 data.instruments.push({...stock,name:'changed after review'});
 await assert.rejects(run('unitySyncImportNew()'),/nach der Vorschau verändert/);
 assert.equal(data.analyses.length,0);
 // Invalid password rejects preview and leaves all data unchanged.
 elements['unity-sync-password'].value='incorrect-long-pass';
 await assert.rejects(run('unitySyncInspect()'),/Passwort falsch/);
 assert.equal(data.analyses.length,0);
 assert.equal(data.instruments.length,1);
 assert.ok(!fs.readFileSync('sync-ui.js','utf8').includes('pCloud.com'));
 assert.match(fs.readFileSync('pcloud-direct.js','utf8'),/UNITY_PCLOUD_GATEWAY = ''/);
 console.log('UNITY RC1 encrypted manual pCloud UI: share confirmation, changed-only follow-up, import preview, explicit insert-only transaction, no overwrite and stale-review veto passed.');
})().catch(e=>{console.error(e);process.exitCode=1});
