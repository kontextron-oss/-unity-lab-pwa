'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {webcrypto}=require('node:crypto');
const {TextEncoder}=require('node:util');
class TestFile{
  constructor(parts,name){this.name=name;this.parts=parts;this.size=Buffer.byteLength(parts.join(''),'utf8')}
  async text(){return this.parts.join('')}
}
const now='2026-11-06T11:50:00.000Z';
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
for(const id of ['unity-exchange-status','unity-exchange-share','unity-exchange-inspect-file'])
  controls[id]={textContent:'',hidden:true,files:[]};
const sandbox={cache,console,Date,Math,Number,JSON,Array,Map,Set,TextEncoder,
  Uint8Array,File:TestFile,crypto:webcrypto,
  document:{getElementById:id=>controls[id]},
  navigator:{canShare:({files})=>files.length===1,share:data=>{
    shareCalls++;lastShared=data;return Promise.resolve()}},
  put:async(store,record)=>{assert.equal(store,'settings');writes++;
    const i=cache.settings.findIndex(x=>x.id===record.id);
    if(i<0)cache.settings.push(record);else cache.settings[i]=record;},
  unityIsCryptoAsset:s=>s.assetClass==='crypto'};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('exchange-protocol.js','utf8'),sandbox);
vm.runInContext(fs.readFileSync('exchange-ui.js','utf8'),sandbox);
const run=js=>vm.runInContext(js,sandbox);
(async()=>{
 const prepared=await run('unityExchangePrepare()');
 const p=prepared.envelope;
 assert.equal(writes,1,'Preparing export only writes a revision metadata record');
 assert.equal(p.purpose,'review-only');
 assert.equal(p.executionPermission,false);
 assert.equal(p.payload.orders.length,1);
 assert.equal(p.payload.trades.length,1);
 assert.equal(p.payload.orders[0].amountEur,150);
 assert.equal(p.payload.budget.limitEur,500);
 assert.equal(p.payload.budget.spentEur,101);
 assert.equal(controls['unity-exchange-share'].hidden,false);
 assert.match(controls['unity-exchange-status'].textContent,/Noch NICHT nach pCloud/);
 run('unityExchangeShare()');
 await Promise.resolve();
 assert.equal(shareCalls,1,'Share Sheet is only opened by explicit tap');
 assert.equal(lastShared.files[0],prepared.file);
 // Inspect must not modify any order, budget or transaction.
 const before=JSON.stringify(cache);
 controls['unity-exchange-inspect-file'].files=[prepared.file];
 await run('unityExchangeInspectSelected()');
 assert.equal(JSON.stringify(cache),before,'No import, overwrite or simulated fill after local inspection');
 assert.equal(writes,1);
 assert.match(controls['unity-exchange-status'].textContent,/NUR LESEN/);
 // A modified incoming packet is rejected, still with zero local changes.
 const altered=JSON.parse(await prepared.file.text());
 altered.payload.orders[0].amountEur=500;
 controls['unity-exchange-inspect-file'].files=[new TestFile([JSON.stringify(altered)],'modified.json')];
 await assert.rejects(run('unityExchangeInspectSelected()'),/Prüfsumme/);
 assert.equal(JSON.stringify(cache),before);
 // On a changed order, repeating explicit prepare MUST create a fresh new file.
 cache.settings.find(x=>x.id==='auto-test-buy:abb').allocationEur=200;
 const newer=await run('unityExchangePrepare()');
 assert.equal(newer.envelope.payload.orders[0].amountEur,200,'No stale export after order change');
 assert.equal(newer.envelope.revision,2,'Only export revision advances');
 assert.equal(writes,2);
 assert.equal(cache.transactions.length,1);
 assert.equal(cache.settings.find(x=>x.id==='auto-test-buy:abb').active,true);
 // Crypto must never be exported as a stock automation order.
 cache.instruments[0].assetClass='crypto';
 await assert.rejects(run('unityExchangePrepare()'),/Kryptowährungen/);
 assert.equal(writes,2);
 console.log('UNITY exchange iPhone: explicit Share Sheet, fresh revision, verified read-only inspection, tamper veto, no order/portfolio writes passed.');
})().catch(e=>{console.error(e);process.exitCode=1});
