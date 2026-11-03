'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('capital-radar.js','utf8');
const html=fs.readFileSync('index.html','utf8'),sw=fs.readFileSync('sw.js','utf8');
const current=new Date().toISOString();
const when=new Date(Date.now()-86400000).toISOString().slice(0,10);
const data={
 schemaVersion:1,generatedAt:current,sourceFailures:0,topics:{
  transformers:{label:'Transformatoren',cpv:'31170000',status:'available',
    checkedAt:current,events:[{id:'712345-2026',publishedAt:when,
      newSincePreviousScan:true,noticeType:'award-notice',winnerSelectedForAtLeastOneLot:true,title:'New transformer tender',
      buyer:'Grid Operator',winner:'Example Supplier',publishedValue:900000,
      currency:'EUR',url:'https://ted.europa.eu/en/notice/-/detail/712345-2026'}]},
  'power-cables':{label:'Stromkabel',cpv:'31320000',status:'available',
    checkedAt:current,events:[]},
  cooling:{label:'Kühltechnik',cpv:'42510000',status:'stale',
    checkedAt:current,events:[{id:'899999-2026',publishedAt:when,
      title:'Old notice',url:'https://ted.europa.eu/en/notice/-/detail/899999-2026'}]}
 }};
const stocks=[{name:'ABB',ticker:'ABBN',isin:'CH0012221716',providerSymbol:'ABBN.SW'},
 {name:'Vertiv',ticker:'VRT',isin:'US92537N1081',providerSymbol:'VRT'},
 {name:'Apple',ticker:'AAPL',isin:'US0378331005',providerSymbol:'AAPL'}];
const appData={fundamentals:[]};
const box={Date,Math,Number,String,JSON,Array,Map,Intl,cache:appData,db:true,activeTab:'radar',
 stocks:()=>stocks,unityMarketForStock:()=>null,unityDataQuality:()=>({canCompare:false}),
 unityFundPilotItem:()=>null,esc:s=>String(s).replace(/[&<>"']/g,
   c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
 fetch:async()=>({ok:true,json:async()=>data}),render:()=>{box.renderCount=(box.renderCount||0)+1},
 console,renderCount:0};
vm.createContext(box);vm.runInContext(source,box);
const call=code=>vm.runInContext(code,box);
(async()=>{
 assert.equal(call('unityCapitalFresh({generatedAt:"2019-01-01T00:00:00Z"})'),false);
 assert.equal(call('unityCapitalVerifiedUrl("javascript:alert(1)","712345-2026")'),'');
 assert.equal(call('unityCapitalVerifiedUrl("https://ted.europa.eu/en/notice/-/detail/999999-2026","712345-2026")'),'');
 assert.equal(call('unityCapitalVerifiedUrl("https://ted.europa.eu/en/notice/-/detail/712345-2026","712345-2026")'),
   'https://ted.europa.eu/en/notice/-/detail/712345-2026');
 assert.equal(call('unityCapitalMoney(null,"EUR")'),'');
 assert.match(call('unityCapitalView()'),/Kapital- und Ereignisradar/);
 await call('unityCapitalLoad()');
 assert.equal(box.renderCount,1);
 const view=call('unityCapitalView()');
 assert.match(view,/712345-2026/);
 assert.match(view,/Neu erfasst/);
 assert.match(view,/keine bestätigte Vergabe an diese Unternehmen/);
 assert.match(view,/Vergabestelle/);
 assert.match(view,/Mindestens ein Los mit ausgewähltem Gewinner/);
 assert.match(view,/3 Aktien erfasst/);
 assert.match(view,/3 mit mindestens einer Datenlücke/);
 assert.match(view,/bestätigten nächsten Earnings-Termin/);
 assert.match(view,/keine institutionellen Aktienzuflüsse/);
 assert.doesNotMatch(view,/Old notice/); // stale results must not be shown.
 call('unityCapitalData.generatedAt="2020-01-01T00:00:00Z"');
 assert.doesNotMatch(call('unityCapitalView()'),/New transformer tender/);
 assert.match(call('unityCapitalView()'),/Datenstand zu alt/);
 call('unityCapitalData.generatedAt=new Date().toISOString()');
 call('unityCapitalData.topics.transformers.status="unavailable"');
 assert.doesNotMatch(call('unityCapitalView()'),/New transformer tender/);
 assert.match(html,/data-tab="radar">Kapitalradar/);
 assert.match(html,/radar:unityCapitalView/);
 assert.match(html,/unityCapitalLoad\(\)/);
 assert.match(html,/unity-cap-reload/);
 assert.match(html,/capital-radar\.js\?v=0\.13\.52/);
 assert.match(sw,/capital-radar\.js\?v=0\.13\.52/);
 assert.match(sw,/capital_events\.json/);
 assert.match(sw,/unity-lab-v0\.13\.52/);
 console.log('Capital radar: official-only TED links, first-seen markers, separate data-readiness, stale evidence veto and mobile navigation passed.');
})().catch(e=>{console.error(e);process.exitCode=1});
