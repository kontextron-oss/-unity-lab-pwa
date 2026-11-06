'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {webcrypto,createHash}=require('node:crypto');
const source=fs.readFileSync('pcloud-direct.js','utf8');
const html=fs.readFileSync('index.html','utf8'),sw=fs.readFileSync('sw.js','utf8');
const staticBox={URL,location:{origin:'https://kontextron-oss.github.io'},document:{getElementById:()=>null}};
vm.createContext(staticBox);vm.runInContext(source,staticBox);
assert.equal(vm.runInContext('unityCloudIsConfigured()',staticBox),false);
assert.match(vm.runInContext('unityCloudStatusHtml()',staticBox),/technische Verbindung noch nicht aktiv/);
assert.doesNotMatch(vm.runInContext('unityCloudStatusHtml()',staticBox),/id="cloud-direct-upload"/);
assert.match(source,/UNITY_PCLOUD_GATEWAY = ''/);
assert.doesNotMatch(source,/access_token=|client_secret|localStorage\.setItem/);
const enabled=source.replace("UNITY_PCLOUD_GATEWAY = ''","UNITY_PCLOUD_GATEWAY = '/api/pcloud'");
let now=0,requests=[],writes=[],status='',rendered='',connectedResponse={connected:true,csrfToken:'a'.repeat(48)};
const payload={format:'unity-lab-incremental',schema:1,backupId:'b123',snapshotHash:'5'.repeat(64)};
const file=new File([JSON.stringify(payload)],'UNITY-LAB-AENDERUNGEN-2026-11-03-BASIS.json',{type:'application/json'});
const prepared={file,snapshot:payload,checkpoint:{id:'unity-lab-incremental-checkpoint-v1',lastBackupId:'b123',snapshotHash:'5'.repeat(64)}};
let validResponse=true,changedDuring=false,noChanges=false;
const receipt={storage:'pcloud',verified:true,backupId:'b123',snapshotHash:'5'.repeat(64),
 fileName:file.name,byteSize:file.size,sha256:createHash('sha256').update(JSON.stringify(payload)).digest('hex'),fileId:1234};
class FakeFormData{constructor(){this.map=new Map()}append(k,v){this.map.set(k,v)}}
const box={URL,Date,Math,Number,String,Array,JSON,File,FormData:FakeFormData,crypto:webcrypto,Uint8Array,
 location:{origin:'https://kontextron-oss.github.io',assign:u=>{box.location.next=u}},
 fetch:async(url,opts)=>{
   requests.push({url,opts});
   if(url.endsWith('/connection'))return {ok:true,json:async()=>connectedResponse};
   if(url.endsWith('/backups/incremental')){
     assert.equal(opts.method,'POST');assert.equal(opts.credentials,'include');
     assert.equal(opts.headers['X-UNITY-CSRF'],connectedResponse.csrfToken);
     assert.equal(opts.body.map.get('file').name,file.name);
     assert.equal(opts.body.map.get('backupId'),'b123');
     return {ok:true,json:async()=>validResponse?receipt:{...receipt,byteSize:file.size+1}};
   }
   throw Error('Unexpected destination '+url);
 },
 esc:x=>String(x),console,
 unityIncPending:null,
 unityIncPrepare:async()=>noChanges?null:prepared,
 unityIncLocalSnapshot:async()=>({snapshotHash:changedDuring?'0'.repeat(64):payload.snapshotHash}),
 unityBackupStatus:s=>{status=s},
 put:async(n,obj)=>{writes.push({n,obj})},
 refresh:async()=>{rendered++},
 document:{getElementById:()=>null}
};
vm.createContext(box);vm.runInContext(enabled,box);
const run=x=>vm.runInContext(x,box);
(async()=>{
 assert.equal(run('unityCloudIsConfigured()'),true);
 assert.equal(run("unityCloudEndpoint('/backups/incremental')"),'https://kontextron-oss.github.io/api/pcloud/backups/incremental');
 await run('unityCloudCheck()');
 assert.equal(run('unityCloudConnected'),true);
 assert.match(run('unityCloudStatusHtml()'),/Jetzt direkt in pCloud sichern/);
 await run('unityCloudUpload()');
 assert.equal(writes.length,1);assert.equal(writes[0].n,'settings');
 assert.equal(writes[0].obj.snapshotHash,payload.snapshotHash);
 assert.match(status,/pCloud bestätigt/);
 validResponse=false;
 await assert.rejects(run('unityCloudUpload()'),/nicht vollständig verifiziert/);
 assert.equal(writes.length,1);
 validResponse=true;changedDuring=true;
 await assert.rejects(run('unityCloudUpload()'),/lokale Daten verändert/);
 assert.equal(writes.length,1);
 changedDuring=false;noChanges=true;
 await run('unityCloudUpload()');
 assert.match(status,/Keine neuen Änderungen/);
 assert.equal(writes.length,1);
 connectedResponse={connected:true,csrfToken:'bad'};
 assert.equal(await run('unityCloudCheck()'),false);
 await assert.rejects(run('unityCloudUpload()'),/autorisieren/);
 assert.equal(writes.length,1);
 assert.match(html,/pcloud-direct\.js\?v=0\.13\.\d+/);
 assert.match(html,/id="unity-cloud-auto-status"/);
 assert.match(html,/cloud-direct-upload/);
 assert.match(sw,/pcloud-direct\.js\?v=0\.13\.\d+/);
 assert.match(sw,/unity-lab-v0\.(13|14)\.\d+/);
 assert.ok(requests.some(x=>x.url.endsWith('/backups/incremental')));
 console.log('Direct pCloud client: disabled without gateway, authenticated same-origin upload, remote receipt, CSRF, no silent cursor advancement and Safari frontend wiring passed.');
})().catch(e=>{console.error(e);process.exitCode=1});
