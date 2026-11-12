'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const sw=fs.readFileSync('sw.js','utf8');
const home=fs.readFileSync('home.js','utf8');
const html=fs.readFileSync('index.html','utf8');
const versioned=fs.readFileSync('unity-017.html','utf8');
const intraday=fs.readFileSync('intraday.js','utf8');
const marketWorkflow=fs.readFileSync('.github/workflows/market-data.yml','utf8');
const fxWorkflow=fs.readFileSync('.github/workflows/fx-rates.yml','utf8');
assert.match(marketWorkflow,/15 6,12,15,18,21,23 \* \* 1-5/,'market snapshots during Europe and US sessions');
assert.match(fxWorkflow,/45 15,17 \* \* 1-5/,'second ECB FX attempt when first data release is late');
const host='https://kontextron-oss.github.io/-unity-lab-pwa/';
const events={};
const currentCache=new Map(),oldCache=new Map();
const key=value=>{
 const u=new URL(typeof value==='string'?value:value.url,host);
 u.hash='';return u.href;
};
function matching(map,request,opts){
 const direct=map.get(key(request));
 if(direct)return direct.clone();
 if(opts?.ignoreSearch){
  const u=new URL(key(request));u.search='';
  const v=map.get(u.href);if(v)return v.clone();
 }
 return undefined;
}
const oldData=JSON.stringify({schemaVersion:1,generatedAt:'2026-11-02T08:00:00Z',items:{stock:'old'}});
const todayData=JSON.stringify({schemaVersion:1,generatedAt:'2026-11-12T15:15:07Z',items:{stock:'new'}});
oldCache.set(key('./data/market.json'),new Response(oldData,{
 status:200,headers:{'content-type':'application/json'}}));
currentCache.set(key('./data/market.json'),new Response(oldData,{
 status:200,headers:{'content-type':'application/json'}}));
let offline=false,shouldReturnError=false,networkFetchCount=0,cachePuts=[];
const cached={
 async match(request,opts){return matching(currentCache,request,opts)},
 async put(request,response){
  cachePuts.push(key(request));
  currentCache.set(key(request),response.clone())
 },
 async addAll(){},
};
const fakeCaches={
 async open(name){assert.equal(name,'unity-lab-v0.17.0-rc1-datafix-20261112');return cached},
 async match(req){return matching(oldCache,req)||matching(currentCache,req)}
};
const fakeFetch=async(request,opts)=>{
 networkFetchCount++;
 assert.equal(opts?.cache,'no-store','market fetch must bypass Safari HTTP cache');
 if(offline)throw Error('Airplane mode');
 if(shouldReturnError)return new Response('Unavailable',{status:503});
 return new Response(todayData,{status:200,headers:{'content-type':'application/json'}});
};
const context={URL,Request,Response,Promise,caches:fakeCaches,fetch:fakeFetch,
 location:{origin:new URL(host).origin},

 self:{registration:{scope:host},addEventListener(type,fn){events[type]=fn},skipWaiting(){},
  clients:{claim(){return Promise.resolve()}}}};
vm.runInNewContext(sw,context);
function request(url){
 const req=new Request(new URL(url,host),{cache:'no-store'});
 let answer;
 events.fetch({request:req,respondWith(p){answer=p}});
 assert.ok(answer,'service worker did not intercept '+url);
 return answer;
}
(async()=>{
 assert.match(sw,/url\.pathname\.startsWith\(dataPath\)/);
 assert.match(sw,/dataNetworkFirst\(request\)/);
 assert.match(sw,/canonical\.search=''/);
 const fresh=await request('./data/market.json?t=111');
 assert.equal(fresh.status,200);
 assert.equal((await fresh.json()).items.stock,'new','newly published market data must replace old cache');
 assert.equal(networkFetchCount,1,'must actually call the network');
 assert.deepEqual(cachePuts,[key('./data/market.json')],
  'timestamped requests must not produce unbounded cache keys');
 offline=true;
 const offlineNew=await request('./data/market.json?t=222');
 assert.equal((await offlineNew.json()).items.stock,'new',
  'offline must use the last successfully updated cache before old 0.16.5');
 offline=false;shouldReturnError=true;
 const serverError=await request('./data/market.json?t=333');
 assert.equal((await serverError.json()).items.stock,'new','failed HTTP cannot overwrite good cache');
 shouldReturnError=false;
 const fx=await request('./data/fx.json?t=444');
 assert.equal(fx.status,200,'currency data uses network first');
 assert.equal(cachePuts.at(-1),key('./data/fx.json'));
 const intr=await request('./data/intraday.json?t=555');
 assert.equal(intr.status,200,'intraday data uses network first');
 assert.equal(cachePuts.at(-1),key('./data/intraday.json'));
 const staticScript=new Response('/* precached */',{status:200});
 currentCache.set(key('./home.js?v=0.17.0-rc1-datafix-20261112'),staticScript);
 const beforeStatic=networkFetchCount;
 const staticResult=await request('./home.js?v=0.17.0-rc1-datafix-20261112');
 assert.match(await staticResult.text(),/precached/);
 assert.equal(networkFetchCount,beforeStatic,'unchanged scripts remain cache first');
 assert.doesNotMatch(home,/badge\.textContent\s*=\s*'0\.16\.5'/);
 assert.match(home,/UNITY_HOME_REFRESH_INTERVAL_MS=15\*60000/);
 assert.match(home,/window\.setInterval\(unityHomeRefreshVisibleIfDue,60000\)/);
 assert.match(home,/Quellenstand/);
 for(const page of [html,versioned]){
  assert.match(page,/home\.js\?v=0\.17\.0-rc1-datafix-20261112/);
  assert.match(page,/intraday\.js\?v=0\.17\.0-rc1-datafix-20261112/);
 }
 assert.match(sw,/home\.js\?v=0\.17\.0-rc1-datafix-20261112/);
 assert.match(sw,/intraday\.js\?v=0\.17\.0-rc1-datafix-20261112/);
 // Intraday data is allowed to outrank a less recent daily snapshot
 // even on the same calendar date; stock identity/currency unchanged.
 const now=Date.now(),minus=n=>new Date(now-n*60000).toISOString();
 const stock={isin:'CH0012221716',currency:'CHF',name:'ABB',exchange:'Swiss'};
 const daily={isin:stock.isin,currency:'CHF',exchange:'Swiss',price:100,
  date:minus(15).slice(0,10),lastSuccessfulFetchAt:minus(75)};
 const pilot={isin:stock.isin,currency:'CHF',exchange:'Swiss',price:102,
  quotedAt:minus(15),quotePrecision:'15m-bar'};
 const intrCtx={
  Date,Math,Number,Set,Promise,AbortController,setTimeout,clearTimeout,
  CATALOG:[stock],unityMarket:{generatedAt:minus(75)},
  unityMarketForStock:()=>daily,unityReferenceQuoteItem:()=>null,
  unityMarketItem:()=>daily,render(){},
  fetch:async()=>({ok:false,status:503})};
 intrCtx.testPilot=pilot;
 vm.createContext(intrCtx);
 vm.runInContext(intraday,intrCtx);
 vm.runInContext('unityIntraday={items:{[testPilot.isin]:testPilot}}',intrCtx);
 let displayed=vm.runInContext('unityDisplayQuote(CATALOG[0])',intrCtx);
 assert.equal(displayed.price,102,'newer same-day 15m bar must be visible');
 assert.equal(displayed.precision,'15m-bar');
 intrCtx.newerDaily=minus(5);
 vm.runInContext('unityMarketForStock=()=>({...CATALOG[0],price:100,date:testPilot.quotedAt.slice(0,10),lastSuccessfulFetchAt:newerDaily})',intrCtx);
 displayed=vm.runInContext('unityDisplayQuote(CATALOG[0])',intrCtx);
 assert.equal(displayed.price,100,'an even newer daily reference outranks the pilot');
 console.log('UNITY market cache: fresh network beats old iPhone cache, canonical offline data, HTTP/offline resilience, version label, foreground refresh and same-day intraday precedence all pass.');
})().catch(err=>{console.error(err);process.exitCode=1});
