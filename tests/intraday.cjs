'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const isin='DE0006231004',now=Date.now(),quoteAt=new Date(now-20*60000).toISOString();
const market={schemaVersion:1,generatedAt:new Date(now).toISOString(),items:{
 [isin]:{isin,price:34.22,currency:'EUR',exchange:'Xetra',quotedAt:quoteAt,quotePrecision:'15m-bar',source:'Experimental pilot'}
},errors:{}};
const s={isin,name:'Infineon',exchange:'Xetra',currency:'EUR'};
let renders=0;
const ctx={Date,Number,Math,Set,AbortController,setTimeout,clearTimeout,
 CATALOG:[s],unityMarketItem:()=>({isin,date:new Date(now-2*86400000).toISOString().slice(0,10),price:33.1,currency:'EUR',exchange:'Xetra',source:'Daily EOD'}),
 fetch:async()=>({ok:true,json:async()=>market}),render:()=>renders++};
vm.createContext(ctx);vm.runInContext(fs.readFileSync('intraday.js','utf8'),ctx);
(async()=>{
 await new Promise(resolve=>setTimeout(resolve,10));
 const pilot=vm.runInContext('unityDisplayQuote('+JSON.stringify(s)+')',ctx);
 assert.equal(pilot.precision,'15m-bar');assert.equal(pilot.price,34.22);
 assert.equal(pilot.quotedAt,quoteAt);assert.match(pilot.label,/inoffiziell/);
 market.items[isin].currency='USD';
 assert.equal(vm.runInContext('unityDisplayQuote('+JSON.stringify(s)+').precision',ctx),'day');
 market.items[isin].currency='EUR';market.items[isin].quotedAt=new Date(now-120*60000).toISOString();
 assert.equal(vm.runInContext('unityDisplayQuote('+JSON.stringify(s)+').precision',ctx),'day');
 market.items[isin].quotedAt=new Date(now+15*60000).toISOString();
 assert.equal(vm.runInContext('unityDisplayQuote('+JSON.stringify(s)+').precision',ctx),'day');
 assert.ok(renders>0);
 console.log('Pilot quote timestamp, currency, stale-data and daily fallback checks passed.');
})().catch(e=>{console.error(e);process.exitCode=1});
