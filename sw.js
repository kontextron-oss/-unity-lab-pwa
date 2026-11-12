const CACHE='unity-lab-v0.17.0-rc1-datafix-20261112';
const ASSETS=['./','./index.html','./unity-017.html','./update.html','./manifest.webmanifest','./icon.svg','./discovery.js?v=0.13.97','./fundamentals.js?v=0.13.97','./financial-metrics.js?v=0.16.5','./valuation-scenarios.js?v=0.17.0-rc1','./reverse-valuation.js?v=0.16.5','./research.js?v=0.13.97','./issuer-calendar.js?v=0.13.97','./foresight.js?v=0.16.5','./own-model.js?v=0.16.5','./issuer-dossier.js?v=0.13.97','./market-context.js?v=0.13.97','./research-lifecycle.js?v=0.13.97','./capital-radar.js?v=0.13.97','./analysis.js?v=0.13.97','./datafeeds.js','./publicfeed.js','./dashboard.js','./intraday.js?v=0.17.0-rc1-datafix-20261112','./fx.js','./charts.js','./dataquality.js?v=0.13.97','./decision-policy.js?v=0.13.97','./data/crypto-market.js?v=0.13.97','./crypto-sources.js?v=0.13.97','./crypto-policy.js?v=0.13.97','./decision-cockpit.js?v=0.13.97','./depot.js?v=0.13.98','./depotcsv.js','./readiness-audit.js?v=0.16.5','./decision-engine.js?v=0.16.5','./paper-order-engine.js?v=0.16.5','./home.js?v=0.17.0-rc1-datafix-20261112','./exchange-protocol.js?v=0.16.5','./exchange-crypto.js?v=0.16.5','./exchange-ui.js?v=0.16.5','./incremental.js?v=0.13.97','./pcloud-direct.js?v=0.13.97','./sync-plan.js?v=0.17.0-rc1','./sync-transfer.js?v=0.17.0-rc1','./sync-crypto.js?v=0.17.0-rc1','./sync-ui.js?v=0.17.0-rc1','./universe.js?v=0.13.98','./data/market.json','./data/fundamentals.json','./data/sec-fundamentals.json','./data/issuer-guidance.json','./data/foresight-checkpoints.json','./data/foresight-outcomes.json','./data/unity-model-forecasts.json','./data/valuation-assumptions.json','./data/debt-pilot-evidence.json','./data/normalization-evidence.json','./data/financing-stress-evidence.json','./data/research.json','./data/issuer-calendar.json','./data/capital_events.json','./data/fx.json','./data/intraday.json'];
// UNITY 0.17 iOS hotfix: after a COMPLETE offline precache, allow the
// release to activate over a 0.16.5 worker. Users approved this upgrade.
// Never delete IndexedDB, CacheStorage or existing pCloud backups.
// The old 0.16.5 page already reloads on controllerchange; no reload is
// forced by this worker for new 0.17 pages.
self.addEventListener('install',event=>{
  event.waitUntil(
    caches.open(CACHE)
      .then(cache=>cache.addAll(ASSETS))
      .then(()=>self.skipWaiting())
  );
});
// Preserve the explicit manual path for users launching update.html.
self.addEventListener('message',event=>{
  if(event.data?.type==='UNITY_ACTIVATE_UPDATE')self.skipWaiting();
});
self.addEventListener('activate',event=>{
  event.waitUntil(self.clients.claim());
});

async function latestCache(){return caches.open(CACHE)}
async function cacheNetworkResponse(request,response){
  if(response.ok){
    try{
      // Persist under the canonical URL: timestamped ?t= requests must
      // update the offline snapshot, not create an unbounded cache entry.
      const canonical=new URL(request.url);
      canonical.search='';canonical.hash='';
      await (await latestCache()).put(canonical.href,response.clone());
    }catch(_){}
  }
  return response;
}
async function currentThenPrevious(request){
  // IMPORTANT: CacheStorage.match() alone searches OLD caches first and can
  // keep returning 0.16.5 when offline even after 0.17 has activated.
  const current=await latestCache();
  return await current.match(request,{ignoreSearch:true})||
    await caches.match(request)||
    new Response('Offline',{status:503,statusText:'Offline'});
}
async function dataNetworkFirst(request){
  // Public market/FX/filing files change on GitHub. A cache-first handler
  // intercepted fetch(...,{cache:'no-store'}) and froze iPhone quotes.
  // Always try the network first; offline retains the newest verified cache.
  try{
    const response=await fetch(request,{cache:'no-store'});
    if(!response.ok)throw Error('HTTP '+response.status);
    const type=(response.headers.get('content-type')||'').toLowerCase();
    if(new URL(request.url).pathname.endsWith('.json')&&type.includes('text/html'))
      throw Error('HTML statt Kursdaten');
    return await cacheNetworkResponse(request,response);
  }catch(_){
    const current=await latestCache();
    return await current.match(request,{ignoreSearch:true})||
      await caches.match(request)||
      new Response('Offline',{status:503,statusText:'Offline'});
  }
}
async function navigateNetworkFirst(request){
  try{
    return await cacheNetworkResponse(request,await fetch(request));
  }catch(_){
    const current=await latestCache();
    return await current.match(request,{ignoreSearch:true})||
      await current.match('./index.html')||
      await caches.match(request)||
      await caches.match('./index.html')||
      new Response('Offline',{status:503,statusText:'Offline'});
  }
}
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET'||new URL(request.url).origin!==location.origin)return;
  const url=new URL(request.url);
  // GitHub Pages also hosts HÖRBLICK and KONTAKTE under this origin.
  // Never intercept another app's files using UNITY's cache.
  const scope=self.registration?.scope||location.origin+'/';
  const assetPaths=new Set(ASSETS.map(asset=>new URL(asset,scope).pathname));
  if(!assetPaths.has(url.pathname))return;
  if(request.mode==='navigate'||url.pathname.endsWith('/index.html')){
    event.respondWith(navigateNetworkFirst(request));
    return;
  }
  const dataPath=new URL('data/',self.registration?.scope||location.origin+'/').pathname;
  if(url.pathname.startsWith(dataPath)){
    event.respondWith(dataNetworkFirst(request));
    return;
  }
  event.respondWith(currentThenPrevious(request));
});
