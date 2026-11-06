'use strict';
/*
 * UNITY 0.15.3.3 – encrypted manual, explicit read-only test-order export.
 * This never connects to a remote server or writes imported records.
 * The existing incremental/full pCloud backup flow remains untouched.
 */
const UNITY_EXCHANGE_META_ID='unity-exchange-export-meta-v1';
let unityExchangePending=null;
const unityExchangeMoney=n=>Math.round(Number(n)*100)/100;
function unityExchangeCurrentPayload(){
  if(typeof cache==='undefined')throw Error('UNITY Daten noch nicht geladen');
  const allStock=cache.instruments||[],orders=(cache.settings||[]).filter(x=>
    x.active&&!x.executedAt&&(x.kind==='auto-test-buy'||x.kind==='auto-test-sell'));
  const trades=(cache.transactions||[]).filter(x=>!x.voidedAt&&
    (x.source==='UNITY Lab · Auto-Testkauf'||x.source==='UNITY Lab · Auto-Testverkauf'));
  const involved=new Set([...orders,...trades].map(x=>x.instrumentId));
  const instruments=allStock.filter(x=>involved.has(x.id)).map(s=>{
    if(typeof unityIsCryptoAsset==='function'&&unityIsCryptoAsset(s))
      throw Error('Kryptowährungen bleiben bewusst außerhalb der Aktien-Testautomatik');
    return {id:String(s.id),assetClass:'equity',name:String(s.name||''),isin:String(s.isin||''),
      ticker:String(s.ticker||''),exchange:String(s.exchange||''),currency:String(s.currency||'')};
  }).sort((a,b)=>a.id.localeCompare(b.id));
  if(instruments.length!==involved.size)throw Error('Austausch nicht möglich: Aufträge ohne zugehörigen Aktien-Datensatz');
  const pending=orders.map(o=>({
    id:String(o.id),instrumentId:String(o.instrumentId),
    side:o.kind==='auto-test-buy'?'BUY':'SELL',mode:o.mode==='strict'?'strict':'technical',
    active:true,createdAt:String(o.createdAt||''),triggerDate:o.triggerQuoteDate||null,
    amountEur:o.kind==='auto-test-buy'?unityExchangeMoney(o.allocationEur):null
  })).sort((a,b)=>a.id.localeCompare(b.id));
  const ledger=trades.map(t=>({
    id:String(t.id),instrumentId:String(t.instrumentId),side:t.type,
    executedAt:String(t.executedAt||''),quantity:Number(t.quantity),price:Number(t.price),
    fx:Number(t.fx),fee:Number(t.fee)||0,source:t.source
  })).sort((a,b)=>a.id.localeCompare(b.id));
  const budgetRecord=(cache.settings||[]).find(x=>x.id==='auto-test-buy-total-budget');
  const spent=trades.filter(t=>t.source==='UNITY Lab · Auto-Testkauf').reduce(
    (n,t)=>n+(Number(t.amount)||0)*(Number(t.fx)||0)+(Number(t.fee)||0),0);
  const limit=budgetRecord?.limitEur===undefined?null:unityExchangeMoney(budgetRecord.limitEur);
  const result={budget:{limitEur:limit,spentEur:unityExchangeMoney(spent)},
    instruments,orders:pending,trades:ledger};
  UNITY_EXCHANGE_PROTOCOL.validatePayload(result);
  return result;
}
async function unityExchangeHash(s){
  if(!crypto?.subtle)throw Error('Sichere SHA-256-Prüfung ist in diesem Browser nicht verfügbar');
  const dig=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));
  return [...new Uint8Array(dig)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
function unityExchangeStatus(text){
  const el=document.getElementById('unity-exchange-status');
  if(el)el.textContent=text;
}
async function unityExchangePrepare(){
  // Repeated explicit preparation creates a NEW snapshot; never silently reuse
  // a stale file after the user edits an order or increases the budget.
  unityExchangePending=null;
  const oldShare=document.getElementById('unity-exchange-share');
  if(oldShare)oldShare.hidden=true;
  const passInput=document.getElementById('unity-exchange-password'),
    confirmInput=document.getElementById('unity-exchange-password-confirm');
  const passphrase=passInput?.value,confirmation=confirmInput?.value;
  UNITY_EXCHANGE_CRYPTO.validPassword(passphrase);
  if(passphrase!==confirmation)throw Error('Die beiden Austausch-Passwörter stimmen nicht überein.');
  unityExchangeStatus('Prüfe Testaufträge und verschlüssele den neuen Austauschstand lokal …');
  const payload=unityExchangeCurrentPayload(),prior=(cache.settings||[]).find(x=>x.id===UNITY_EXCHANGE_META_ID);
  const originId=prior?.originId&&/^[a-f0-9-]{36}$/i.test(prior.originId)?
    prior.originId:crypto.randomUUID(),revision=(Number.isSafeInteger(prior?.revision)?prior.revision:0)+1,
    exportedAt=new Date().toISOString();
  const envelope=await UNITY_EXCHANGE_PROTOCOL.seal({
    format:UNITY_EXCHANGE_PROTOCOL.FORMAT,schema:1,
    originId,revision,exportedAt,
    authority:'local-iphone',purpose:'review-only',executionPermission:false,payload
  },unityExchangeHash);
  await UNITY_EXCHANGE_PROTOCOL.verify(envelope,unityExchangeHash);
  let encrypted;
  try{
    encrypted=await UNITY_EXCHANGE_CRYPTO.encrypt(envelope,passphrase,crypto,
      UNITY_EXCHANGE_PROTOCOL,unityExchangeHash);
    // A complete authenticated test round-trip before any export metadata write.
    const checked=await UNITY_EXCHANGE_CRYPTO.decrypt(encrypted,passphrase,crypto,
      UNITY_EXCHANGE_PROTOCOL,unityExchangeHash);
    if(checked.verified.sha256!==envelope.sha256)
      throw Error('Verschlüsselter Austauschstand konnte nicht überprüft werden.');
  }finally{
    if(passInput)passInput.value='';
    if(confirmInput)confirmInput.value='';
  }
  // Local metadata only. No passwords, orders, trades or budget are changed.
  await put('settings',{id:UNITY_EXCHANGE_META_ID,originId,revision,
    lastExportedAt:exportedAt,lastSha256:envelope.sha256});
  if(Array.isArray(cache.settings)){
    const idx=cache.settings.findIndex(x=>x.id===UNITY_EXCHANGE_META_ID);
    const meta={id:UNITY_EXCHANGE_META_ID,originId,revision,lastExportedAt:exportedAt,
      lastSha256:envelope.sha256};
    if(idx<0)cache.settings.push(meta);else cache.settings[idx]=meta;
  }
  const file=new File([JSON.stringify(encrypted)],
    'UNITY-AUSTAUSCH-VERSCHLUESSELT_'+exportedAt.replace(/[:.]/g,'-')+'.json',
    {type:'application/json'});
  // Keep only encrypted bytes in the pending file; never persist a passphrase
  // or a plaintext exchange payload in the UI's pending-export state.
  unityExchangePending={file};
  const share=document.getElementById('unity-exchange-share');
  if(share)share.hidden=false;
  unityExchangeStatus('✓ Verschlüsselte Datei geprüft und vorbereitet · '+
    payload.instruments.length+' Aktien · '+payload.orders.length+' offene Aufträge · '+
    payload.trades.length+' Testbuchungen. Noch NICHT nach pCloud übertragen. '+
    'Passwort sicher getrennt aufbewahren; beim PC-Einlesen wieder eingeben.');
  return unityExchangePending;
}
function unityExchangeShare(){
  const pending=unityExchangePending;
  if(!pending)throw Error('Zuerst eine Austauschdatei vorbereiten');
  const file=pending.file;
  // Invoke iOS Share Sheet from a direct tap; no asynchronous preparatory read.
  if(navigator.canShare?.({files:[file]})&&navigator.share){
    const task=navigator.share({files:[file],title:'UNITY – Verschlüsselter Austausch · nur Prüfung'});
    Promise.resolve(task).then(()=>unityExchangeStatus(
      'Datei an iOS-Dateifreigabe übergeben. Bitte Ablage in pCloud selbst kontrollieren.'))
    .catch(e=>unityExchangeStatus(e?.name==='AbortError'?'Teilen abgebrochen – Datei weiterhin vorbereitet.':
      'Teilen fehlgeschlagen: '+e.message));
  }else{
    const url=URL.createObjectURL(file),a=document.createElement('a');
    a.href=url;a.download=file.name;document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),15000);
    unityExchangeStatus('Datei lokal bereitgestellt. Bitte bei Bedarf manuell nach pCloud übertragen.');
  }
}
async function unityExchangeInspectSelected(){
  const input=document.getElementById('unity-exchange-inspect-file'),file=input?.files?.[0];
  if(!file)throw Error('Bitte zunächst eine UNITY-Austauschdatei auswählen');
  if(file.size>UNITY_EXCHANGE_PROTOCOL.MAX_BYTES*1.8)throw Error('Datei zu groß – nicht eingelesen');
  unityExchangeStatus('Prüfe ausgewählte Datei und lese Unterschiede …');
  const selected=JSON.parse(await file.text()),passwordInput=
    document.getElementById('unity-exchange-inspect-password');
  let packet,report,protectedFile=false;
  try{
    if(UNITY_EXCHANGE_CRYPTO.isEncrypted(selected)){
      protectedFile=true;
      const result=await UNITY_EXCHANGE_CRYPTO.decrypt(selected,passwordInput?.value,crypto,
        UNITY_EXCHANGE_PROTOCOL,unityExchangeHash);
      packet=result.packet;report=result.verified;
    }else{
      // Read-only legacy packets remain inspectable, never accepted as authority.
      packet=selected;
      report=await UNITY_EXCHANGE_PROTOCOL.verify(packet,unityExchangeHash);
    }
  }finally{
    if(passwordInput)passwordInput.value='';
  }
  const diff=UNITY_EXCHANGE_PROTOCOL.compare(unityExchangeCurrentPayload(),packet.payload);
  const conflicts=diff.reduce((n,r)=>n+r.conflicts,0),missing=diff.reduce((n,r)=>n+r.onlyRemote,0);
  unityExchangeStatus('✓ '+(protectedFile?'Verschlüsselung und Prüfsumme gültig':
    'ALTE UNVERSCHLÜSSELTE DATEI · nur Integrität geprüft')+' · '+
    report.orders+' offene Aufträge · '+report.trades+
    ' automatische Testbuchungen · Unterschiede zum aktuellen iPhone: '+
    missing+' zusätzliche Datensätze, '+conflicts+' Konflikte. '+
    'NUR LESEN: Kein Auftrag importiert, keine Buchung ausgeführt, nichts überschrieben.');
}
