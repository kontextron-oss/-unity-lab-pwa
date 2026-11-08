'use strict';
/* RC1 contracts. This simulates PWA cache operations under Node, not Safari/iOS. */
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');
const sw=fs.readFileSync('sw.js','utf8');
const manifest=JSON.parse(fs.readFileSync('manifest.webmanifest','utf8'));
assert.equal(manifest.short_name,'UNITY RC1');
assert.equal(manifest.start_url,'./index.html');
assert.equal(manifest.scope,'./');
const valuation=fs.readFileSync('valuation-scenarios.js','utf8');
const originalStores=['instruments','quotes','transactions','strategies','audit',
 'fundamentals','histories','analyses','settings'];
const rc='0.17.0-rc1';
const evidence=[
 './data/issuer-guidance.json',
 './data/valuation-assumptions.json',
 './data/debt-pilot-evidence.json',
 './data/normalization-evidence.json',
 './data/financing-stress-evidence.json'
];
const assertContains=(s,x,label)=>assert.ok(s.includes(x),label+': '+x);
assertContains(html,'Unity Lab 0.17.0 RC1','visible release candidate label');
assertContains(html,'0.17.0 RC1 · TEST','version in app header');
assertContains(html,"./sw.js?v="+rc,'registered worker');
assertContains(html,'./valuation-scenarios.js?v='+rc,'new valuation module');
assertContains(html,"indexedDB.open('unity-lab',3)",'local schema unchanged');
assertContains(html,"const STORES="+JSON.stringify(originalStores).replaceAll('"',"'"),'object stores unchanged');
assert.doesNotMatch(html,/indexedDB\.deleteDatabase\s*\(/);
assert.doesNotMatch(html,/controllerchange[^;]*location\.reload\s*\(/);
assert.doesNotMatch(html,/localStorage\.clear\s*\(/);
assert.match(sw,/event\.data\?\.type==='UNITY_ACTIVATE_UPDATE'/,'explicit safe update request required');
assert.match(sw,/self\.skipWaiting\s*\(/,'user-initiated activation supported');
assert.ok(fs.existsSync('update.html'),'non-destructive Safari update page exists');
const helper=fs.readFileSync('update.html','utf8');
assert.match(helper,/UNITY_ACTIVATE_UPDATE/);
assert.match(helper,/getRegistration\('\.\/'\)/);
assert.doesNotMatch(helper,/deleteDatabase\s*\(|caches\.delete\s*\(|localStorage\.clear\s*\(|unregister\s*\(/);
assert.doesNotMatch(sw,/caches\.delete\s*\(/,'prior caches preserved for fallback');
assert.doesNotMatch(sw,/\.delete\s*\(k\)/,'no cache pruning during RC');
assert.doesNotMatch(valuation,/indexedDB\./,'analysis logic read only');
assert.doesNotMatch(valuation,/localStorage\./,'analysis logic does not change user settings');

const origin='https://unity.test.invalid/';
const events={};
const record={installRequests:[],opened:[],deletes:0,skip:0,claimed:0,
 fetchRequests:[],cacheHits:0};
const cached=new Map();
const stale=new Map([[new URL('./index.html',origin).href,new Response('<title>Unity Lab 0.16.5</title>',{status:200})]]);
function repoPath(asset){
 const pathname=new URL(asset,origin).pathname.slice(1);
 return pathname||'index.html';
}
const cacheAPI={
 async open(name){
  record.opened.push(name);
  return {
   async addAll(list){
    record.installRequests.push(...list);
    for(const asset of list){
     const path=repoPath(asset);
     assert.ok(fs.existsSync(path),'missing precached asset: '+path);
     const contents=fs.readFileSync(path);
     cached.set(new URL(asset,origin).href,new Response(contents,{status:200}));
    }
   },
   async match(req,options){
    const url=typeof req==='string'?new URL(req,origin):new URL(req.url);
    let item=cached.get(url.href);
    if(!item&&options?.ignoreSearch){
     url.search='';item=cached.get(url.href);
    }
    if(item){record.cacheHits++;return item.clone()}
    return undefined;
   },
   async put(req,response){cached.set(req.url,response)}

  };
 },
 async match(request){
  // Global CacheStorage.match searches the old 0.16.5 cache first.
  const hit=stale.get(request.url)||cached.get(request.url);
  if(hit){record.cacheHits++;return hit.clone()}
  return undefined;
 },
 async keys(){return ['unity-lab-v0.16.5','unity-lab-v0.17.0-rc1']},
 async delete(){record.deletes++;return true}
};
const mockFetch=async request=>{
 record.fetchRequests.push(typeof request==='string'?request:request.url);
 throw new Error('airplane-mode / no network');
};
const ctx={URL,Request,Response,caches:cacheAPI,fetch:mockFetch,
 location:{origin:new URL(origin).origin},self:{
  addEventListener(name,fn){events[name]=fn},
  skipWaiting(){record.skip++},
  clients:{async claim(){record.claimed++}}
 }};
const config=vm.runInNewContext(sw+'\n;({CACHE,ASSETS})',ctx);
assert.equal(config.CACHE,'unity-lab-v'+rc);
assert.equal(new Set(config.ASSETS).size,config.ASSETS.length,'no duplicate entries');
for(const asset of evidence)assert.ok(config.ASSETS.includes(asset),'missing offline source '+asset);
assert.ok(config.ASSETS.includes('./valuation-scenarios.js?v='+rc));
assert.ok(config.ASSETS.includes('./update.html'),'update helper available offline');
assert.ok(config.ASSETS.includes('./unity-017.html'),'versioned direct launch available offline');
assert.match(fs.readFileSync('unity-017.html','utf8'),/Unity Lab 0\.17\.0 RC1 · Direktstart/);
assert.match(fs.readFileSync('unity-017.html','utf8'),/indexedDB\.open\('unity-lab',3\)/);
assert.match(helper,/unity-017\.html/);
assert.ok(!config.ASSETS.includes('./valuation-scenarios.js?v=0.16.5'));
for(const eventName of ['install','activate','fetch','message'])
 assert.equal(typeof events[eventName],'function','SW event missing: '+eventName);

async function exercise(){
 let pending;
 events.install({waitUntil(promise){pending=promise}});
 await pending;
 assert.equal(record.installRequests.length,config.ASSETS.length);
 assert.equal(record.skip,1,'activate automatically only after the full new cache is ready');
 events.message({data:{type:'NOT_THE_APPROVED_UPDATE'}});
 assert.equal(record.skip,1,'ignore unrelated messages');
 events.message({data:{type:'UNITY_ACTIVATE_UPDATE'}});
 assert.equal(record.skip,2,'explicit update request remains supported');
 events.activate({waitUntil(promise){pending=promise}});
 await pending;
 assert.equal(record.deletes,0,'keep older caches while testing RC');
 assert.equal(record.claimed,1);
 // An old 0.16.5 cache must never outrank the current offline HTML.
 {
  const req=new Request(new URL('./index.html?old-pwa=1',origin));
  let answer;
  events.fetch({request:req,respondWith(p){answer=p}});
  assert.ok(answer,'offline navigation intercepted');
  const page=await answer;
  const content=await page.text();
  assert.match(content,/Unity Lab 0\.17\.0 RC1/,
   '0.17 current cache wins over stale 0.16.5 HTML');
 }
 // Actual offline fetch path of the service worker: all three new SEC
 // references must be served successfully from the atomic precache.
 for(const asset of evidence){
  const request=new Request(new URL(asset,origin));
  let responsePromise=null;
  events.fetch({request,respondWith(p){responsePromise=p}});
  assert.ok(responsePromise,'missing offline response for '+asset);
  const response=await responsePromise;
  assert.equal(response.status,200);
  const obj=await response.json();
  assert.equal(obj.schemaVersion,1);
  assert.ok(obj.items&&typeof obj.items==='object');
 }
 assert.ok(record.cacheHits>=evidence.length,'offline cache not used');
 const localSource=async(url)=>{
  if(url.includes('?t='))throw new Error('airplane mode');
  const response=await cacheAPI.match(new Request(new URL(url,origin)));
  if(!response)throw new Error('missing offline asset '+url);
  return response;
 };
 const analysisContext={URL,Date,Math,Number,String,Object,Array,JSON,Intl,Promise,
  fetch:localSource,db:null};
 vm.createContext(analysisContext);
 vm.runInContext(valuation,analysisContext);
 await vm.runInContext('unityLoadValuationEvidence()',analysisContext);
 assert.equal(vm.runInContext('unityGuidanceFetchError',analysisContext),'');
 for(const [ref,isin] of [
  ['unityIssuerGuidance','IE00B8KQN827'],
  ['unityQuarterDebtPilot','US92537N1081'],
  ['unityNormalizationPilot','IE00B8KQN827'],
  ['unityFinancingStressPilot','US92537N1081']])
  assert.ok(vm.runInContext(ref,analysisContext).items[isin],
   'offline module missed '+ref+' '+isin);
 assert.deepEqual(JSON.parse(JSON.stringify(
  vm.runInContext('unityValuationAssumptions',analysisContext).items)),{},
  'still no invented trade-approved valuation assumptions');
 assert.equal(record.deletes,0);
 assert.equal(record.skip,2,'one automatic activation after precache plus one explicit user request');
 console.log('RC1 cache: original IndexedDB schema untouched, prior caches retained, no forced reload, all evidence JSON offline, valuation module offline load passed.');
}
exercise().catch(err=>{console.error(err);process.exitCode=1});
