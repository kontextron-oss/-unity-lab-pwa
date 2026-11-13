const path=new URL(self.registration.scope).pathname;
const PROFILE=path.includes("/klaus-kontakte/")?"klaus":path.includes("/jan-kontakte/")?"jan":"all";
const CACHE=PROFILE==="all"?"kontakte-pwa-v11":"kontakte-"+PROFILE+"-pwa-v11";
const PREFIX=PROFILE==="all"?"kontakte-pwa-":"kontakte-"+PROFILE+"-pwa-";
const SHELL=["./","./index.html","./manifest.webmanifest","./icon.svg","./apple-touch-icon.png"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()));});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith(PREFIX)&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener("fetch",e=>{
 const req=e.request;
 if(req.method!=="GET"||new URL(req.url).origin!==self.location.origin)return;
 if(req.mode==="navigate"){
  e.respondWith(fetch(req).then(resp=>{if(resp.ok){const copy=resp.clone();caches.open(CACHE).then(c=>c.put(req,copy));}return resp;}).catch(()=>caches.match(req).then(c=>c||caches.match("./index.html"))));
 }else{
  e.respondWith(caches.match(req).then(c=>c||fetch(req).then(resp=>{if(resp.ok){const copy=resp.clone();caches.open(CACHE).then(cache=>cache.put(req,copy));}return resp;})));
 }
});
