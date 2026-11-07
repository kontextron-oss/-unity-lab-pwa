'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const log=require('../sync-pcloud-log.js');
const sha=async s=>crypto.createHash('sha256').update(s,'utf8').digest('hex');
const deviceId='e2012345-ffff-44aa-8bcd-123456789abc';
const encrypted={
 format:'unity-sync-delta-encrypted',schema:1,algorithm:'AES-256-GCM',
 kdf:'PBKDF2-SHA256',iterations:310000,purpose:'manual-review-only',
 salt:Buffer.alloc(16,17).toString('base64'),iv:Buffer.alloc(12,7).toString('base64'),
 ciphertext:Buffer.from('synthetic encrypted bytes – not real user data').toString('base64')
};
const safe={
 enabled:true,foreground:true,accountVerified:true,deviceAuthorized:true,
 encryptionApproved:true,conflictFree:true,remoteListingFresh:true,
 nonOverwriteAdapterVerified:true,targetNamespace:log.NAMESPACE
};
const entryPromise=log.makeEntry({encrypted,deviceId,sequence:2,sha256:sha});
function fake(){
 const map=new Map(),byName=new Map(),calls={list:0,upload:0,read:0};
 let nextId=100;
 const provider={
  async list(){
   calls.list++;
   return {namespace:log.NAMESPACE,verifiedFolder:true,
    files:[...map].map(([fileid,row])=>({fileid,name:row.name,
     size:Buffer.byteLength(row.content,'utf8'),hash:'provider-64bit-is-not-sha256'}))};
  },
  async read(fileid){
   calls.read++;
   const row=map.get(String(fileid));if(!row)throw Error('no remote file');
   return row.content;
  },
  async uploadNoOverwrite(opts){
   calls.upload++;
   assert.equal(opts.renameifexists,1,'pCloud overwrite protection');
   assert.equal(opts.nopartial,1,'no partial file residues');
   assert.equal(opts.folderNamespace,log.NAMESPACE,'isolation from Werkarchiv');
   assert.equal(opts.mediaType,'application/json');
   let name=opts.filename;
   if(byName.has(name))name='renamed-by-pcloud-collision.json';
   const fileid=String(nextId++);
   map.set(fileid,{name,content:opts.content});byName.set(name,fileid);
   return {filename:name,size:Buffer.byteLength(opts.content,'utf8'),
    fileid,renameifexists:1,nopartial:1};
  }
 };
 return {provider,map,byName,calls};
}
const expectBlock=async (entry,change)=>{
 const {provider,calls}=fake();
 const result=await log.store(entry,{adapter:provider,sha256:sha,
  safety:{...safe,...change}});
 assert.equal(result.status,'blocked');assert.equal(result.checkpointAllowed,false);
 assert.equal(result.executedUpload,false);
 assert.equal(calls.list,0);assert.equal(calls.upload,0);
};
(async()=>{
 assert.equal(log.VERSION,1);
 assert.equal(log.NAMESPACE,'UNITY-LAB/03-AUSTAUSCH/immutable-v1');
 const entry=await entryPromise;
 assert.equal(entry.encrypted,true);
 assert.equal(entry.tradeApproved,false);
 assert.match(entry.name,new RegExp('^UNITY-SYNC-V1_'+deviceId+'_2_[0-9a-f]{64}\\.json$'));
 assert.equal(entry.bytes,Buffer.byteLength(entry.content,'utf8'));
 assert.equal(entry.sha256,await sha(entry.content));
 assert.equal(log.verifyEntry(entry),true);
 const recalc=await log.makeEntry({encrypted,deviceId,sequence:2,sha256:sha});
 assert.deepEqual(entry,recalc,'deterministic content addressed file');
 const withAnotherSeq=await log.makeEntry({encrypted,deviceId,sequence:3,sha256:sha});
 assert.notEqual(entry.name,withAnotherSeq.name);
 await assert.rejects(log.makeEntry({encrypted,deviceId:'INVALID',sequence:1,sha256:sha}),/Gerätekennung/);
 await assert.rejects(log.makeEntry({encrypted,deviceId,sequence:0,sha256:sha}),/Revision/);
 await assert.rejects(log.makeEntry({encrypted:{...encrypted,access_token:'LEAK'},deviceId,sequence:2,sha256:sha}),/Unbekannte/);
 await expectBlock(entry,{enabled:false});
 await expectBlock(entry,{foreground:false});
 await expectBlock(entry,{accountVerified:false});
 await expectBlock(entry,{deviceAuthorized:false});
 await expectBlock(entry,{encryptionApproved:false});
 await expectBlock(entry,{conflictFree:false});
 await expectBlock(entry,{remoteListingFresh:false});
 await expectBlock(entry,{nonOverwriteAdapterVerified:false});
 await expectBlock(entry,{targetNamespace:'WERK-ARCHIV'});
 const {provider,map,byName,calls}=fake();
 const first=await log.store(entry,{adapter:provider,sha256:sha,safety:safe});
 assert.equal(first.status,'uploaded-and-verified');
 assert.equal(first.checkpointAllowed,true);
 assert.equal(first.executedUpload,true);
 assert.equal(first.tradeApproved,false);
 assert.equal(first.sha256,entry.sha256);
 assert.equal(calls.upload,1);assert.equal(calls.list,2);assert.equal(calls.read,1);
 assert.equal(map.size,1,'no other files changed');
 const second=await log.store(entry,{adapter:provider,sha256:sha,safety:safe});
 assert.equal(second.status,'already-present-verified');
 assert.equal(second.checkpointAllowed,true);
 assert.equal(second.executedUpload,false);
 assert.equal(calls.upload,1,'idempotent retry must not reupload');
 assert.equal(map.size,1);
 const malicious={...entry,content:entry.content+'M'};
 await assert.rejects(log.store(malicious,{adapter:provider,sha256:sha,safety:safe}),/geändert/);
 assert.equal(calls.upload,1);
 const remote=map.get(first.fileid);
 map.set(first.fileid,{...remote,content:remote.content+'TAMPER'});
 await assert.rejects(log.store(entry,{adapter:provider,sha256:sha,safety:safe}),/Dateilänge|Remote-Bytes/);
 assert.equal(calls.upload,1,'never overwrite tampered remote object');
 const wrongFolder=fake();
 wrongFolder.provider.list=async()=>({namespace:'WERK-ARCHIV',verifiedFolder:true,files:[]});
 await assert.rejects(log.store(entry,{adapter:wrongFolder.provider,sha256:sha,safety:safe}),/Ordner/);
 assert.equal(wrongFolder.calls.upload,0);
 const incomplete=fake();
 incomplete.provider.uploadNoOverwrite=async()=>({filename:entry.name,fileid:'900',size:entry.bytes,renameifexists:0,nopartial:1});
 await assert.rejects(log.store(entry,{adapter:incomplete.provider,sha256:sha,safety:safe}),/Cloud-Quittung/);
 const collision=fake();
 const originalUpload=collision.provider.uploadNoOverwrite;
 collision.provider.uploadNoOverwrite=async opts=>{
  collision.byName.set(opts.filename,'7');
  return originalUpload(opts);
 };
 await assert.rejects(log.store(entry,{adapter:collision.provider,sha256:sha,safety:safe}),/Cloud-Quittung/);
 assert.equal(collision.map.size,1,'collision added a new name, never overwrote an old object');
 const lostReceipt=fake();
 const realUpload=lostReceipt.provider.uploadNoOverwrite;
 lostReceipt.provider.uploadNoOverwrite=async opts=>{
  const ack=await realUpload(opts);return {...ack,fileid:'101010'};
 };
 await assert.rejects(log.store(entry,{adapter:lostReceipt.provider,sha256:sha,safety:safe}),/nicht eindeutig/);
 const lostRead=fake();
 lostRead.provider.read=async()=>{throw Error('pCloud readback failed')};
 await assert.rejects(log.store(entry,{adapter:lostRead.provider,sha256:sha,safety:safe}),/readback failed/);
 assert.equal(lostRead.calls.upload,1,'uploaded but never approved; retry must verify existing bytes');
 const text=fs.readFileSync('sync-pcloud-log.js','utf8');
 assert.doesNotMatch(text,/\bfetch\s*\(|indexedDB\.|localStorage\.|document\.cookie|client_secret|access_token\s*=/);
 assert.match(text,/renameifexists=1/);
 assert.match(text,/nopartial=1/);
 assert.match(text,/checkpointAllowed:false/);
 const browser={};
 vm.runInNewContext(text,{globalThis:browser,TextEncoder,Map,Set,Promise});
 assert.equal(browser.UNITY_PCLOUD_LOG.NAMESPACE,log.NAMESPACE);
 assert.equal(browser.UNITY_PCLOUD_LOG.VERSION,1);
 assert.match(fs.readFileSync('pcloud-direct.js','utf8'),/UNITY_PCLOUD_GATEWAY = ''/,
  'real pCloud writes must still be disabled without a verified OAuth gateway');
 console.log('UNITY pCloud append-only transport: encrypted hashes, safe retry, no overwrite, folder isolation, tampered cloud, collision and post-upload readback tests passed.');
})().catch(e=>{console.error(e);process.exitCode=1});
