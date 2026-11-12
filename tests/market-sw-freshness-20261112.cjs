'use strict';
/*
 * Deterministic browser-worker regression: an iPhone must see the new
 * market.json, even when a preexisting 0.16.5 offline cache exists.
 * No network/API calls, IndexedDB writes or personal data involved.
 */
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('sw.js','utf8');
const origin='https://kontextron-oss.github.io';
const scope=origin+'/-unity-lab-pwa/';
const url=scope+'data/market.json';
const old={schemaVersion:1,generatedAt:'2026-11-07T10:00:00Z',items:{A:{price:10}}};
const current={schemaVersion:1,generatedAt:'2026-11-12T15:15:00Z',items:{A:{price:20}}};
const body=x=>new Response(JSON.stringify(x),{status:200,headers:{'content-type':'application/json'}});
let online=true,fetchCount=0,cacheWrites=0;
const active=new Map(),previous=new Map([[url,body(old)]]);
const events={};
function urlOf(req){return typeof req==='string'?new URL(req,scope):new URL(req.url)}
function get(map,req,opts){
 const u=urlOf(req);
 if(opts?.ignoreSearch)u.search='';
 return map.get(u.href)?.clone();
}
const caches={
 async open(cacheName){
  assert.match(cacheName,/^unity-lab-v0\.17\.0-rc1-datafix-20261112$/);
  return {
   match:async(req,opts)=>get(active,req,opts),
   put:async(req,response)=>{cacheWrites++;active.set(urlOf(req).href,response.clone())},
   addAll:async()=>{}
  };
 },
 async match(req,opts){return get(previous,req,opts)||get(active,req,opts)}
};
const fetcher=async(req,init)=>{
 fetchCount++;assert.equal(init?.cache,'no-store');
 if(!online)throw Error('Offline');
 return body(current);
};
const scopeEvents={
 addEventListener:(name,listener)=>{events[name]=listener},
 registration:{scope},
 clients:{claim:async()=>{}},
 skipWaiting:async()=>{}
};
const ctx={URL,Response,Request,caches,fetch:fetcher,self:scopeEvents,location:{origin}};
vm.runInNewContext(source,ctx);
async function intercepted(path,mode='cors'){
 const req=new Request(path);
 const event={request:req,respondWith(p){event.response=Promise.resolve(p)}};
 if(mode==='navigate')Object.defineProperty(req,'mode',{value:'navigate'});
 events.fetch(event);
 return event.response;
}
(async()=>{
 assert.equal(typeof events.fetch,'function');
 const fresh=await intercepted(url+'?t=123');
 assert.ok(fresh,'market data should be intercepted');
 assert.equal((await fresh.json()).items.A.price,20,'fresh data must outrank stale 0.16.5 cache');
 assert.equal(fetchCount,1,'fetch market data from network on every explicit refresh');
 assert.ok(cacheWrites>0,'cache canonical market snapshot for future offline use');
 assert.ok(active.has(url),'canonical cache key must not contain a timestamp query');
 assert.ok(!active.has(url+'?t=123'),'avoid per-refresh unbounded cache keys');
 online=false;
 const offline=await intercepted(url+'?t=456');
 assert.equal((await offline.json()).items.A.price,20,
  'offline must use last successfully downloaded data from new release');
 active.clear();
 const fallback=await intercepted(url+'?t=789');
 assert.equal((await fallback.json()).items.A.price,10,
  'if new cache empty, old release remains a non-destructive last resort');
 const unrelated=await intercepted(scope+'kontakte/data/records.json');
 assert.equal(unrelated,undefined,'other apps must not be treated as UNITY financial feeds');
 assert.doesNotMatch(source,/indexedDB\.deleteDatabase|caches\.delete\(/);
 console.log('UNITY market PWA worker: online freshness, canonical offline, old-cache fallback, no foreign app interception passed.');
})().catch(e=>{console.error(e);process.exitCode=1});
