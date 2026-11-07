'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const crypto=require('node:crypto');
const plan=require('../sync-plan.js');
const delta=require('../sync-transfer.js');
const aes=require('../sync-crypto.js');
const hash=async x=>crypto.createHash('sha256').update(x,'utf8').digest('hex');
const date='2026-11-07T10:00:00.000Z',device='e2012345-ffff-44aa-8bcd-123456789abc';
const other='f2012345-ffff-44aa-8bcd-123456789abc';
const records=()=>Object.fromEntries(plan.STORES.map(x=>[x,[]]));
const clone=x=>JSON.parse(JSON.stringify(x));
const stock=(name='ABB')=>({id:'abb',name,ticker:'ABBN',isin:'CH0012221716',exchange:'SIX',currency:'CHF'});
const previous=records();previous.instruments.push(stock());previous.analyses.push({id:'analysis:abb',note:'Beobachten'});
const now=clone(previous);now.instruments[0].name='ABB Ltd';now.instruments.push({id:'amd',name:'AMD',ticker:'AMD',isin:'US0079031078',exchange:'NASDAQ',currency:'USD'});
now.analyses.push({id:'analysis:amd',note:'Keine Handelsfreigabe'});
const manifest=(records,seq,id=device,base=null)=>plan.create({
 deviceId:id,sequence:seq,createdAt:date,parentHash:base,records
},hash);
const signed=async p=>{
 const {sha256,...rest}=p;
 return {...p,sha256:await hash(plan.canonical(rest))};
};
(async()=>{
 const base=await manifest(previous,1);
 const target=await manifest(now,2,device,base.sha256);
 const p=await delta.create({targetManifest:target,baseManifest:base,
  records:{instruments:now.instruments,analyses:now.analyses},
  deviceId:device,sequence:2,exportedAt:date},hash,plan);
 assert.equal(p.changes.length,3);
 assert.deepEqual(p.changes.map(x=>x.store+'/'+x.id),[
  'instruments/abb','instruments/amd','analyses/analysis:amd']);
 assert.equal(p.baseManifestHash,base.sha256);
 assert.equal(p.executionPermission,false);
 assert.equal((await delta.verify(p,hash,plan)).valid,true);
 assert.ok(!p.changes.some(x=>x.store==='transactions'||x.store==='settings'));
 const inspect=await delta.inspect(p,base,hash,plan);
 assert.equal(inspect.counts.canReviewUpdate,1);
 assert.equal(inspect.counts.new,2);
 assert.equal(inspect.counts.conflict,0);
 assert.equal(inspect.canApplyAutomatically,false);
 assert.equal(inspect.canExecuteOrders,false);
 const same=await delta.inspect(p,target,hash,plan);
 assert.equal(same.counts.same,3);
 const diverged=clone(previous);diverged.instruments[0].name='ABB lokal';
 const local=await manifest(diverged,5,other);
 const conflict=await delta.inspect(p,local,hash,plan);
 assert.equal(conflict.counts.conflict,1);
 assert.equal(conflict.rows.find(x=>x.id==='abb').canWriteAutomatically,false);
 const absent=await manifest(records(),1,other);
 const missing=await delta.inspect(p,absent,hash,plan);
 assert.equal(missing.counts.conflict,1,'missing local former base must be a conflict');
 assert.equal(missing.counts.new,2);
 const altered=clone(p);altered.changes[0].record.name='malicious';
 await assert.rejects(delta.verify(altered,hash,plan),/Paket wurde verändert/);
 const illegal=clone(p);illegal.changes[0].store='transactions';
 await assert.rejects(delta.verify(await signed(illegal),hash,plan),/Nicht zugelassener Datensatz/);
 const duplicate=clone(p);duplicate.changes.push(duplicate.changes[0]);
 await assert.rejects(delta.verify(await signed(duplicate),hash,plan),/Doppelter Datensatz/);
 const forged=clone(p);forged.executionPermission=true;
 await assert.rejects(delta.verify(forged,hash,plan),/Orderfreigabe/);
 const unknown=clone(p);unknown.remoteDelete=true;
 await assert.rejects(delta.verify(unknown,hash,plan),/Paketaufbau/);
 const oneMissing=clone(now);oneMissing.instruments.pop();
 await assert.rejects(delta.create({targetManifest:target,baseManifest:base,
  records:{instruments:oneMissing.instruments,analyses:oneMissing.analyses},
  deviceId:device,sequence:2,exportedAt:date},hash,plan),/vollständige/);
 await assert.rejects(delta.create({targetManifest:target,baseManifest:base,
  records:{instruments:now.instruments,analyses:now.analyses},
  deviceId:device,sequence:3,exportedAt:date},hash,plan),/Geräteversionen/);
 const copied=clone(now);copied.instruments[1].name='unapproved';
 await assert.rejects(delta.create({targetManifest:target,baseManifest:base,
  records:{instruments:copied.instruments,analyses:copied.analyses},
  deviceId:device,sequence:2,exportedAt:date},hash,plan),/Änderungsinhalt/);
 const first=await manifest(now,1);
 const initial=await delta.create({targetManifest:first,records:{instruments:now.instruments,analyses:now.analyses},
  deviceId:device,sequence:1,exportedAt:date},hash,plan);
 assert.equal(initial.changes.length,4,'first delta contains source data only for pilot groups');
 const p64=await aes.encrypt(p,'Eine-Sichere-Passphrase-2026',crypto.webcrypto,delta,plan,hash);
 assert.equal(p64.format,'unity-sync-delta-encrypted');
 assert.equal(p64.purpose,'manual-review-only');
 assert.ok(!JSON.stringify(p64).includes('ABB Ltd'),'no plaintext should be shared');
 assert.ok(!JSON.stringify(p64).includes('US0079031078'));
 const decrypted=await aes.decrypt(p64,'Eine-Sichere-Passphrase-2026',crypto.webcrypto,delta,plan,hash);
 assert.equal(decrypted.packet.sha256,p.sha256);
 assert.equal(decrypted.verified.changeCount,3);
 await assert.rejects(aes.decrypt(p64,'Anderes-Langes-Passwort',crypto.webcrypto,delta,plan,hash),/Passwort falsch/);
 const badMeta=clone(p64);badMeta.purpose='order-execution';
 await assert.rejects(aes.decrypt(badMeta,'Eine-Sichere-Passphrase-2026',crypto.webcrypto,delta,plan,hash),/Verschlüsselungsparameter/);
 const tampered=clone(p64);tampered.ciphertext=tampered.ciphertext.replace(/^./,
  tampered.ciphertext[0]==='A'?'B':'A');
 await assert.rejects(aes.decrypt(tampered,'Eine-Sichere-Passphrase-2026',crypto.webcrypto,delta,plan,hash),/Passwort falsch|Base64/);
 const stolen=clone(p64);stolen.fakeKey='X';
 await assert.rejects(aes.decrypt(stolen,'Eine-Sichere-Passphrase-2026',crypto.webcrypto,delta,plan,hash),/Unbekanntes/);
 await assert.rejects(aes.encrypt(p,'too-short',crypto.webcrypto,delta,plan,hash),/mindestens 12/);
 await assert.rejects(aes.encrypt(p,'Eine-Sichere-Passphrase-2026',{},delta,plan,hash),/WebCrypto/);
 const app={};
 const ctx={globalThis:app,TextEncoder,TextDecoder,Date,Map,Set,Buffer,Promise};
 for(const file of ['sync-transfer.js','sync-crypto.js'])
  vm.runInNewContext(fs.readFileSync(file,'utf8'),ctx);
 assert.equal(app.UNITY_SYNC_TRANSFER.FORMAT,delta.FORMAT);
 assert.equal(app.UNITY_SYNC_CRYPTO.FORMAT,aes.FORMAT);
 const text=fs.readFileSync('sync-transfer.js','utf8')+fs.readFileSync('sync-crypto.js','utf8');
 for(const term of ['fetch(','indexedDB.','localStorage.','navigator.share(','new WebSocket('])
  assert.ok(!text.includes(term),'this is only a pure transport builder: '+term);
 assert.match(fs.readFileSync('pcloud-direct.js','utf8'),/UNITY_PCLOUD_GATEWAY = ''/);
 console.log('UNITY encrypted sync delta: 2 safe stores, new/revised/conflict statuses, tamper and nonce/password checks, NO database writes or broker orders passed.');
})().catch(e=>{console.error(e);process.exitCode=1});
