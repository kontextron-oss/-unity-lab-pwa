'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm');
const crypto=require('node:crypto');
const api=require('../exchange-protocol.js'),cli=require('../worker/inspect-exchange.cjs');
const sha=async s=>crypto.createHash('sha256').update(s).digest('hex');
const timestamp='2026-11-06T13:00:00.000Z';
const raw={
  budget:{limitEur:500,spentEur:100},
  instruments:[{id:'abb',name:'ABB',assetClass:'equity',isin:'CH0012221716',
    ticker:'ABBN',exchange:'XSWX',currency:'CHF'}],
  orders:[{id:'auto-test-buy:abb',instrumentId:'abb',side:'BUY',mode:'technical',
    active:true,amountEur:100,createdAt:timestamp,triggerDate:'2026-11-05'}],
  trades:[{id:'auto-fill:abb:1',instrumentId:'abb',side:'BUY',price:100,
    quantity:1,fx:.9,fee:1,source:'UNITY Lab · Auto-Testkauf',executedAt:timestamp}]
};
const envelope={format:api.FORMAT,schema:api.SCHEMA,originId:'d38f7d29-18c7-4a70-875a-51492891d1c0',
  revision:2,exportedAt:timestamp,purpose:'review-only',authority:'local-iphone',
  executionPermission:false,payload:raw};
const clone=x=>JSON.parse(JSON.stringify(x));
(async()=>{
 assert.equal(api.MAX_BYTES,5*1024*1024);
 const sealed=await api.seal(envelope,sha),proof=await api.verify(sealed,sha);
 assert.equal(proof.orders,1);
 assert.equal(proof.trades,1);
 assert.equal(proof.executionPermission,false);
 assert.equal(proof.limit,500);
 assert.equal(api.canonical({b:2,a:1}),api.canonical({a:1,b:2}));
 const alt=clone(sealed);
 alt.payload.orders[0].amountEur=400;
 await assert.rejects(api.verify(alt,sha),/Prüfsumme/,'Changed amount must invalidate hash');
 const malicious=clone(sealed);malicious.executionPermission=true;
 await assert.rejects(api.verify(malicious,sha),/Ausführungsfreigabe/);
 const extra=clone(sealed);extra.remoteExecutionEnabled=true;
 await assert.rejects(api.verify(extra,sha),/Unerwartete Paketfelder/);
 const cryptoPacket=clone(envelope);cryptoPacket.payload.instruments[0].assetClass='crypto';
 await assert.rejects(api.seal(cryptoPacket,sha),/Instrument ungültig/);
 const duplicate=clone(envelope);duplicate.payload.orders.push(clone(duplicate.payload.orders[0]));
 await assert.rejects(api.seal(duplicate,sha),/Doppelte Auftrags-ID/);
 const unknown=clone(envelope);unknown.payload.orders[0].secret='password';
 await assert.rejects(api.seal(unknown,sha),/Auftragsfelder/);
 const wallet=clone(envelope);wallet.payload.trades[0].source='UNKNOWN';
 await assert.rejects(api.seal(wallet,sha),/Buchungsinhalt/);
 const sell=clone(envelope);
 sell.payload.orders[0].side='SELL';sell.payload.orders[0].amountEur=null;
 sell.payload.trades[0].side='SELL';sell.payload.trades[0].source='UNITY Lab · Auto-Testverkauf';
 await api.verify(await api.seal(sell,sha),sha);
 const differing=clone(envelope);
 differing.payload.trades[0].quantity=2;
 differing.payload.orders.push({id:'auto-test-sell:abb',instrumentId:'abb',side:'SELL',
    mode:'technical',createdAt:timestamp,active:true,amountEur:null,triggerDate:null});
 const diffs=api.compare(envelope.payload,differing.payload);
 assert.equal(diffs[1].onlyRemote,1);
 assert.equal(diffs[2].conflicts,1);
 // No personal data is written to repository; test reads only a temporary file.
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'unity-exchange-test-'));
 try{
   const a=path.join(tmp,'a.json'),b=path.join(tmp,'b.json');
   fs.writeFileSync(a,JSON.stringify(sealed),{mode:0o600});
   fs.writeFileSync(b,JSON.stringify(await api.seal(differing,sha)),{mode:0o600});
   const inspected=await cli.inspect(a,b);
   assert.equal(inspected.valid,true);
   assert.equal(inspected.executionEnabled,false);
   assert.equal(inspected.privateOrdersStored,false);
   assert.equal(inspected.differences[2].conflicts,1);
   fs.writeFileSync(b,JSON.stringify(alt));
   await assert.rejects(cli.inspect(b),/Prüfsumme/);
 }finally{fs.rmSync(tmp,{recursive:true,force:true})}
 // Shared script must also expose the same surface to Safari without Node.
 const window={};const sandbox={globalThis:window};
 vm.runInNewContext(fs.readFileSync('exchange-protocol.js','utf8'),sandbox);
 assert.equal(window.UNITY_EXCHANGE_PROTOCOL.FORMAT,api.FORMAT);
 const idx=fs.readFileSync('index.html','utf8'),sw=fs.readFileSync('sw.js','utf8');
 assert.match(idx,/exchange-ui\.js\?v=0\.15\.3\.9/);
 assert.match(idx,/unity-exchange-prepare/);
 assert.match(idx,/unity-exchange-inspect-file/);
 assert.match(sw,/unity-lab-v0\.15\.3\.9/);
 assert.match(sw,/exchange-protocol\.js\?v=0\.15\.3\.9/);
 console.log('UNITY exchange 0.15.3.9: browser/Node protocol, SHA256 integrity, manual review-only data, conflicts, tamper and crypto/remote-execution veto passed.');
})().catch(err=>{console.error(err);process.exitCode=1});
