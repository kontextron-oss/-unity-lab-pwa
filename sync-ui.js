'use strict';
/*
 * UNITY 0.17 RC1 – explicit, encrypted, manual pCloud change exchange.
 * Two pilot collections only: instruments and analyses. Other stores remain
 * in local backups; never synchronized or imported here.
 * No network calls, OAuth, secret persistence or automatic overwrite.
 */
const UNITY_SYNC_CHECKPOINT_ID='unity-sync-export-v1';
let unitySyncPending=null,unitySyncIncoming=null;
function unitySyncCheckpoint(){
 const s=(cache?.settings||[]).find(x=>x?.id===UNITY_SYNC_CHECKPOINT_ID);
 return s?.deviceId&&Number.isSafeInteger(s.revision)&&
  s.lastManifest?.format===UNITY_SYNC_PLAN.FORMAT?s:null;
}
async function unitySyncHashText(text){
 if(!crypto?.subtle)throw Error('Für verschlüsselte Änderungen wird HTTPS / WebCrypto benötigt');
 const d=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
 return Array.from(new Uint8Array(d)).map(x=>x.toString(16).padStart(2,'0')).join('');
}
function unitySyncStatus(msg){
 const el=document.getElementById('unity-sync-status');
 if(el)el.textContent=msg;
}
function unitySyncPasswords(){
 const input=document.getElementById('unity-sync-password');
 const pass=String(input?.value||'');
 UNITY_SYNC_CRYPTO.validPassword(pass);
 if(input)input.value='';
 return pass;
}
async function unitySyncSnapshot(){
 const x={};
 for(const kind of STORES)x[kind]=JSON.parse(JSON.stringify(await all(kind)));
 return x;
}
async function unitySyncManifest(records,deviceId,sequence,baseHash,at){
 return UNITY_SYNC_PLAN.create({deviceId,sequence,createdAt:at,
  parentHash:baseHash,records},unitySyncHashText);
}
async function unitySyncPrepare(){
 if(unitySyncPending)throw Error('Erst bestehende Austauschdatei teilen und in pCloud bestätigen oder die Seite neu öffnen.');
 const password=unitySyncPasswords();
 unitySyncStatus('Prüfe lokale Datensätze und verschlüssele das Änderungspaket …');
 const state=unitySyncCheckpoint();
 const deviceId=state?.deviceId||crypto.randomUUID();
 const seq=(state?.revision||0)+1;
 const at=new Date().toISOString(),base=state?.lastManifest||null;
 const records=await unitySyncSnapshot();
 const current=await unitySyncManifest(records,deviceId,seq,base?.sha256||null,at);
 const payload=await UNITY_SYNC_TRANSFER.create({
  targetManifest:current,baseManifest:base,
  records:{instruments:records.instruments,analyses:records.analyses},
  deviceId,sequence:seq,exportedAt:at
 },unitySyncHashText,UNITY_SYNC_PLAN);
 const wrapped=await UNITY_SYNC_CRYPTO.encrypt(payload,password,crypto,
  UNITY_SYNC_TRANSFER,UNITY_SYNC_PLAN,unitySyncHashText);
 const name='UNITY-SYNC-V1_'+at.replace(/[:.]/g,'-')+'_'+seq+'.json';
 const file=new File([JSON.stringify(wrapped)],name,{type:'application/json'});
 unitySyncPending={file,manifest:current,deviceId,revision:seq,
  changeCount:payload.changes.length,offered:false,confirmed:false,
  sourceHashes:UNITY_SYNC_PLAN.canonical(current.stores),
  packetHash:payload.sha256};
 const share=document.getElementById('unity-sync-share');
 if(share)share.hidden=false;
 unitySyncStatus(payload.changes.length+' neue oder veränderte Datensätze verschlüsselt vorbereitet. '+
  'Jetzt Datei nach pCloud teilen. Das Weitergeben ist noch keine bestätigte Sicherung.');
}
async function unitySyncShare(){
 const pending=unitySyncPending;
 if(!pending)throw Error('Erst eine Austauschdatei vorbereiten.');
 const f=pending.file;
 let shared=false;
 if(typeof navigator.share==='function'&&
  (typeof navigator.canShare!=='function'||navigator.canShare({files:[f]}))){
  try{
   await navigator.share({files:[f],title:'UNITY verschlüsselte Änderungen',
    text:'Manuell in privater pCloud unter UNITY-LAB/03-AUSTAUSCH/ ablegen. Empfang auf Zielgerät erst nach Prüfung.'});
   shared=true;
  }catch(e){if(e?.name==='AbortError'){
   unitySyncStatus('Teilen abgebrochen – Datei bleibt für erneuten Versuch vorbereitet.');return;
  }}
 }
 if(!shared)unityDownloadBackup(f);
 pending.offered=true;
 const c=document.getElementById('unity-sync-confirm');
 if(c)c.hidden=false;
 unitySyncStatus('Verschlüsselte Datei '+f.name+' zum Speichern bereitgestellt. '+
  'Bitte die tatsächliche Ablage in pCloud kontrollieren. Erst danach bestätigen.');
}
async function unitySyncConfirm(){
 const p=unitySyncPending;
 if(!p||!p.offered)throw Error('Bitte zunächst die verschlüsselte Datei nach pCloud teilen.');
 const records=await unitySyncSnapshot();
 const same=await unitySyncManifest(records,p.deviceId,p.revision,
  p.manifest.parentHash,new Date().toISOString());
 if(UNITY_SYNC_PLAN.canonical(same.stores)!==p.sourceHashes)
  throw Error('Lokale Daten haben sich seit dem Export geändert – nicht bestätigen. Neue Datei erzeugen.');
 if(!confirm('Ist die Datei '+p.file.name+
  ' nachweislich im privaten pCloud-Ordner gespeichert? Nur dann den lokalen Austauschstand vormerken.'))return;
 await put('settings',{id:UNITY_SYNC_CHECKPOINT_ID,
  deviceId:p.deviceId,revision:p.revision,lastManifest:p.manifest,
  lastPacketHash:p.packetHash,lastConfirmedAt:new Date().toISOString(),
  mode:'manual-confirmed-only'});
 unitySyncPending=null;
 await refresh();
 unitySyncStatus('Lokaler Austauschstand bestätigt. Die Dateiübertragung selbst wurde nicht automatisch geprüft.');
}
function unitySyncSafeRecord(obj){
 const raw=JSON.stringify(obj);
 if(raw.length>250000||/[<>]/.test(raw))
  throw Error('Importdatei enthält zu große oder potenziell unsichere Texte.');
}
async function unitySyncInspect(){
 const f=document.getElementById('unity-sync-file')?.files?.[0];
 if(!f)throw Error('Zuerst eine verschlüsselte UNITY-SYNC-Datei auswählen.');
 if(f.size>6*1024*1024)throw Error('Austauschdatei ist zu groß.');
 const password=unitySyncPasswords();
 unitySyncStatus('Entschlüssele und prüfe Datensätze, prüfe Versionsstände …');
 const wrapped=JSON.parse(await f.text());
 if(wrapped?.format!==UNITY_SYNC_CRYPTO.FORMAT)
  throw Error('Keine verschlüsselte UNITY-SYNC-Datei. Unverschlüsselte Pakete werden nicht angenommen.');
 const result=await UNITY_SYNC_CRYPTO.decrypt(wrapped,password,crypto,
  UNITY_SYNC_TRANSFER,UNITY_SYNC_PLAN,unitySyncHashText);
 const state=unitySyncCheckpoint();
 const device=state?.deviceId||crypto.randomUUID();
 const local=await unitySyncManifest(await unitySyncSnapshot(),device,
  Math.max(1,state?.revision||1),state?.lastManifest?.parentHash||null,
  new Date().toISOString());
 const review=await UNITY_SYNC_TRANSFER.inspect(result.packet,local,
  unitySyncHashText,UNITY_SYNC_PLAN);
 for(const change of result.packet.changes)unitySyncSafeRecord(change.record);
 unitySyncIncoming={packet:result.packet,review,
  sourceHashes:UNITY_SYNC_PLAN.canonical(local.stores),
  inspectedAt:new Date().toISOString()};
 const target=document.getElementById('unity-sync-review');
 if(target){
  const msg=review.rows.slice(0,25).map(x=>'<div class="home-data-row"><span>'+
   esc(x.store)+' / '+esc(x.id)+'</span><b>'+
   esc(x.status==='new'?'Nur im Import':x.status==='same'?'Identisch':
   x.status==='canReviewUpdate'?'Andere Version – nur prüfen':'Konflikt – gesperrt')+
   '</b></div>').join('');
  target.innerHTML='<p><b>Prüfergebnis:</b> '+review.counts.new+' nur in Datei · '+
   review.counts.canReviewUpdate+' ältere/abweichende Versionen · '+
   review.counts.conflict+' Konflikte · '+review.counts.same+' identisch.</p>'+
   msg+(review.rows.length>25?'<p class="tiny muted">Weitere Datensätze nur im vollständigen Prüfbericht.</p>':'')+
   '<p class="tiny muted">Abweichende bestehende Datensätze bleiben unangetastet. '+
   'Nur bisher fehlende Datensätze können separat freigegeben werden. Keine Börsenorders.</p>';
 }
 const b=document.getElementById('unity-sync-import-new');
 if(b)b.hidden=review.counts.new===0;
 unitySyncStatus('Integrität und Versionsstände geprüft – noch keine lokalen Daten verändert.');
}
async function unitySyncImportNew(){
 const pending=unitySyncIncoming;
 if(!pending)throw Error('Erst die verschlüsselte Datei prüfen.');
 // Atomic IndexedDB add rejects existing IDs. An existing value is NEVER put/overwritten.
 const state=unitySyncCheckpoint();
 const records=await unitySyncSnapshot();
 const local=await unitySyncManifest(records,state?.deviceId||crypto.randomUUID(),
  Math.max(1,state?.revision||1),state?.lastManifest?.parentHash||null,
  new Date().toISOString());
 if(UNITY_SYNC_PLAN.canonical(local.stores)!==pending.sourceHashes)
  throw Error('Lokaler Datenbestand wurde nach der Vorschau verändert. Datei erneut prüfen.');
 const again=await UNITY_SYNC_TRANSFER.inspect(pending.packet,local,
  unitySyncHashText,UNITY_SYNC_PLAN);
 if(again.packetHash!==pending.review.packetHash||again.counts.new!==pending.review.counts.new||
  again.counts.conflict!==pending.review.counts.conflict||
  again.counts.canReviewUpdate!==pending.review.counts.canReviewUpdate)
  throw Error('Prüfstand hat sich geändert. Keine Datenübernahme.');
 const additions=again.rows.filter(x=>x.status==='new');
 if(!additions.length)throw Error('Keine bisher fehlenden Datensätze.');
 const incoming=new Map(pending.packet.changes.map(x=>[x.store+'/'+x.id,x.record]));
 const inserts={};for(const k of STORES)inserts[k]=[];
 for(const row of additions){
  if(!UNITY_SYNC_TRANSFER.TYPES.includes(row.store))throw Error('Unzulässige Importgruppe.');
  const item=incoming.get(row.store+'/'+row.id);
  if(!item)throw Error('Datensatz fehlt im geprüften Austauschpaket.');
  unitySyncSafeRecord(item);
  inserts[row.store].push(item);
 }
 const unresolved=again.counts.conflict+again.counts.canReviewUpdate;
 if(!confirm(additions.length+' bisher fehlende Datensätze zu UNITY hinzufügen?'+
   (unresolved?' '+unresolved+' bestehende Abweichungen/Konflikte bleiben ausdrücklich erhalten und UNVERÄNDERT.':'')+
   '\nNur neue IDs werden ergänzt, keine Aufträge ausgeführt und keine vorhandenen Daten überschrieben.'))return;
 await bulkInsert(inserts);
 unitySyncIncoming=null;
 await refresh();
 unitySyncStatus(additions.length+' bisher fehlende Datensätze ergänzt. Vorhandene Versionen und Konflikte unverändert.');
}
