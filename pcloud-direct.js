'use strict';
/*
 UNITY LAB direct pCloud upload client (gateway-backed, feature-gated).
 No personal finance data or credentials can be sent while gateway is absent.
 The actual gateway/OAuth must be deployed and authorized separately; GitHub
 Pages is static and cannot hold server secrets. All writes fail closed.
 */
const UNITY_PCLOUD_GATEWAY = ''; // Intentionally disabled until same-origin private gateway is deployed.
let unityCloudConnected=false,unityCloudChecked=false,unityCloudBusy=false,unityCloudStatusMessage='';
function unityCloudIsConfigured(){
  if(!UNITY_PCLOUD_GATEWAY)return false;
  // Avoid third-party cookie blocking and token leakage: only same origin.
  try{
    const url=new URL(UNITY_PCLOUD_GATEWAY,location.origin);
    return url.protocol==='https:' && url.origin===location.origin &&
      url.pathname.startsWith('/api/pcloud');
  }catch(_){return false}
}
function unityCloudEndpoint(segment){
  if(!unityCloudIsConfigured())throw Error('Direkte pCloud-Sicherung ist noch nicht eingerichtet.');
  if(!/^\/[a-z/-]+$/.test(segment))throw Error('Ungültiger Cloud-Endpunkt.');
  return new URL(UNITY_PCLOUD_GATEWAY.replace(/\/$/,'')+segment,location.origin).toString();
}
function unityCloudStatusHtml(){
  if(!unityCloudIsConfigured())
    return '<p class="tiny muted"><b>Automatischer Upload:</b> technische Verbindung noch nicht aktiv. Die bisherige sichere Dateifreigabe bleibt verwendbar.</p>';
  const state=unityCloudBusy?'Übertragung läuft …':!unityCloudChecked?'Verbindung wird geprüft …':
    unityCloudConnected?'pCloud verbunden':'pCloud noch nicht verbunden';
  return '<p class="tiny muted"><b>Direkte Verbindung:</b> '+esc(state)+'</p>'+
    (unityCloudStatusMessage?'<p class="tiny muted">'+esc(unityCloudStatusMessage)+'</p>':'')+
    '<div class="unity-backup-actions">'+
    (unityCloudConnected?'<button type="button" class="primary" id="cloud-direct-upload" '+
      (unityCloudBusy?'disabled':'')+'>Jetzt direkt in pCloud sichern</button>':
      '<button type="button" class="secondary" id="cloud-direct-connect">pCloud einmal verbinden</button>')+
    '</div>';
}
async function unityCloudCheck(){
  if(!unityCloudIsConfigured())return false;
  try{
    const r=await fetch(unityCloudEndpoint('/connection'),{
      credentials:'include',cache:'no-store',headers:{'Accept':'application/json'}});
    if(!r.ok)throw Error('HTTP '+r.status);
    const data=await r.json();
    unityCloudConnected=data?.connected===true;
    unityCloudStatusMessage=unityCloudConnected?'Privater pCloud-Zugang autorisiert.':'Ersteinrichtung: einmalige Freigabe notwendig.';
  }catch(_){
    unityCloudConnected=false;
    unityCloudStatusMessage='Die private Verbindung ist derzeit nicht erreichbar. Kein Upload durchgeführt.';
  }
  unityCloudChecked=true;
  const el=document.getElementById('unity-cloud-auto-status');
  if(el)el.innerHTML=unityCloudStatusHtml();
  return unityCloudConnected;
}
function unityCloudConnect(){
  if(!unityCloudIsConfigured())throw Error('Direkte pCloud-Verbindung ist noch nicht eingerichtet.');
  // Strict same-origin endpoint; authorization then takes place on pCloud's site.
  location.assign(unityCloudEndpoint('/auth/start'));
}
async function unityCloudFileHash(file){
  const buf=await file.arrayBuffer();
  const digest=await crypto.subtle.digest('SHA-256',buf);
  return Array.from(new Uint8Array(digest)).map(n=>n.toString(16).padStart(2,'0')).join('');
}
function unityCloudReceiptValid(receipt,prepared,rawHash){
  return !!(receipt&&receipt.storage==='pcloud'&&receipt.verified===true&&
    receipt.backupId===prepared.snapshot.backupId&&
    receipt.snapshotHash===prepared.snapshot.snapshotHash&&
    receipt.fileName===prepared.file.name&&
    receipt.byteSize===prepared.file.size&&
    receipt.sha256===rawHash&&
    ((Number.isSafeInteger(receipt.fileId)&&receipt.fileId>0)||
      (typeof receipt.fileId==='string'&&/^[0-9]{1,20}$/.test(receipt.fileId)&&receipt.fileId!=='0')));
}
async function unityCloudUpload(){
  if(!unityCloudIsConfigured())throw Error('Direkte pCloud-Verbindung ist noch nicht eingerichtet.');
  if(!unityCloudConnected)throw Error('Bitte pCloud zunächst einmal autorisieren.');
  if(unityCloudBusy)throw Error('Eine Sicherung läuft bereits.');
  if(unityIncPending)throw Error('Eine manuelle Sicherung ist noch unbestätigt. Bitte diese zuerst prüfen.');
  unityCloudBusy=true;
  const area=document.getElementById('unity-cloud-auto-status');
  if(area)area.innerHTML=unityCloudStatusHtml();
  try{
    unityBackupStatus('Änderungen werden vorbereitet und sicher geprüft …');
    const prepared=await unityIncPrepare();
    if(!prepared){
      unityBackupStatus('Keine neuen Änderungen seit der letzten bestätigten Sicherung.');
      return;
    }
    const bytes=await unityCloudFileHash(prepared.file);
    const body=new FormData();
    body.append('file',prepared.file,prepared.file.name);
    body.append('backupId',prepared.snapshot.backupId);
    body.append('snapshotHash',prepared.snapshot.snapshotHash);
    body.append('fileSha256',bytes);
    body.append('kind','incremental');
    // The same-origin gateway authenticates the session, checks CSRF and idempotency
    // and uploads the file to the already-authorized private pCloud folder.
    // The browser never sees an OAuth token.
    const r=await fetch(unityCloudEndpoint('/backups/incremental'),{
      method:'POST',credentials:'include',cache:'no-store',body,
      headers:{'Accept':'application/json'}});
    if(!r.ok)throw Error('Cloud-Übertragung abgebrochen (HTTP '+r.status+').');
    const receipt=await r.json();
    if(!unityCloudReceiptValid(receipt,prepared,bytes))
      throw Error('pCloud-Speicherung konnte nicht vollständig verifiziert werden.');
    // Restore safety: do not advance the cursor if data changed during upload.
    const after=await unityIncLocalSnapshot();
    if(after.snapshotHash!==prepared.snapshot.snapshotHash)
      throw Error('Während der Sicherung wurden lokale Daten verändert. Die Cloud-Datei liegt vor; für neue Änderungen bitte erneut sichern.');
    await put('settings',prepared.checkpoint);
    await refresh();
    unityBackupStatus('pCloud bestätigt · '+prepared.file.name+' · '+new Date().toLocaleString('de-DE'));
  }catch(err){
    unityBackupStatus('Nicht als gesichert bestätigt: '+String(err?.message||err)+
      '. Bisheriger Sicherungsstand bleibt erhalten.');
    throw err;
  }finally{
    unityCloudBusy=false;
    const el=document.getElementById('unity-cloud-auto-status');
    if(el)el.innerHTML=unityCloudStatusHtml();
  }
}
