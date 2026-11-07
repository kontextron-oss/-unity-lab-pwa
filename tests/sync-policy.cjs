'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const policy=require('../sync-policy.js');
const BASE={enabled:true,appOpen:true,offline:false,
 authorized:true,accountConfirmed:true,providerHost:'eapi.pcloud.com',
 deviceAuthorized:true,encryptionReady:true,manifestReadFresh:true,
 remoteVersionChecked:true,conflictCount:0,deletionCount:0,
 validatedMergePlan:true,recordSchemaChecked:true,
 localChanges:true,remoteChanges:false,providerSupportsCAS:true,
 remoteVersionCASChecked:true,verifiedEncryptedPayload:true,backoffActive:false};
const out=(edit={})=>policy.evaluate({...BASE,...edit});
const verifyBlock=(edit,action)=>{const r=out(edit);
 assert.equal(r.action,action);assert.equal(r.canTransfer,false);
 assert.equal(r.canOverwriteWithoutReview,false);assert.equal(r.canDeleteWithoutReview,false);
 assert.equal(r.canExecuteOrders,false);assert.equal(r.hasExecuted,false);};
verifyBlock({enabled:false},'disabled');
verifyBlock({appOpen:false},'paused');
verifyBlock({offline:true},'offline');
verifyBlock({paused:true},'paused');
verifyBlock({inFlight:true},'paused');
verifyBlock({authorized:false},'authorize-pcloud');
verifyBlock({accountConfirmed:false},'authorize-pcloud');
verifyBlock({providerHost:'other.com'},'authorize-pcloud');
verifyBlock({deviceAuthorized:false},'authorize-pcloud');
verifyBlock({encryptionReady:false},'unlock-encryption');
verifyBlock({manifestReadFresh:false},'read-remote-manifest');
verifyBlock({remoteVersionChecked:false},'read-remote-manifest');
verifyBlock({conflictCount:1},'review-conflicts');
verifyBlock({conflictCount:null},'review-conflicts');
verifyBlock({deletionCount:1},'review-conflicts');
verifyBlock({validatedMergePlan:false},'plan-verified-merge');
verifyBlock({recordSchemaChecked:false},'plan-verified-merge');
verifyBlock({providerSupportsCAS:false},'plan-verified-merge');
verifyBlock({remoteVersionCASChecked:false},'plan-verified-merge');
verifyBlock({verifiedEncryptedPayload:false},'plan-verified-merge');
verifyBlock({backoffActive:true},'retry-after-backoff');
verifyBlock({remoteChanges:true},'plan-verified-merge');
verifyBlock({localChanges:false,remoteChanges:false},'up-to-date');
const proceed=out();
assert.equal(proceed.action,'prepare-upload-after-cas');
assert.equal(proceed.canTransfer,true);
assert.equal(proceed.canOverwriteWithoutReview,false);
assert.equal(proceed.hasCalledPcloud,false);
assert.equal(out({providerHost:'api.pcloud.com'}).canTransfer,true);
const x=fs.readFileSync('sync-policy.js','utf8');
assert.doesNotMatch(x,/fetch\s*\(|indexedDB\.|localStorage\.|navigator\.|setInterval\(|setTimeout\(/);
assert.doesNotMatch(x,/access_token|client_secret|Authorization:\s*Bearer/);
const b={};
vm.runInNewContext(x,{globalThis:b});
assert.equal(b.UNITY_SYNC_POLICY.evaluate(BASE).action,proceed.action);
const current=fs.readFileSync('pcloud-direct.js','utf8');
assert.match(current,/UNITY_PCLOUD_GATEWAY = ''/,'no activation of token-unsafe legacy PWA endpoint');
console.log('Future UNITY automatic sync: OAuth/active PWA/encryption/CAS conflicts, offline/no background, zero silent overwrite/delete/broker execution passed.');
