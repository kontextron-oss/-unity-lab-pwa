'use strict';
/* UNITY LAB 0.13.48 — incremental, content-addressed, local-first backups.
   Every user-confirmed export is one JSON "cloud part": a small full-hash index
   plus ONLY new/changed record payloads. The first part is a full base.
   A chain of parts is required to restore; pCloud upload remains user mediated.
   No false cloud-sync success signals, no credentials, no silent overwrites. */
const UNITY_INC_STATE_ID='unity-lab-incremental-checkpoint-v1';
const UNITY_INC_FORMAT='unity-lab-incremental';
const UNITY_INC_SCHEMA=1;
let unityIncPending=null;
function unityIncStable(value){
  if(value===null||typeof value!=='object')return JSON.stringify(value);
  if(Array.isArray(value))return '['+value.map(v=>unityIncStable(v)).join(',')+']';
  const keys=Object.keys(value).filter(k=>value[k]!==undefined).sort();
  return '{'+keys.map(k=>JSON.stringify(k)+':'+unityIncStable(value[k])).join(',')+'}';
}
async function unityIncHash(value){
  if(typeof crypto==='undefined'||!crypto.subtle)throw Error('Für Prüfsummen wird HTTPS mit WebCrypto benötigt.');
  const bytes=new TextEncoder().encode(unityIncStable(value));
  const digest=await crypto.subtle.digest('SHA-256',bytes);
  return Array.from(new Uint8Array(digest)).map(n=>n.toString(16).padStart(2,'0')).join('');
}
function unityIncIsSha(s){return typeof s==='string'&&/^[0-9a-f]{64}$/.test(s)}
function unityIncValidStore(n){return STORES.includes(n)}
function unityIncBackupState(){
  const x=(cache.settings||[]).find(v=>v.id===UNITY_INC_STATE_ID);
  return x?.format===UNITY_INC_FORMAT&&x.schema===UNITY_INC_SCHEMA&&
    typeof x.lastBackupId==='string'&&unityIncIsSha(x.snapshotHash)&&
    x.manifest&&typeof x.manifest==='object'?x:null;
}
function unityIncNoMeta(store,records){
  return store==='settings'?records.filter(x=>x?.id!==UNITY_INC_STATE_ID):records;
}
async function unityIncLocalSnapshot(){
  const records={},manifest={};
  for(const n of STORES){
    const found=unityIncNoMeta(n,await all(n));
    const map=new Map(),indexes={};
    for(const raw of found){
      if(!raw||typeof raw.id!=='string'||raw.id.length>150||map.has(raw.id))
        throw Error('Lokale Sicherung: ungültige oder doppelte Datensatz-ID in '+n);
      // Detached JSON plain data; never mutate IndexedDB objects.
      const copy=JSON.parse(JSON.stringify(raw));
      const hash=await unityIncHash(copy);
      map.set(copy.id,{record:copy,hash});
      indexes[copy.id]=hash;
    }
    records[n]=map;manifest[n]=indexes;
  }
  return {records,manifest,snapshotHash:await unityIncHash(manifest)};
}
function unityIncCheckCheckpoint(s){
  if(!s)return false;
  if(typeof s.manifest!=='object'||!s.manifest)return false;
  return STORES.every(n=>s.manifest[n]&&typeof s.manifest[n]==='object'&&
    Object.values(s.manifest[n]).every(unityIncIsSha));
}
async function unityIncPrepare(){
  const state=unityIncBackupState();
  const prev=unityIncCheckCheckpoint(state)?state:null;
  const current=await unityIncLocalSnapshot();
  const changes={},removed={};
  let count=0,removedCount=0;
  for(const n of STORES){
    const old=prev?.manifest[n]||{},after=current.manifest[n];
    changes[n]=[];removed[n]=[];
    for(const [id,hash] of Object.entries(after)){
      if(old[id]!==hash){
        const entry=current.records[n].get(id);
        changes[n].push({id,hash,record:entry.record});
        count++;
      }
    }
    for(const id of Object.keys(old))if(!(id in after)){
      removed[n].push(id);
      removedCount++;
    }
    changes[n].sort((a,b)=>a.id.localeCompare(b.id));
    removed[n].sort();
  }
  if(prev&&count===0&&removedCount===0)return null;
  const date=new Date().toISOString(),seq=date.replace(/[:.]/g,'-');
  const uid=typeof crypto.randomUUID==='function'?crypto.randomUUID():('local-'+Date.now()+'-'+Math.random().toString(36).slice(2));
  const snapshot={
    format:UNITY_INC_FORMAT,schema:UNITY_INC_SCHEMA,
    exportedAt:date,backupId:uid,base:!prev,
    parentId:prev?.lastBackupId||null,parentHash:prev?.snapshotHash||null,
    changes,removed,manifest:current.manifest,snapshotHash:current.snapshotHash
  };
  const name='UNITY-LAB-CLOUD-'+seq+(prev?'-AENDERUNG':'-BASIS')+'.json';
  const file=new File([JSON.stringify(snapshot)],name,{type:'application/json'});
  const checkpoint={id:UNITY_INC_STATE_ID,format:UNITY_INC_FORMAT,schema:UNITY_INC_SCHEMA,
    lastBackupId:uid,snapshotHash:current.snapshotHash,manifest:current.manifest,
    lastExportAt:date};
  return {file,snapshot,checkpoint,count,removedCount,base:!prev};
}
async function unityIncConfirmSaved(){
  if(!unityIncPending)throw Error('Keine unbestätigte Änderungssicherung vorhanden.');
  if(!confirm('Ist die Datei "'+unityIncPending.file.name+'" tatsächlich im privaten pCloud-Ordner gespeichert?\n\nNur mit „OK“ setzen wir den Prüfpunkte-Zähler fort. Eine fehlende Datei würde spätere Wiederherstellungen verhindern.'))return;
  // Do not count this confirmation as a new data mutation: state lives outside snapshots.
  await put('settings',unityIncPending.checkpoint);
  const saved=unityIncPending;
  unityIncPending=null;
  await refresh();
  unityBackupStatus('Inkrementeller Stand bestätigt: '+saved.file.name+
    '. Beim nächsten Mal werden nur neue oder geänderte Inhalte exportiert.');
}
async function unityIncShare(){
  if(unityIncPending){
    unityBackupStatus('Die Datei '+unityIncPending.file.name+' ist noch nicht bestätigt. Bitte in pCloud prüfen und anschließend „Speicherung bestätigen“ wählen.');
    return;
  }
  unityBackupStatus('Vergleiche lokale Daten anhand von SHA-256-Prüfsummen …');
  const prepared=await unityIncPrepare();
  if(!prepared){
    unityBackupStatus('Keine Änderungen seit der letzten bestätigten Sicherung. Keine neue Datei erforderlich.');
    return;
  }
  const file=prepared.file;
  const kind=prepared.base?'erste Basissicherung':'Änderungssicherung';
  unityIncPending=prepared;
  if(typeof navigator!=='undefined'&&typeof navigator.share==='function'&&
    (typeof navigator.canShare!=='function'||navigator.canShare({files:[file]}))){
    try{
      await navigator.share({files:[file],title:'UNITY LAB · '+kind,
        text:'Diese Datei im selben privaten pCloud-Sicherungsordner wie die vorherigen UNITY-LAB-CLOUD-Dateien ablegen.'});
      unityBackupStatus(file.name+' bereitgestellt · '+prepared.count+' neue/geänderte, '+
        prepared.removedCount+' entfernte Datensätze. Nach Kontrolle in pCloud „Speicherung bestätigen“ wählen.');
      const b=document.getElementById('inc-confirm');if(b)b.hidden=false;
      return;
    }catch(e){
      if(e?.name==='AbortError'){
        unityIncPending=null;
        unityBackupStatus('Teilen abgebrochen. Der letzte bestätigte Sicherungsstand wurde nicht verändert.');
        return;
      }
      console.warn('Inkrementelle Sicherung: Teilen nicht verfügbar',e);
    }
  }
  unityDownloadBackup(file);
  unityBackupStatus(file.name+' als Download bereitgestellt. Datei in denselben privaten pCloud-Ordner legen; erst danach „Speicherung bestätigen“ wählen.');
  const b=document.getElementById('inc-confirm');if(b)b.hidden=false;
}
function unityIncSummary(){
  const state=unityIncBackupState();
  return state?'<small>Letzter bestätigter Änderungssatz: '+esc(state.lastExportAt||'unbekannt')+
    ' · zusätzliche Sicherungen enthalten nur Änderungen.</small>':
    '<small>Noch kein bestätigter inkrementeller Sicherungsstand. Der erste Export enthält alle Datensätze.</small>';
}
function unityIncCheckObject(doc){
  if(!doc||doc.format!==UNITY_INC_FORMAT||doc.schema!==UNITY_INC_SCHEMA||
    typeof doc.backupId!=='string'||!doc.backupId||typeof doc.base!=='boolean'||
    !unityIncIsSha(doc.snapshotHash)||!doc.manifest||
    !doc.changes||!doc.removed||typeof doc.exportedAt!=='string')
    throw Error('Ungültiger oder unvollständiger inkrementeller Sicherungssatz.');
  if(!STORES.every(n=>Array.isArray(doc.changes[n])&&Array.isArray(doc.removed[n])&&
    doc.manifest[n]&&typeof doc.manifest[n]==='object'))
    throw Error('Unvollständige Datensatzgruppen im Änderungssatz.');
  if(Object.keys(doc.manifest).length!==STORES.length)throw Error('Unbekannter Sicherungsindex.');
}
async function unityIncAssemble(files){
  if(!files?.length)throw Error('Bitte alle Dateien einer Sicherungskette auswählen – beginnend mit der Basissicherung.');
  if(files.length>200)throw Error('Zu viele Änderungsdateien. Bitte zuerst eine neue Basissicherung erstellen.');
  let size=0;const docs=[];
  for(const f of files){
    size+=f.size;
    if(f.size>50e6||size>200e6)throw Error('Sicherungssatz ist größer als der zulässige Prüfbereich.');
    const doc=JSON.parse(await f.text());
    unityIncCheckObject(doc);
    docs.push(doc);
  }
  const bases=docs.filter(d=>d.base);
  if(bases.length!==1)throw Error('Genau eine Basissicherung ist erforderlich.');
  const known=new Set(),byParent=new Map();
  for(const d of docs){
    if(known.has(d.backupId))throw Error('Doppelte Sicherungs-ID.');
    known.add(d.backupId);
    if(!d.base){
      if(typeof d.parentId!=='string'||!unityIncIsSha(d.parentHash))throw Error('Fehlender Vorgänger im Änderungsindex.');
      const chain=byParent.get(d.parentId)||[];
      chain.push(d);byParent.set(d.parentId,chain);
    }else if(d.parentId!==null||d.parentHash!==null)throw Error('Basissicherung darf keinen Vorgänger haben.');
  }
  const ordered=[bases[0]];
  while(true){
    const previous=ordered.at(-1),next=byParent.get(previous.backupId)||[];
    if(!next.length)break;
    if(next.length!==1||next[0].parentHash!==previous.snapshotHash)
      throw Error('Mehrdeutiger oder beschädigter Sicherungsverlauf.');
    ordered.push(next[0]);
    if(ordered.length>docs.length)throw Error('Zyklischer Sicherungsverlauf.');
  }
  if(ordered.length!==docs.length)throw Error('Die Sicherungskette ist unvollständig. Alle früheren Änderungssätze auswählen.');
  const records=Object.fromEntries(STORES.map(n=>[n,new Map()]));
  for(const doc of ordered){
    for(const n of STORES){
      const changed=new Set();
      for(const item of doc.changes[n]){
        if(!item||typeof item.id!=='string'||item.id.length>150||
          !item.record||item.record.id!==item.id||!unityIncIsSha(item.hash)||
          changed.has(item.id)||item.id===UNITY_INC_STATE_ID)
          throw Error('Ungültiger oder doppelter Datenblock in '+n);
        changed.add(item.id);
        if(await unityIncHash(item.record)!==item.hash)throw Error('SHA-256-Prüfsummenfehler bei '+n+'/'+item.id);
        records[n].set(item.id,{hash:item.hash,record:item.record});
      }
      for(const id of doc.removed[n]){
        if(typeof id!=='string'||id.length>150||changed.has(id)||!records[n].has(id))
          throw Error('Ungültige Löschmarkierung in '+n);
        changed.add(id);records[n].delete(id);
      }
    }
    const verify={};
    for(const n of STORES){
      verify[n]=Object.fromEntries([...records[n]].map(([id,x])=>[id,x.hash]));
      if(unityIncStable(verify[n])!==unityIncStable(doc.manifest[n]))
        throw Error('Sicherungsindex stimmt nicht mit den Datenteilen überein: '+n);
    }
    if(await unityIncHash(verify)!==doc.snapshotHash)
      throw Error('Prüfsumme des Sicherungsindex stimmt nicht.');
  }
  return {head:ordered.at(-1),records,parts:ordered.length};
}
async function unityIncRestore(){
  const chosen=[...(document.getElementById('inc-import-file')?.files||[])];
  const merged=await unityIncAssemble(chosen);
  const inserts={}, conflicts=[], totals={};
  for(const n of STORES){
    const existing=new Map((await all(n)).map(v=>[v.id,v]));
    inserts[n]=[];totals[n]=merged.records[n].size;
    for(const [id,{record}] of merged.records[n]){
      if(existing.has(id)){
        if(unityIncStable(existing.get(id))!==unityIncStable(record))
          conflicts.push(n+'/'+id);
      }else inserts[n].push(record);
    }
  }
  if(conflicts.length)throw Error('Wiederherstellung nicht durchgeführt: '+conflicts.length+
    ' lokale Datensätze unterscheiden sich vom Backup (z. B. '+conflicts[0]+
    '). Bestehende Daten werden nie automatisch überschrieben. Bitte auf einem separaten Teststand wiederherstellen.');
  const count=Object.values(inserts).reduce((s,a)=>s+a.length,0);
  if(!count){
    alert('Sicherung geprüft: '+merged.parts+' Dateien, alle Datensätze bereits vorhanden. Keine Änderungen.');
    return;
  }
  if(!confirm(merged.parts+' Sicherungsdateien sind vollständig und mit SHA-256 geprüft.\n'+
    count+' bisher fehlende Datensätze ergänzen? Vorhandene Daten bleiben unverändert.'))return;
  await bulkInsert(inserts);
  await refresh();
  alert('Wiederherstellung erfolgreich: '+count+' Datensätze ergänzt. Vorhandene Einträge wurden nicht überschrieben.');
}
