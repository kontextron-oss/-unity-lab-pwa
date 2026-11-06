'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const nodeCrypto=require('node:crypto');
const {webcrypto}=nodeCrypto;
const {TextEncoder,TextDecoder}=require('node:util');
const protocol=require('../exchange-protocol.js');
const safe=require('../exchange-crypto.js');
const digest=async s=>nodeCrypto.createHash('sha256').update(s).digest('hex');
class TestFile{
  constructor(parts,name){this.name=name;this.parts=parts;this.size=Buffer.byteLength(parts.join(''),'utf8')}
  async text(){return this.parts.join('')}
}
const now='2026-11-06T11:50:00.000Z',pass='Only-For-My-UNITY-Exchange-987!';
const cache={
  instruments:[{id:'abb',isin:'CH0012221716',ticker:'ABBN',exchange:'XSWX',
    currency:'CHF',name:'ABB',assetClass:'equity'}],
  settings:[
    {id:'auto-test-buy-total-budget',limitEur:500},
    {id:'auto-test-buy:abb',instrumentId:'abb',kind:'auto-test-buy',mode:'technical',
      allocationEur:150,createdAt:now,active:true}
  ],
  transactions:[{id:'test-fill-one',instrumentId:'abb',type:'BUY',quantity:1,
    amount:100,price:100,fx:1,fee:1,executedAt:now,
    source:'UNITY Lab · Auto-Testkauf'}]
};
let writes=0,shareCalls=0,lastShared;
const controls={};
for(const id of ['unity-exchange-status','unity-exchange-share','unity-exchange-inspect-file',
  'unity-exchange-password','unity-exchange-password-confirm','unity-exchange-inspect-password'])
  controls[id]={textContent:'',hidden:true,files:[],value:''};
controls['unity-exchange-password'].value=pass;
controls['unity-exchange-password-confirm'].value=pass;
const sandbox={cache,console,Date,Math,Number,Array,Map,Set,TextEncoder,TextDecoder,
  Uint8Array,File:TestFile,crypto:webcrypto,
  btoa:s=>Buffer.from(s,'binary').toString('base64'),
  atob:s=>Buffer.from(s,'base64').toString('binary'),
  document:{getElementById:id=>controls[id]},
  navigator:{canShare:({files})=>files.length===1,share:data=>{
    shareCalls++;lastShared=data;return Promise.resolve()}},
  put:async(store,record)=>{assert.equal(store,'settings');writes++;
    const i=cache.settings.findIndex(x=>x.id===record.id);
    if(i<0)cache.settings.push(record);else cache.settings[i]=record;},
  unityIsCryptoAsset:s=>s.assetClass==='crypto'};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('exchange-protocol.js','utf8'),sandbox);
vm.runInContext(fs.readFileSync('exchange-crypto.js','utf8'),sandbox);
vm.runInContext(fs.readFileSync('exchange-ui.js','utf8'),sandbox);
const run=js=>vm.runInContext(js,sandbox);
(async()=>{
 const prepared=await run('unityExchangePrepare()');
 const outer=JSON.parse(await prepared.file.text());
 assert.equal(writes,1,'Preparing encrypted export only writes metadata');
 assert.equal(outer.format,safe.FORMAT);
 assert.equal('payload' in outer,false);
 assert.equal(JSON.stringify(outer).includes('auto-test-buy:abb'),false);
 const {packet:p}=await safe.decrypt(outer,pass,webcrypto,protocol,digest);
 assert.equal(p.purpose,'review-only');
 assert.equal(p.executionPermission,false);
 assert.equal(p.payload.orders.length,1);
 assert.equal(p.payload.trades.length,1);
 assert.equal(p.payload.orders[0].amountEur,150);
 assert.equal(p.payload.budget.limitEur,500);
 assert.equal(p.payload.budget.spentEur,101);
 assert.equal(controls['unity-exchange-password'].value,'');
 assert.equal(controls['unity-exchange-password-confirm'].value,'');
 assert.equal(controls['unity-exchange-share'].hidden,false);
 assert.match(controls['unity-exchange-status'].textContent,/Noch NICHT nach pCloud/);
 run('unityExchangeShare()');
 await Promise.resolve();
 assert.equal(shareCalls,1,'Share Sheet opens only by direct tap');
 assert.equal(lastShared.files[0],prepared.file);
 // Inspect encrypted file: check password but NEVER write any transactions.
 const before=JSON.stringify(cache);
 controls['unity-exchange-inspect-file'].files=[prepared.file];
 controls['unity-exchange-inspect-password'].value=pass;
 await run('unityExchangeInspectSelected()');
 assert.equal(JSON.stringify(cache),before,'No import, overwrite or fill after inspection');
 assert.equal(writes,1);
 assert.equal(controls['unity-exchange-inspect-password'].value,'','Inspection clears password');
 assert.match(controls['unity-exchange-status'].textContent,/NUR LESEN/);
 // Wrong password and malicious ciphertext both fail with no local modification.
 controls['unity-exchange-inspect-password'].value='wrong-passphrase-000';
 await assert.rejects(run('unityExchangeInspectSelected()'),/Falsches Passwort oder Datei verändert/);
 assert.equal(JSON.stringify(cache),before);
 const altered=JSON.parse(await prepared.file.text());
 altered.ciphertext='AA'+altered.ciphertext.slice(2);
 controls['unity-exchange-inspect-file'].files=[new TestFile([JSON.stringify(altered)],'modified.json')];
 controls['unity-exchange-inspect-password'].value=pass;
 await assert.rejects(run('unityExchangeInspectSelected()'),/Falsches Passwort oder Datei verändert/);
 assert.equal(JSON.stringify(cache),before);
 // On order change, repeated prepare creates a NEW protected file.
 cache.settings.find(x=>x.id==='auto-test-buy:abb').allocationEur=200;
 // Face ID / Apple Passwords can fill one current-password field. The
 // optional confirmation stays empty and must not prevent protected export.
 controls['unity-exchange-password'].value=pass;
 controls['unity-exchange-password-confirm'].value='';
 const newer=await run('unityExchangePrepare()');
 const newerOuter=JSON.parse(await newer.file.text());
 const {packet:next}=await safe.decrypt(newerOuter,pass,webcrypto,protocol,digest);
 assert.equal(next.payload.orders[0].amountEur,200,'No stale amount after an edit');
 assert.equal(next.revision,2);
 assert.notEqual(newerOuter.salt,outer.salt);
 assert.equal(writes,2);
 assert.equal(cache.transactions.length,1);
 assert.equal(cache.settings.find(x=>x.id==='auto-test-buy:abb').active,true);
 // Reject insufficient passphrases, mismatched confirmations, crypto-as-stock.
 controls['unity-exchange-password'].value='short';
 controls['unity-exchange-password-confirm'].value='short';
 await assert.rejects(run('unityExchangePrepare()'),/mindestens 12/);
 assert.equal(writes,2);
 controls['unity-exchange-password'].value=pass;
 controls['unity-exchange-password-confirm'].value=pass+'x';
 await assert.rejects(run('unityExchangePrepare()'),/nicht überein/);
 assert.equal(writes,2);
 cache.instruments[0].assetClass='crypto';
 controls['unity-exchange-password-confirm'].value=pass;
 await assert.rejects(run('unityExchangePrepare()'),/Kryptowährungen/);
 assert.equal(writes,2);
 console.log('Encrypted UNITY iPhone: Apple AutoFill primary password without confirmation, fresh private ciphertext, no persistence, Share Sheet, no-write inspection and tamper veto passed.');
})().catch(e=>{console.error(e);process.exitCode=1});
