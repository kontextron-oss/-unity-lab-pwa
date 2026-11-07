'use strict';
/*
 * UNITY Local-first manual sync delta, protocol v1.
 * Only instruments + analyses (not orders, transactions, budgets or settings).
 * Strictly read-only: create, inspect, validate. No cloud I/O and no database
 * writes. Plain deltas MUST be AES-GCM-encrypted before pCloud/file sharing.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.UNITY_SYNC_TRANSFER=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 const FORMAT='unity-sync-delta',SCHEMA=1;
 const TYPES=Object.freeze(['instruments','analyses']);
 const MAX_CHANGES=350,MAX_BYTES=3*1024*1024;
 const HEX=/^[0-9a-f]{64}$/;
 function fail(s){throw Error('UNITY Änderungsaustausch: '+s)}
 function requireThat(x,s){if(!x)fail(s)}
 function plain(x){return x!==null&&typeof x==='object'&&!Array.isArray(x)&&
  (Object.getPrototypeOf(x)===Object.prototype||Object.getPrototypeOf(x)===null)}
 function exact(x,keys){return plain(x)&&Object.keys(x).sort().join(',')===keys.slice().sort().join(',')}
 function bytes(s){return typeof TextEncoder!=='undefined'?new TextEncoder().encode(s).length:
  typeof Buffer!=='undefined'?Buffer.byteLength(s,'utf8'):s.length}
 function shape(packet){
  requireThat(exact(packet,['format','schema','deviceId','sequence','exportedAt',
   'baseManifestHash','targetManifest','changes','executionPermission','sha256']),
    'Unvollständiger oder unbekannter Paketaufbau');
  requireThat(packet.format===FORMAT&&packet.schema===SCHEMA&&packet.executionPermission===false,
   'Falsches Format oder verbotene Orderfreigabe');
  requireThat(typeof packet.deviceId==='string'&&Number.isSafeInteger(packet.sequence)&&
   packet.sequence>=1,'Gerät oder Revision ungültig');
  requireThat(typeof packet.exportedAt==='string'&&
   /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(packet.exportedAt)&&
   Number.isFinite(Date.parse(packet.exportedAt)),'Zeitstempel ungültig');
  requireThat(packet.baseManifestHash===null||HEX.test(packet.baseManifestHash),
   'Basiskennung ungültig');
  requireThat(HEX.test(packet.sha256),'Paketprüfsumme ungültig');
  requireThat(Array.isArray(packet.changes)&&packet.changes.length<=MAX_CHANGES,
   'Zu viele Änderungen');
  return packet;
 }
 function envelope(packet){
  return {format:packet.format,schema:packet.schema,deviceId:packet.deviceId,
   sequence:packet.sequence,exportedAt:packet.exportedAt,
   baseManifestHash:packet.baseManifestHash,targetManifest:packet.targetManifest,
   changes:packet.changes,executionPermission:false};
 }
 async function hash(sha,text){
  requireThat(typeof sha==='function','SHA-256-Prüffunktion fehlt');
  const x=await sha(text);
  requireThat(typeof x==='string'&&HEX.test(x),'SHA-256-Format falsch');
  return x;
 }
 async function create(input,sha,manifestApi){
  requireThat(plain(input)&&plain(input.records)&&
   Array.isArray(input.records.instruments)&&Array.isArray(input.records.analyses),
   'Nur Instrumente und Analysen können als Pilot übertragen werden');
  requireThat(manifestApi?.verify&&manifestApi?.canonical,
   'UNITY Datenmanifest fehlt');
  const target=input.targetManifest,base=input.baseManifest||null;
  await manifestApi.verify(target,sha);
  if(base)await manifestApi.verify(base,sha);
  requireThat(input.deviceId===target.deviceId&&input.sequence===target.sequence,
   'Paket und Datenstand gehören zu unterschiedlichen Geräteversionen');
  requireThat(input.exportedAt===target.createdAt,'Zeitstempel stimmt nicht überein');
  const changes=[];
  for(const store of TYPES){
   const ids=new Set();
   const sorted=[...input.records[store]].sort((a,b)=>String(a?.id).localeCompare(String(b?.id)));
   for(const record of sorted){
    requireThat(plain(record)&&typeof record.id==='string'&&record.id.length>0&&
     record.id.length<=150&&!ids.has(record.id),'Ungültige oder doppelte Datensatz-ID');
    ids.add(record.id);
    const repr=manifestApi.canonical(record);
    requireThat(bytes(repr)<=250000,'Einzelner Datensatz ist zu groß');
    const currentHash=await hash(sha,repr);
    requireThat(target.stores[store][record.id]===currentHash,
     'Änderungsinhalt passt nicht zum freigegebenen lokalen Datenstand');
    const old=base?.stores?.[store]?.[record.id]||null;
    if(old===currentHash)continue;
    changes.push({store,id:record.id,previousHash:old,
     currentHash,record:JSON.parse(JSON.stringify(record))});
    requireThat(changes.length<=MAX_CHANGES,'Mehr als 350 Änderungen: separat in kleinen Paketen übertragen');
   }
   requireThat(ids.size===Object.keys(target.stores[store]).length,
    'Auswahl deckt die vollständige pilotierte Datensatzgruppe nicht ab');
  }
  requireThat(changes.length>0,'Keine Änderung seit letzter bestätigter Austauschbasis');
  const packet={format:FORMAT,schema:SCHEMA,deviceId:input.deviceId,
   sequence:input.sequence,exportedAt:input.exportedAt,
   baseManifestHash:base?.sha256||null,targetManifest:target,changes,
   executionPermission:false,sha256:'0'.repeat(64)};
  requireThat(bytes(manifestApi.canonical(envelope(packet)))<=MAX_BYTES,'Paket zu groß');
  packet.sha256=await hash(sha,manifestApi.canonical(envelope(packet)));
  return packet;
 }
 async function verify(packet,sha,manifestApi){
  shape(packet);
  requireThat(manifestApi?.verify&&manifestApi?.canonical,'Datenmanifest fehlt');
  const parent=packet.targetManifest;
  await manifestApi.verify(parent,sha);
  requireThat(parent.deviceId===packet.deviceId&&parent.sequence===packet.sequence&&
   parent.createdAt===packet.exportedAt,'Gerät, Revision oder Datum passen nicht');
  requireThat(bytes(manifestApi.canonical(envelope(packet)))<=MAX_BYTES,'Paket zu groß');
  requireThat(await hash(sha,manifestApi.canonical(envelope(packet)))===packet.sha256,
   'Paket wurde verändert: SHA-256-Prüfung fehlgeschlagen');
  const seen=new Set();
  for(const item of packet.changes){
   requireThat(exact(item,['store','id','previousHash','currentHash','record']),
    'Unbekannte Felder im Änderungsdatensatz');
   requireThat(TYPES.includes(item.store)&&typeof item.id==='string'&&item.id.length>0&&
    item.id.length<=150&&plain(item.record)&&item.record.id===item.id,
    'Nicht zugelassener Datensatz oder fremde ID');
   const key=item.store+'/'+item.id;
   requireThat(!seen.has(key),'Doppelter Datensatz im Paket');seen.add(key);
   requireThat(item.previousHash===null||HEX.test(item.previousHash),'Vorgängerversion ungültig');
   requireThat(HEX.test(item.currentHash)&&
    parent.stores[item.store][item.id]===item.currentHash,
    'Prüfsumme passt nicht zum aktuellen Zielmanifest');
   requireThat(bytes(manifestApi.canonical(item.record))<=250000,
    'Datensatz zu groß');
   requireThat(await hash(sha,manifestApi.canonical(item.record))===item.currentHash,
    'Datensatzinhalt entspricht nicht seiner Prüfsumme');
   requireThat(item.previousHash!==item.currentHash,'Unveränderter Datensatz darf nicht übertragen werden');
   requireThat(packet.baseManifestHash!==null||item.previousHash===null,
    'Vorgängerversion ohne Basissicherung');
  }
  return {valid:true,deviceId:packet.deviceId,sequence:packet.sequence,
   packetHash:packet.sha256,baseManifestHash:packet.baseManifestHash,
   changeCount:packet.changes.length,executionPermission:false};
 }
 async function inspect(packet,localManifest,sha,manifestApi){
  await verify(packet,sha,manifestApi);
  await manifestApi.verify(localManifest,sha);
  const rows=[],counts={same:0,new:0,canReviewUpdate:0,conflict:0};
  for(const c of packet.changes){
   const current=localManifest.stores[c.store][c.id]||null;
   let status;
   if(current===c.currentHash)status='same';
   else if(current===null&&c.previousHash===null)status='new';
   else if(current!==null&&c.previousHash!==null&&current===c.previousHash)
    status='canReviewUpdate';
   else status='conflict';
   counts[status]++;
   rows.push({store:c.store,id:c.id,status,
    localHash:current,previousHash:c.previousHash,incomingHash:c.currentHash,
    requiresApproval:status!=='same',canWriteAutomatically:false,
    canDeleteAutomatically:false,canExecuteOrders:false});
  }
  return {kind:'unity-sync-transfer-review-v1',packetHash:packet.sha256,
   localManifestHash:localManifest.sha256,counts,rows,
   hasConflicts:counts.conflict>0,canApplyAutomatically:false,
   canOverwriteAutomatically:false,canDeleteAutomatically:false,
   canExecuteOrders:false,
   note:'Nur verschlüsselter manueller Dateiaustausch. Änderungen erst nach gesonderter Prüfung freigeben. Keine automatische Übernahme.'};
 }
 return {FORMAT,SCHEMA,TYPES,MAX_CHANGES,create,verify,inspect};
});
