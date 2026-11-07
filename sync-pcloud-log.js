'use strict';
/*
 * UNITY immutable pCloud synchronization log, adapter contract v1.
 * SAFETY: no OAuth tokens, network access, IndexedDB, background timer, or
 * stored credentials. This module can run against an injected, authenticated
 * adapter ONLY after device and provider approval. It never updates files.
 *
 * pCloud uploadfile normally overwrites a same-named file. The production
 * adapter MUST use renameifexists=1 AND nopartial=1 for each upload. Any
 * automatic rename means collision: do not checkpoint. Uploaded bytes must
 * be independently downloaded and SHA-256 checked before acknowledging.
 *
 * pCloud file metadata.hash is NOT a SHA-256 cryptographic digest.
 * There is no assumption of a provider-side compare-and-swap primitive.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.UNITY_PCLOUD_LOG=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 const VERSION=1,FORMAT='unity-sync-append-only-v1';
 const NAMESPACE='UNITY-LAB/03-AUSTAUSCH/immutable-v1';
 const RX_UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
 const RX_HASH=/^[0-9a-f]{64}$/;
 const RX_FILE=/^UNITY-SYNC-V1_([0-9a-f-]{36})_([1-9][0-9]{0,11})_([0-9a-f]{64})\.json$/;
 const MAX_BYTES=4*1024*1024;
 function fail(m){throw Error('UNITY unveränderliches pCloud-Protokoll: '+m)}
 function ensure(cond,m){if(!cond)fail(m)}
 function canonicalEnvelope(x){
  ensure(x&&typeof x==='object'&&!Array.isArray(x),'Ungueltige Verschluesselung');
  const expected=['format','schema','algorithm','kdf','iterations','salt','iv','purpose','ciphertext'].sort().join(',');
  ensure(Object.keys(x).sort().join(',')===expected,'Unbekannte verschluesselte Felder');
  ensure(x.format==='unity-sync-delta-encrypted'&&x.schema===1&&
   x.algorithm==='AES-256-GCM'&&x.kdf==='PBKDF2-SHA256'&&
   x.iterations===310000&&x.purpose==='manual-review-only','Nicht freigegebenes Nutzdatenformat');
  for(const s of ['salt','iv','ciphertext'])
   ensure(typeof x[s]==='string'&&x[s].length>1&&
    /^[A-Za-z0-9+/=]+$/.test(x[s]),'Ungueltige verschluesselte Nutzdaten');
  return JSON.stringify(x);
 }
 async function makeEntry({encrypted,deviceId,sequence,sha256}){
  ensure(typeof deviceId==='string'&&RX_UUID.test(deviceId),'Gerätekennung fehlt');
  ensure(Number.isSafeInteger(sequence)&&sequence>0&&sequence<=999999999999,'Revision unzulässig');
  ensure(typeof sha256==='function','SHA-256-Funktion fehlt');
  const content=canonicalEnvelope(encrypted);
  const bytes=new TextEncoder().encode(content).byteLength;
  ensure(bytes<=MAX_BYTES,'Verschluesselte Datei zu gross');
  const hash=await sha256(content);
  ensure(typeof hash==='string'&&RX_HASH.test(hash),'SHA-256-Ergebnis ungültig');
  const name='UNITY-SYNC-V1_'+deviceId.toLowerCase()+'_'+sequence+'_'+hash+'.json';
  ensure(RX_FILE.test(name),'Unzulässiger Dateiname');
  return {kind:FORMAT,name,deviceId:deviceId.toLowerCase(),sequence,
   sha256:hash,bytes,content,mediaType:'application/json',
   namespace:NAMESPACE,encrypted:true,tradeApproved:false};
 }
 function verifyEntry(entry){
  ensure(entry&&entry.kind===FORMAT&&typeof entry.name==='string',
   'Unbekanntes Protokoll');
  const m=RX_FILE.exec(entry.name);
  ensure(!!m&&RX_UUID.test(m[1])&&m[2]===String(entry.sequence)&&
   m[1]===entry.deviceId&&m[3]===entry.sha256,'Dateiname und Metadaten widersprüchlich');
  ensure(entry.namespace===NAMESPACE&&entry.encrypted===true&&
   entry.tradeApproved===false,'Falscher privater Datenraum');
  ensure(typeof entry.content==='string'&&entry.bytes>0&&
   entry.bytes<=MAX_BYTES&&Number.isSafeInteger(entry.bytes),'Inhalt unvollständig');
  ensure(entry.mediaType==='application/json','Dateityp unzulässig');
  return true;
 }
 function gate(x){
  if(x?.enabled!==true||x?.foreground!==true||x?.accountVerified!==true||
     x?.deviceAuthorized!==true||x?.encryptionApproved!==true||
     x?.conflictFree!==true||x?.remoteListingFresh!==true||
     x?.nonOverwriteAdapterVerified!==true||
     x?.targetNamespace!==NAMESPACE)
   return {ready:false,reason:'Cloud-Synchronisation ist nicht freigegeben oder nicht vollständig geprüft'};
  return {ready:true,reason:'Verschlüsselter Append-only-Test zulässig, keine bestehende Datei überschreiben'};
 }
 function requireAdapter(adapter){
  ensure(adapter&&typeof adapter.list==='function'&&
   typeof adapter.read==='function'&&typeof adapter.uploadNoOverwrite==='function',
   'Geschütztes pCloud-OAuth-Gateway fehlt');
 }
 function validateList(value){
  ensure(value&&value.namespace===NAMESPACE&&Array.isArray(value.files)&&
    value.verifiedFolder===true,'Falscher oder ungeprüfter pCloud-Ordner');
  const names=new Set();
  for(const m of value.files){
   ensure(m&&typeof m.name==='string'&&
     Number.isSafeInteger(m.size)&&m.size>=0&&
     (typeof m.fileid==='string'&&/^[1-9]\d*$/.test(m.fileid)||
       Number.isSafeInteger(m.fileid)&&m.fileid>0),
    'Ungültige pCloud-Dateimetadaten');
   if(names.has(m.name))fail('Mehrfach vorhandener Dateiname im selben Ordner');
   names.add(m.name);
  }
  return value.files;
 }
 async function compareDownloaded(entry,response,sha256){
  ensure(typeof response==='string'&&new TextEncoder().encode(response).byteLength===entry.bytes,
   'Rückgelesene Dateilänge stimmt nicht');
  ensure(await sha256(response)===entry.sha256,'Remote-Bytes stimmen nicht mit dem SHA-256-Dateinamen');
  // Exact byte equality is stronger than relying on provider metadata.hash.
  ensure(response===entry.content,'Der verschlüsselte Upload wurde verändert');
 }
 async function store(entry,opts={}){
  verifyEntry(entry);
  const status=gate(opts.safety);
  if(!status.ready)return {kind:FORMAT,status:'blocked',reason:status.reason,
    checkpointAllowed:false,executedUpload:false,tradeApproved:false};
  const adapter=opts.adapter;
  requireAdapter(adapter);
  ensure(typeof opts.sha256==='function','Lokaler SHA-256-Verifikator fehlt');
  ensure(await opts.sha256(entry.content)===entry.sha256,
   'Zu übertragende Datei wurde nach der Vorbereitung geändert');
  const before=validateList(await adapter.list());
  const existing=before.filter(x=>x.name===entry.name);
  if(existing.length){
   await compareDownloaded(entry,await adapter.read(existing[0].fileid),opts.sha256);
   return {kind:FORMAT,status:'already-present-verified',
    checkpointAllowed:true,executedUpload:false,tradeApproved:false,
    fileid:String(existing[0].fileid),sha256:entry.sha256,name:entry.name};
  }
  // A verified provider adapter MUST set renameifexists=1 and nopartial=1.
  // The adapter may reject a collision or return a renamed file: both cases
  // prevent advancing a local synchronization checkpoint.
  const receipt=await adapter.uploadNoOverwrite({
   filename:entry.name,content:entry.content,mediaType:entry.mediaType,
   folderNamespace:NAMESPACE,nopartial:1,renameifexists:1});
  ensure(receipt&&receipt.filename===entry.name&&
   Number.isSafeInteger(receipt.size)&&receipt.size===entry.bytes&&
   (typeof receipt.fileid==='string'&&/^[1-9]\d*$/.test(receipt.fileid)||
     Number.isSafeInteger(receipt.fileid)&&receipt.fileid>0)&&
   receipt.nopartial===1&&receipt.renameifexists===1,
   'Cloud-Quittung zeigt Kollision, Umbenennung oder unvollständigen Upload');
  const after=validateList(await adapter.list());
  const matches=after.filter(x=>x.name===entry.name&&
    String(x.fileid)===String(receipt.fileid)&&x.size===entry.bytes);
  ensure(matches.length===1,'Hochgeladene Datei nicht eindeutig im privaten Ordner nachweisbar');
  await compareDownloaded(entry,await adapter.read(receipt.fileid),opts.sha256);
  return {kind:FORMAT,status:'uploaded-and-verified',checkpointAllowed:true,
   executedUpload:true,tradeApproved:false,fileid:String(receipt.fileid),
   sha256:entry.sha256,name:entry.name};
 }
 return {VERSION,FORMAT,NAMESPACE,MAX_BYTES,makeEntry,verifyEntry,gate,store};
});
