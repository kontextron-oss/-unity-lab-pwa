'use strict';
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const log=require('../sync-pcloud-log.js');
const {createPCloudNodeAdapter,SEGMENTS,NAMESPACE}=
 require('../worker/pcloud-node-adapter.cjs');
const sha=async s=>crypto.createHash('sha256').update(s,'utf8').digest('hex');
const session={hostname:'eapi.pcloud.com',token:'SYNTHETIC_TOKEN_FOR_TEST_ONLY_123456'};
const sample={
 format:'unity-sync-delta-encrypted',schema:1,algorithm:'AES-256-GCM',
 kdf:'PBKDF2-SHA256',iterations:310000,purpose:'manual-review-only',
 salt:Buffer.alloc(16,12).toString('base64'),iv:Buffer.alloc(12,3).toString('base64'),
 ciphertext:Buffer.from('simulated encrypted bytes').toString('base64')
};
const deviceId='e2012345-ffff-44aa-8bcd-123456789abc';
const safe={
 enabled:true,foreground:true,accountVerified:true,deviceAuthorized:true,
 encryptionApproved:true,conflictFree:true,remoteListingFresh:true,
 nonOverwriteAdapterVerified:true,targetNamespace:log.NAMESPACE
};
function server(){
 const entries=new Map();let nextId=500,attacks={};
 const calls={api:[],download:[],upload:0};
 const hierarchy={
  0:{folderid:0,isfolder:true,name:'root',contents:[{isfolder:true,name:SEGMENTS[0],folderid:11}]},
  11:{folderid:11,isfolder:true,name:SEGMENTS[0],contents:[{isfolder:true,name:SEGMENTS[1],folderid:22}]},
  22:{folderid:22,isfolder:true,name:SEGMENTS[1],contents:[{isfolder:true,name:SEGMENTS[2],folderid:33}]}
 };
 function folder33(){return {folderid:33,isfolder:true,name:'immutable-v1',contents:
  [...entries].map(([id,v])=>({isfolder:false,fileid:Number(id),name:v.name,size:Buffer.byteLength(v.content)}))}}
 const response=x=>({ok:true,json:async()=>x});
 const fetcher=async(url,request)=>{
  assert.ok(url.startsWith('https://'));
  if(url.startsWith('https://cdn1.pcloud.com/')){
   calls.download.push(url);
   const fid=url.split('/').at(-1);
   if(attacks.badDownload)return {ok:true,arrayBuffer:async()=>new TextEncoder().encode('CORRUPTED').buffer};
   const item=entries.get(fid);
   assert.ok(item,'unexpected download id');
   return {ok:true,arrayBuffer:async()=>new TextEncoder().encode(item.content).buffer};
  }
  assert.ok(url.startsWith('https://eapi.pcloud.com/'),'region must match OAuth token');
  assert.equal(request.headers.Authorization,'Bearer '+session.token);
  assert.equal(request.method,'POST');
  assert.equal(request.redirect,'error');
  assert.equal(request.cache,'no-store');
  const method=url.split('/').at(-1);
  calls.api.push(method);
  if(method==='listfolder'){
   const id=Number(request.body.get('folderid'));
   if(id===33)return response({result:0,metadata:folder33()});
   if(attacks.missingFolder&&id===22)return response({result:0,metadata:{...hierarchy[22],contents:[]}});
   if(attacks.badRoot&&id===0)return response({result:0,metadata:{...hierarchy[0],contents:[{isfolder:true,name:'WERK-ARCHIV',folderid:11}]}});
   return response({result:0,metadata:hierarchy[id]});
  }
  if(method==='getfilelink'){
   const id=request.body.get('fileid');
   assert.ok(entries.has(id),'Only list-authorized files can be downloaded');
   return response({result:0,hosts:[attacks.evilHost?'evil.test':'cdn1.pcloud.com'],path:'/content/'+id});
  }
  if(method==='uploadfile'){
   calls.upload++;
   assert.equal(request.body.get('folderid'),'33');
   assert.equal(request.body.get('nopartial'),'1');
   assert.equal(request.body.get('renameifexists'),'1');
   const f=request.body.get('file');
   assert.equal(f.type,'application/json');
   const content=await f.text();
   let name=f.name;
   if([...entries.values()].some(x=>x.name===name))name='renamed-on-collision.json';
   const id=String(nextId++);
   if(!attacks.missingUpload)entries.set(id,{name,content});
   return response({result:0,metadata:[{
    fileid:Number(id),name,created:'today',size:Buffer.byteLength(content),
    parentfolderid:attacks.otherFolder?444:33
   }]});
  }
  throw Error('Unapproved network endpoint: '+method);
 };
 return {entries,fetcher,calls,attacks};
}
(async()=>{
 assert.equal(NAMESPACE,'UNITY-LAB/03-AUSTAUSCH/immutable-v1');
 assert.equal(SEGMENTS.length,3);
 assert.throws(()=>createPCloudNodeAdapter({session:{hostname:'evil.io',token:session.token},fetcher:async()=>{}}),/Region/);
 assert.throws(()=>createPCloudNodeAdapter({session:{...session,token:'x'},fetcher:async()=>{}}),/Sitzung/);
 assert.throws(()=>createPCloudNodeAdapter({session,fetcher:null}),/Netzwerkadapter/);
 const entry=await log.makeEntry({encrypted:sample,deviceId,sequence:1,sha256:sha});
 const s=server(),adapter=createPCloudNodeAdapter({session,fetcher:s.fetcher});
 assert.equal(adapter.browserCompatible,false);
 assert.equal(adapter.sessionPersisted,false);
 assert.ok(!JSON.stringify(adapter).includes(session.token));
 await assert.rejects(adapter.read('500'),/nicht aus dem geprüften/);
 await assert.rejects(adapter.uploadNoOverwrite({
  filename:entry.name,content:entry.content,
  folderNamespace:NAMESPACE,nopartial:1,renameifexists:1,mediaType:'application/json'
 }),/zuerst vollständig geprüft/);
 const result=await log.store(entry,{adapter,sha256:sha,safety:safe});
 assert.equal(result.status,'uploaded-and-verified');
 assert.equal(result.checkpointAllowed,true);
 assert.equal(result.sha256,entry.sha256);
 assert.equal(s.entries.size,1);
 assert.equal(s.calls.upload,1);
 assert.ok(s.calls.api.filter(x=>x==='listfolder').length>=10);
 assert.ok(s.calls.api.includes('getfilelink'));
 const second=await log.store(entry,{adapter,sha256:sha,safety:safe});
 assert.equal(second.status,'already-present-verified');
 assert.equal(s.calls.upload,1,'same file must not be reuploaded');
 assert.equal(s.entries.size,1);
 const old=await adapter.list();
 assert.equal(old.namespace,NAMESPACE);
 assert.equal(old.files.length,1);
 await assert.rejects(adapter.read('9999'),/nicht aus dem geprüften/);
 const wrongPath=server();
 wrongPath.attacks.badRoot=true;
 const wrong=createPCloudNodeAdapter({session,fetcher:wrongPath.fetcher});
 await assert.rejects(wrong.list(),/fehlt oder ist mehrdeutig/);
 assert.equal(wrongPath.calls.upload,0);
 const other=server();other.attacks.otherFolder=true;
 const otherAdapter=createPCloudNodeAdapter({session,fetcher:other.fetcher});
 await assert.rejects(log.store(entry,{adapter:otherAdapter,sha256:sha,safety:safe}),/falscher Zielordner/);
 const missing=server();missing.attacks.missingUpload=true;
 const missingAdapter=createPCloudNodeAdapter({session,fetcher:missing.fetcher});
 await assert.rejects(log.store(entry,{adapter:missingAdapter,sha256:sha,safety:safe}),/nicht eindeutig/);
 const tamper=server();const tamperAdapter=createPCloudNodeAdapter({session,fetcher:tamper.fetcher});
 await log.store(entry,{adapter:tamperAdapter,sha256:sha,safety:safe});
 tamper.attacks.evilHost=true;
 await assert.rejects(log.store(entry,{adapter:tamperAdapter,sha256:sha,safety:safe}),/Downloadadresse/);
 // A same-name server upload must return a renamed filename; the transaction
 // is rejected, and the original immutable entry is never overwritten.
 const collision=server();const colAdapter=createPCloudNodeAdapter({session,fetcher:collision.fetcher});
 await colAdapter.list();
 collision.entries.set('900',{name:entry.name,content:'unrelated existing bytes'});
 await assert.rejects(colAdapter.uploadNoOverwrite({
  filename:entry.name,content:entry.content,mediaType:'application/json',
  folderNamespace:NAMESPACE,nopartial:1,renameifexists:1
 }),/umbenannt/);
 assert.equal(collision.entries.get('900').content,'unrelated existing bytes');
 assert.equal(s.calls.api.some(x=>['deletefile','renamefile','createfolder'].includes(x)),false);
 const code=fs.readFileSync('worker/pcloud-node-adapter.cjs','utf8');
 assert.doesNotMatch(code,/safeStorage\.(?:decryptString|encryptString)|localStorage\.|client_secret|console\.log\s*\(.*token/);
 assert.equal(/require\(['"]\.\.\/sync-pcloud-log\.js['"]\)/.test(code),true);
 console.log('UNITY PC pCloud: Node/Electron adapter end-to-end against mock API, own folder, encrypted immutable upload, verified readback, idempotence, hostile/renamed response and zero cross-project overwrite passed.');
})().catch(e=>{console.error(e);process.exitCode=1});
