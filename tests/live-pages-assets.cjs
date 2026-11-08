'use strict';
/*
 * Safe GitHub Actions only: verify EVERY asset required by the actual PWA
 * Service Worker is publicly reachable. A single 404 makes cache.addAll()
 * reject and can strand an iPhone on 0.16.5 indefinitely.
 * Does not require user data or credentials. Does not write to the site.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const code=fs.readFileSync('sw.js','utf8');
const {ASSETS}=vm.runInNewContext(code+'\n;({ASSETS})',{
 self:{addEventListener(){}}
});
assert.ok(Array.isArray(ASSETS)&&ASSETS.length>30);
assert.ok(new Set(ASSETS).size===ASSETS.length);
const base='https://kontextron-oss.github.io/-unity-lab-pwa/';
const errors=[],statusCounts={};
async function probe(asset){
 let response;
 const url=new URL(asset,base);
 try{
  assert.equal(url.origin,'https://kontextron-oss.github.io');
  assert.ok(url.pathname.startsWith('/-unity-lab-pwa/'));
  const marker=url.search?'&':'?';
  response=await fetch(url+marker+'unity_health=017', {
   cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)
  });
  statusCounts[response.status]=(statusCounts[response.status]||0)+1;
  const mime=(response.headers.get('content-type')||'').toLowerCase();
  if(!response.ok||(/\.js$|\.json$/).test(url.pathname)&&mime.includes('text/html')){
   errors.push({asset,status:response.status,type:mime});
  }
 }catch(err){errors.push({asset,error:String(err?.message||err).slice(0,180)})}
 finally{try{await response?.body?.cancel()}catch(_){}}
}
(async()=>{
 for(let i=0;i<ASSETS.length;i+=5)
  await Promise.all(ASSETS.slice(i,i+5).map(probe));
 console.log('UNITY Pages precache health:',ASSETS.length,
  'asset requests, HTTP statuses:',JSON.stringify(statusCounts));
 if(errors.length){
  console.error('CRITICAL: PWA cannot install; missing/invalid precache files:',
   JSON.stringify(errors.slice(0,30),null,2));
  process.exitCode=1;
 }else{
  console.log('All PWA install assets reachable; no public data was modified.');
 }
})().catch(e=>{console.error(e);process.exitCode=1});
