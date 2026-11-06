'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm');
const nodeCrypto=require('node:crypto');
const {TextEncoder,TextDecoder}=require('node:util');
const protocol=require('../exchange-protocol.js');
const safe=require('../exchange-crypto.js');
const inspector=require('../worker/inspect-exchange.cjs');
const pass='LocalOnly-NeverReuse-0329!';
const digest=async str=>nodeCrypto.createHash('sha256').update(str).digest('hex');
const packet={
  format:protocol.FORMAT,schema:1,originId:'d38f7d29-18c7-4a70-875a-51492891d1c0',
  revision:1,exportedAt:'2026-11-06T13:00:00.000Z',purpose:'review-only',
  authority:'local-iphone',executionPermission:false,
  payload:{
    budget:{limitEur:900,spentEur:100},
    instruments:[{id:'a',assetClass:'equity',name:'CONFIDENTIAL DEMO',isin:'TEST00000001',
      ticker:'XYZ',exchange:'XETR',currency:'EUR'}],
    orders:[{id:'private-order',instrumentId:'a',side:'BUY',mode:'strict',active:true,
      createdAt:'2026-11-06T13:00:00.000Z',amountEur:500,triggerDate:null}],
    trades:[{id:'private-trade',instrumentId:'a',side:'BUY',executedAt:'2026-11-06T13:00:00.000Z',
      quantity:1,price:99,fx:1,fee:1,source:'UNITY Lab · Auto-Testkauf'}]
  }
};
const encryptedObj=x=>JSON.parse(JSON.stringify(x));
(async()=>{
  const sealed=await protocol.seal(packet,digest);
  assert.equal(safe.ITERATIONS>=250000,true);
  assert.equal(safe.MIN_PASSWORD_LENGTH,12);
  assert.throws(()=>safe.validPassword('short'),/mindestens 12/);
  const outer=await safe.encrypt(sealed,pass,nodeCrypto.webcrypto,protocol,digest);
  assert.equal(outer.format,'unity-exchange-encrypted');
  assert.equal(outer.schema,1);
  assert.equal(outer.purpose,'review-only');
  assert.equal(outer.iterations,310000);
  assert.equal(Object.prototype.hasOwnProperty.call(outer,'payload'),false);
  const serialized=JSON.stringify(outer);
  for(const term of ['CONFIDENTIAL DEMO','private-order','private-trade','TEST00000001']){
    assert.equal(serialized.includes(term),false,'Ciphertext leaked '+term);
  }
  assert.equal(serialized.includes(pass),false,'Never persist a passphrase');
  const back=await safe.decrypt(outer,pass,nodeCrypto.webcrypto,protocol,digest);
  assert.equal(back.verified.valid,true);
  assert.equal(back.packet.payload.orders[0].amountEur,500);
  assert.equal(back.packet.sha256,sealed.sha256);
  const second=await safe.encrypt(sealed,pass,nodeCrypto.webcrypto,protocol,digest);
  assert.notEqual(second.salt,outer.salt);
  assert.notEqual(second.iv,outer.iv);
  assert.notEqual(second.ciphertext,outer.ciphertext);
  await assert.rejects(safe.decrypt(outer,'wrong-passphrase-000',nodeCrypto.webcrypto,protocol,digest),
    /Falsches Passwort oder Datei verändert/);
  for(const [field,value] of [['ciphertext','A'+outer.ciphertext.slice(1)],
    ['purpose','allow-execution'],['iterations',1],['algorithm','AES-128-CBC'],['schema',99],
    ['iv','AAAA'],['salt','BBBB']]){
    const altered={...outer,[field]:value};
    await assert.rejects(safe.decrypt(altered,pass,nodeCrypto.webcrypto,protocol,digest),
      /UNITY Verschlüsselung:/,'Tamper veto '+field);
  }
  await assert.rejects(safe.encrypt({...sealed,executionPermission:true},pass,
    nodeCrypto.webcrypto,protocol,digest),/Ausführungsfreigabe/);
  // Browser implementation must work with btoa/atob rather than Node Buffer.
  const window={};
  const ctx={globalThis:window,TextEncoder,TextDecoder,Uint8Array,
    btoa:buf=>Buffer.from(buf,'binary').toString('base64'),
    atob:base64=>Buffer.from(base64,'base64').toString('binary')};
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync('exchange-protocol.js','utf8'),ctx);
  vm.runInContext(fs.readFileSync('exchange-crypto.js','utf8'),ctx);
  assert.equal(window.UNITY_EXCHANGE_CRYPTO.FORMAT,safe.FORMAT);
  // Both modules and parsed data must share a Safari-like JS realm.
  const browserPacket=vm.runInContext('JSON.parse(packetJson)',Object.assign(ctx,{
    packetJson:JSON.stringify(sealed)}));
  const inBrowser=await window.UNITY_EXCHANGE_CRYPTO.encrypt(browserPacket,pass,
    nodeCrypto.webcrypto,window.UNITY_EXCHANGE_PROTOCOL,digest);
  const opened=await safe.decrypt(inBrowser,pass,nodeCrypto.webcrypto,protocol,digest);
  assert.equal(opened.verified.revision,1);
  const openedBrowser=await window.UNITY_EXCHANGE_CRYPTO.decrypt(outer,pass,
    nodeCrypto.webcrypto,window.UNITY_EXCHANGE_PROTOCOL,digest);
  assert.equal(openedBrowser.verified.orders,1);
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'unity-encrypted-'));
  try{
    const a=path.join(temporary,'private.json'),b=path.join(temporary,'other.json');
    fs.writeFileSync(a,serialized,{mode:0o600});
    fs.writeFileSync(b,JSON.stringify(second),{mode:0o600});
    let passwords=0;
    const provider=async filename=>{passwords++;assert.ok(filename.endsWith('.json'));return pass};
    const local=await inspector.inspect(a,b,provider);
    assert.equal(passwords,2,'Two protected files each require authorization');
    assert.equal(local.encryption,'AES-256-GCM');
    assert.equal(local.secondEncryption,'AES-256-GCM');
    assert.equal(local.sameOrigin,true);
    assert.equal(local.executionEnabled,false);
    assert.equal(local.privateOrdersStored,false);
    assert.equal(local.differences[1].conflicts,0);
    fs.writeFileSync(b,JSON.stringify({...second,ciphertext:'AA'+second.ciphertext.slice(2)}));
    await assert.rejects(inspector.inspect(b,undefined,provider),
      /Falsches Passwort oder Datei verändert/);
  }finally{fs.rmSync(temporary,{recursive:true,force:true})}
  console.log('Encrypted UNITY exchange: AES-256-GCM/PBKDF2, random per-file salt/IV, authenticated headers, browser/Node roundtrip, PC preview, wrong password and tamper veto passed.');
})().catch(err=>{console.error(err);process.exitCode=1});
