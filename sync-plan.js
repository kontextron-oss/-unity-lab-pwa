'use strict';
/*
 * UNITY local-first pCloud/PC synchronization planning contract, v1.
 * READ-ONLY: no fetch, uploads, cloud tokens, IndexedDB access, writes, orders,
 * execution permissions, or merge application. Hash manifests are integrity
 * checks, NOT encryption, signatures or user-approved merge authority.
 * Independent of the existing encrypted manual export and backup chain.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.UNITY_SYNC_PLAN=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 const FORMAT='unity-sync-manifest',SCHEMA=1;
 const STORES=Object.freeze(['instruments','quotes','transactions','strategies',
  'audit','fundamentals','histories','analyses','settings']);
 const LOCAL_ONLY_SETTINGS=Object.freeze(['unity-lab-incremental-checkpoint-v1',
  'unity-exchange-export-meta-v1','unity-sync-export-v1']);
 const RFC_DATE=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
 const HEX=/^[a-f0-9]{64}$/;
 const MAX_RECORDS=25000,MAX_CANONICAL_BYTES=16*1024*1024;
 const DENIED_KEYS=new Set(['__proto__','prototype','constructor']);
 function fail(message){throw Error('UNITY Sync: '+message)}
 function ensure(c,msg){if(!c)fail(msg)}
 function isObj(x){return x!==null&&typeof x==='object'&&!Array.isArray(x)&&
  (Object.getPrototypeOf(x)===Object.prototype||Object.getPrototypeOf(x)===null)}
 function sortedKeys(x){return Object.keys(x).sort()}
 function exact(x,keys){return isObj(x)&&sortedKeys(x).join('|')===keys.slice().sort().join('|')}
 function canonical(value,seen=new Set()){
  if(value===null||typeof value==='string'||typeof value==='boolean'||
     typeof value==='number'&&Number.isFinite(value))return JSON.stringify(value);
  ensure(typeof value==='object'&&value!==null,'Nicht-JSON-Daten');
  ensure(!seen.has(value),'Zyklische Datenstruktur');
  seen.add(value);
  let output;
  if(Array.isArray(value)){
   output='['+value.map(v=>canonical(v,seen)).join(',')+']';
  }else{
   ensure(isObj(value),'Objekttyp unzulässig');
   const keys=sortedKeys(value);
   for(const k of keys)ensure(!DENIED_KEYS.has(k),'Reservierter Schlüssel');
   output='{'+keys.map(k=>JSON.stringify(k)+':'+canonical(value[k],seen)).join(',')+'}';
  }
  seen.delete(value);
  return output;
 }
 function bytes(s){
  if(typeof TextEncoder!=='undefined')return new TextEncoder().encode(s).length;
  if(typeof Buffer!=='undefined')return Buffer.byteLength(s,'utf8');
  fail('TextEncoder fehlt');
 }
 function validId(x){return typeof x==='string'&&x.length>=1&&x.length<=150&&
  !/[\u0000-\u001f]/.test(x)&&!DENIED_KEYS.has(x)}
 function validSha(x){return typeof x==='string'&&HEX.test(x)}
 function validDate(x){return typeof x==='string'&&RFC_DATE.test(x)&&
   Number.isFinite(Date.parse(x))&&new Date(x).toISOString().startsWith(x.slice(0,19))}
 function checkStores(stores){
  ensure(exact(stores,STORES),'Datensatzgruppen stimmen nicht mit der lokalen UNITY-Datenbank überein');
  let count=0;
  for(const kind of STORES){
   const records=stores[kind];
   ensure(isObj(records),'Ungültiger Prüfsummenindex '+kind);
   for(const [id,hash] of Object.entries(records)){
    ensure(validId(id),'Ungültige Datensatz-ID in '+kind);
    ensure(validSha(hash),'Ungültiger SHA-256 in '+kind+'/'+id);
    count++;
    ensure(count<=MAX_RECORDS,'Zu viele Datensatzreferenzen');
   }
  }
  return count;
 }
 function body(packet){
  return {format:packet.format,schema:packet.schema,deviceId:packet.deviceId,
   sequence:packet.sequence,createdAt:packet.createdAt,
   parentHash:packet.parentHash,complete:packet.complete,
   stores:packet.stores,executionPermission:false};
 }
 function validateShape(x){
  ensure(exact(x,['format','schema','deviceId','sequence','createdAt','parentHash',
    'complete','stores','executionPermission','sha256']),'Unbekannte oder fehlende Manifestfelder');
  ensure(x.format===FORMAT&&x.schema===SCHEMA,'Nicht unterstützte Synchronisationsversion');
  ensure(typeof x.deviceId==='string'&&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x.deviceId),
    'Fehlende Geräteidentität');
  ensure(Number.isSafeInteger(x.sequence)&&x.sequence>=1,'Ungültige Revision');
  ensure(validDate(x.createdAt),'Ungültiger Zeitstempel');
  ensure(x.parentHash===null||validSha(x.parentHash),'Ungültiger Bezug auf Vorgängermanifest');
  ensure(x.complete===true,'Teillisten dürfen nicht als vollständige Archivbasis verglichen werden');
  ensure(x.executionPermission===false,'Keine Ausführung von Börsenaufträgen erlaubt');
  ensure(validSha(x.sha256),'Manifest-Prüfsumme fehlt');
  const count=checkStores(x.stores);
  ensure(bytes(canonical(body(x)))<=MAX_CANONICAL_BYTES,'Manifest zu groß');
  return count;
 }
 async function digest(hashFn,txt){
  ensure(typeof hashFn==='function','SHA-256-Prüffunktion fehlt');
  const result=await hashFn(txt);
  ensure(validSha(result),'SHA-256 liefert keinen 64-stelligen Hexwert');
  return result;
 }
 async function create({deviceId,sequence,createdAt,parentHash=null,records},hashFn){
  ensure(exact(records,STORES),'Nur die neun bekannten Datenbereiche dürfen erfasst werden');
  const stores=Object.create(null);
  let total=0;
  for(const kind of STORES){
   ensure(Array.isArray(records[kind]),'Datensatzbereich ist keine Liste: '+kind);
   const hashes=Object.create(null);
   for(const record of records[kind]){
    ensure(isObj(record)&&validId(record.id),'Datensatz ohne stabile ID: '+kind);
    // Local-only backup checkpoint and export fingerprint are not user records.
    if(kind==='settings'&&LOCAL_ONLY_SETTINGS.includes(record.id))continue;
    ensure(!Object.prototype.hasOwnProperty.call(hashes,record.id),
     'Doppelte lokale Datensatz-ID: '+kind+'/'+record.id);
    const serial=canonical(record);
    ensure(bytes(serial)<=MAX_CANONICAL_BYTES,'Datensatz zu groß');
    hashes[record.id]=await digest(hashFn,serial);
    total++;
    ensure(total<=MAX_RECORDS,'Zu viele Datensätze');
   }
   stores[kind]=hashes;
  }
  const partial={format:FORMAT,schema:SCHEMA,deviceId,sequence,createdAt,
   parentHash,complete:true,stores,executionPermission:false};
  const packet={...partial,sha256:'0'.repeat(64)};
  validateShape(packet);
  packet.sha256=await digest(hashFn,canonical(body(packet)));
  return packet;
 }
 async function verify(packet,hashFn){
  const count=validateShape(packet);
  const expected=await digest(hashFn,canonical(body(packet)));
  ensure(expected===packet.sha256,'Manifest-Prüfsumme fehlerhaft oder verändert');
  return {valid:true,format:FORMAT,schema:SCHEMA,deviceId:packet.deviceId,
   sequence:packet.sequence,recordCount:count,sha256:packet.sha256,
   executionPermission:false,containsRecordContent:false};
 }
 async function plan(local,remote,hashFn,base=null){
  await verify(local,hashFn);
  await verify(remote,hashFn);
  if(base!==null)await verify(base,hashFn);
  // Sequence regressions are forbidden for the same device. Another device
  // may legitimately be at any sequence, and clocks never select a winner.
  if(local.deviceId===remote.deviceId&&local.sha256!==remote.sha256){
   ensure(local.sequence!==remote.sequence,'Gleiche Geräteversion mit unterschiedlichen Daten');
   ensure(local.parentHash===remote.sha256||remote.parentHash===local.sha256,
    'Divergierende Revisionen desselben Geräts; Rücksetzung oder Fork prüfen');
  }
  const actions=[],counts={same:0,localOnly:0,remoteOnly:0,
   localChanged:0,remoteChanged:0,conflict:0,missingRemote:0,
   missingLocal:0,deleteReview:0};
  for(const kind of STORES){
   const a=local.stores[kind],b=remote.stores[kind],prev=base?.stores[kind]||{};
   const ids=new Set([...Object.keys(a),...Object.keys(b),...Object.keys(prev)]);
   for(const id of [...ids].sort()){
    const l=Object.prototype.hasOwnProperty.call(a,id)?a[id]:null;
    const r=Object.prototype.hasOwnProperty.call(b,id)?b[id]:null;
    const ancestor=Object.prototype.hasOwnProperty.call(prev,id)?prev[id]:null;
    let decision;
    if(l!==null&&l===r)decision='same';
    else if(l===null&&r===null)decision='deleteReview';
    else if(base&&ancestor!==null){
      if(l===ancestor&&r===null||r===ancestor&&l===null)
        decision='deleteReview';
      else if(l===ancestor&&r!==null)decision='remoteChanged';
      else if(r===ancestor&&l!==null)decision='localChanged';
      else decision='conflict';
    }else if(l===null&&r!==null)decision='remoteOnly';
    else if(l!==null&&r===null)decision='localOnly';
    else decision='conflict';
    counts[decision]++;
    if(decision!=='same')actions.push({
      store:kind,id,decision,
      localHash:l,remoteHash:r,baseHash:ancestor,
      requiresApproval:true,automaticOverwrite:false,
      automaticDelete:false,automaticOrderExecution:false});
   }
  }
  return {kind:'unity-sync-dry-run-v1',localHash:local.sha256,
   remoteHash:remote.sha256,baseHash:base?.sha256||null,
   counts,actions,conflictCount:counts.conflict+counts.deleteReview,
   eligibleForAutomaticMerge:false,tradeApproved:false,
   canWrite:false,canDelete:false,executionPermission:false,
   explanation:'Nur Vergleich: keine Übernahme, keine Löschung, keine Order. Fehlende Einträge und Konflikte erfordern Prüfung.'};
 }
 return {FORMAT,SCHEMA,STORES,LOCAL_ONLY_SETTINGS,canonical,create,verify,plan};
});
