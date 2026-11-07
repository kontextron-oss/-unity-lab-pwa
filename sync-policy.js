'use strict';
/* UNITY future auto sync readiness policy.
 * Pure decision model, no OAuth tokens, browser storage, fetch, mutation
 * or real scheduler. Never equate a pCloud app client ID with authorization.
 * iOS PWAs sync on app open/online/focus, NOT guaranteed when closed.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.UNITY_SYNC_POLICY=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 const VERSION=1;
 const ACTIONS=Object.freeze({
  DISABLED:'disabled',OFFLINE:'offline',PAUSED:'paused',
  AUTH:'authorize-pcloud',UNLOCK:'unlock-encryption',
  CHECK:'read-remote-manifest',CONFLICT:'review-conflicts',
  RECONCILE:'plan-verified-merge',UP_TO_DATE:'up-to-date',
  UPLOAD:'prepare-upload-after-cas',RETRY:'retry-after-backoff'
 });
 function result(action,reason,canTransfer=false){
  return {kind:'unity-auto-sync-policy-v1',version:VERSION,action,reason,
   canTransfer,canOverwriteWithoutReview:false,
   canDeleteWithoutReview:false,canExecuteOrders:false,
   hasExecuted:false,hasCalledPcloud:false};
 }
 function evaluate(x={}){
  if(x.enabled!==true)return result(ACTIONS.DISABLED,'Automatische Synchronisation noch nicht vom Benutzer aktiviert');
  if(x.appOpen!==true)return result(ACTIONS.PAUSED,'iPhone-PWA nicht aktiv; kein garantierter Hintergrundbetrieb');
  if(x.offline===true)return result(ACTIONS.OFFLINE,'Offline-Änderungen lokal behalten');
  if(x.paused===true||x.inFlight===true)return result(ACTIONS.PAUSED,'Pausiert oder bereits laufender Synchronisationsvorgang');
  if(x.authorized!==true||x.accountConfirmed!==true||
    x.providerHost!=='eapi.pcloud.com'&&x.providerHost!=='api.pcloud.com')
    return result(ACTIONS.AUTH,'pCloud-Zugriff fehlt oder nicht kontogebunden geprüft');
  if(x.deviceAuthorized!==true)return result(ACTIONS.AUTH,'Vertrauenswürdiges Gerät noch nicht autorisiert');
  if(x.encryptionReady!==true)return result(ACTIONS.UNLOCK,'Für automatische Änderungen fehlt eine sicher freigegebene Verschlüsselung');
  if(x.manifestReadFresh!==true||x.remoteVersionChecked!==true)
    return result(ACTIONS.CHECK,'Aktuellen pCloud-Manifeststand lesen und Revision prüfen');
  if(!Number.isSafeInteger(x.conflictCount)||x.conflictCount<0||
    x.conflictCount>0||x.deletionCount>0)
    return result(ACTIONS.CONFLICT,'Abweichende Versionen oder Löschungen manuell klären');
  if(x.validatedMergePlan!==true||x.recordSchemaChecked!==true)
    return result(ACTIONS.RECONCILE,'Sicheren drei-Wege-Abgleich prüfen');
  if(x.localChanges!==true&&x.remoteChanges!==true)
    return result(ACTIONS.UP_TO_DATE,'Beide Datenstände identisch');
  if(x.providerSupportsCAS!==true||x.remoteVersionCASChecked!==true)
    return result(ACTIONS.RECONCILE,
     'Keine sichere atomare Konfliktsperre für parallel bearbeitete Cloud-Dateien');
  if(x.verifiedEncryptedPayload!==true)
    return result(ACTIONS.RECONCILE,'Verschlüsselte und signierte/identitätsgeprüfte Nutzdaten fehlen');
  if(x.backoffActive===true)
    return result(ACTIONS.RETRY,'Verzögerung nach Verbindungsfehler aktiv');
  if(x.remoteChanges===true)
    return result(ACTIONS.RECONCILE,
     'Remote-Änderungen noch nicht sicher lokal angewendet; erst nach Transaktionsprüfung bestätigen');
  return result(ACTIONS.UPLOAD,
   'Nur bei extern verifiziertem Upload-Receipt und danach erneut bestätigter Revision übernehmen',
   true);
 }
 return {VERSION,ACTIONS,evaluate};
});
