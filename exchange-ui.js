'use strict';
/*
 * UNITY 0.15.3.2 – manual, explicit private export of read-only test orders.
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
  if(unityExchangePending){
    unityExchangeStatus('Eine Austauschdatei liegt bereit. Bitte zuerst teilen oder erneut öffnen.');
    return unityExchangePending;
  }
  unityExchangeStatus('Prüfe lokale Testaufträge und erstelle SHA-256-Prüfsumme …');
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
  // Metadata only. No orders, trades or budget are changed.
  await put('settings',{id:UNITY_EXCHANGE_META_ID,originId,revision,
    lastExportedAt:exportedAt,lastSha256:envelope.sha256});
  if(Array.isArray(cache.settings)){
    const idx=cache.settings.findIndex(x=>x.id===UNITY_EXCHANGE_META_ID);
    const meta={id:UNITY_EXCHANGE_META_ID,originId,revision,lastExportedAt:exportedAt,
      lastSha256:envelope.sha256};
    if(idx<0)cache.settings.push(meta);else cache.settings[idx]=meta;
  }
  const file=new File([JSON.stringify(envelope,null,2)],
    'UNITY-AUSTAUSCH-NUR-PRUEFUNG_'+exportedAt.replace(/[:.]/g,'-')+'.json',
    {type:'application/json'});
  unityExchangePending={file,envelope};
  const share=document.getElementById('unity-exchange-share');
  if(share)share.hidden=false;
  unityExchangeStatus('✓ Datei vorbereitet · '+payload.instruments.length+' Aktien · '+
    payload.orders.length+' offene Aufträge · '+payload.trades.length+' Testbuchungen. '+
    'Noch NICHT nach pCloud übertragen. Über „Datei teilen“ selbst speichern.');
  return unityExchangePending;
}
function unityExchangeShare(){
  const pending=unityExchangePending;
  if(!pending)throw Error('Zuerst eine Austauschdatei vorbereiten');
  const file=pending.file;
  // Invoke iOS Share Sheet from a direct tap; no asynchronous preparatory read.
  if(navigator.canShare?.({files:[file]})&&navigator.share){
    const task=navigator.share({files:[file],title:'UNITY – Nur Prüfung, keine Orderfreigabe'});
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
  const packet=JSON.parse(await file.text());
  const report=await UNITY_EXCHANGE_PROTOCOL.verify(packet,unityExchangeHash);
  const diff=UNITY_EXCHANGE_PROTOCOL.compare(unityExchangeCurrentPayload(),packet.payload);
  const conflicts=diff.reduce((n,r)=>n+r.conflicts,0),missing=diff.reduce((n,r)=>n+r.onlyRemote,0);
  unityExchangeStatus('✓ Prüfsumme gültig · '+report.orders+' offene Aufträge · '+
    report.trades+' automatische Testbuchungen · Unterschiede zum aktuellen iPhone: '+
    missing+' zusätzliche Datensätze, '+conflicts+' Konflikte. '+
    'NUR LESEN: Kein Auftrag importiert, keine Buchung ausgeführt, nichts überschrieben.');
}
