'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const now=Date.now(),day=new Date(now-86400000).toISOString().slice(0,10);
let renders=0;
const ctx={Date,Math,Number,AbortController,setTimeout,clearTimeout,
 fetch:async()=>({ok:true,json:async()=>({schemaVersion:1,unit:'EUR per 1 foreign currency unit',referenceDate:day,rates:{EUR:1,CHF:1.09,USD:0.9}})}),
 render:()=>renders++};
vm.createContext(ctx);vm.runInContext(fs.readFileSync('fx.js','utf8'),ctx);
(async()=>{
 await new Promise(resolve=>setTimeout(resolve,15));
 assert.equal(vm.runInContext("unityEuroRate('EUR').rate",ctx),1);
 assert.equal(vm.runInContext("unityEuroRate('CHF').rate",ctx),1.09);
 assert.equal(vm.runInContext("unityEuroRate('USD').rate",ctx),0.9);
 assert.equal(vm.runInContext("unityEuroRate('GBP')",ctx),null);
 vm.runInContext("unityFx.referenceDate='2020-01-01'",ctx);
 assert.equal(vm.runInContext("unityEuroRate('CHF')",ctx),null);
 assert.equal(vm.runInContext("unityEuroRate('EUR').rate",ctx),1);
 assert.ok(renders>0);
 console.log('ECB FX: automatic EUR/CHF/USD conversion, missing and stale-rate veto passed.');
})().catch(e=>{console.error(e);process.exitCode=1});
