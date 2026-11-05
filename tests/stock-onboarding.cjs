'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');
const marker=html.indexOf('/* Additions live in local IndexedDB.');
const end=html.indexOf('async function unityEnrichCatalogStocks()',marker);
assert.ok(marker>0&&end>marker);
const functions=html.slice(marker,end);
const catalogStart=html.indexOf('async function addCatalogStock(');
const catalogEnd=html.indexOf('// Erweiterbare, schlüssellose Online-Stammdatensuche.',catalogStart);
const addFn=html.slice(catalogStart,catalogEnd);
assert.match(html,/await unityFinishStockOnboarding\(obj,chart\)/);
assert.match(html,/await unityFinishStockOnboarding\(obj\)/);
assert.match(html,/function stocksView\(\)\{return unityRecentAdditionPanel\(\)/);
assert.match(html,/matches\.slice\(0,term\?matches\.length:15\)/);
assert.match(html,/0\.13\.\d+/);
const catalogLiteral=html.slice(html.indexOf('const CATALOG=['),html.indexOf('];',html.indexOf('const CATALOG=['))+2);
const catalogRows=[...catalogLiteral.matchAll(/\{name:'([^']+)',ticker:'([^']+)',isin:'([^']+)'/g)];
assert.equal(catalogRows.length,new Set(catalogRows.map(m=>m[3])).size,'each ISIN occurs once in the curated catalog');
assert.ok(catalogRows.some(m=>m[1]==='RWE'&&m[3]==='DE0007037129'));
assert.ok(catalogRows.some(m=>m[1]==='Airbus'&&m[3]==='NL0000235190'));
assert.ok(!catalogRows.some(m=>/Bitcoin Cash|Physical Palladium/i.test(m[1])),'non-equity ETPs do not enter the stock catalog');

const stock={id:'new1',name:'ASML',ticker:'ASML',currency:'EUR',isin:'',providerSymbol:'ASML.AS',exchange:'Euronext Amsterdam'};
const noSymbol={id:'new2',name:'Private Placeholder',ticker:'TST',currency:'EUR',isin:'',exchange:'unbestätigt'};
let cached=null,saved=[],auditCalls=[],calls=0,renderCalls=0,fetchable=false,loadFails=false;
const box={Date,Math,Number,String,Array,JSON,console,
 esc:s=>String(s??''),render:()=>renderCalls++,activeTab:'stocks',
 unityMarketForStock:()=>cached,unityDataQuality:()=>({canCompare:true}),
 unityLoadDynamicStock:async()=>{calls++;if(loadFails)throw Error('offline');if(fetchable)cached={currency:'EUR',price:135,date:'2026-11-02',dynamicExperimental:true};},
 unityPersistDynamicHistory:async(s,chart)=>{saved.push({s,chart})},
 unityDynamicItems:new Map(),
 refresh:async()=>{},audit:async(...args)=>auditCalls.push(args),
 put:async(table,obj)=>saved.push({table,obj}),
 id:()=>String(saved.length+10),
 CATALOG:[{...stock}],catalogPresent:()=>false,catalogRecord:()=>null
};
vm.createContext(box);vm.runInContext(functions+'\n'+addFn,box);
const status=()=>vm.runInContext('unityRecentAddition',box);
(async()=>{
 // Preloaded provider chart must be saved locally; no network re-request.
 const chart={price:135,currency:'EUR',date:'2026-11-02',points:[{date:'2026-11-02',close:135}]};
 await vm.runInContext('unityFinishStockOnboarding(st,chart)',Object.assign(box,{st:stock,chart}));
 assert.equal(saved.filter(x=>x.chart).length,1);
 assert.equal(calls,0);
 assert.match(status().label,/indikativ/);
 assert.match(vm.runInContext('unityRecentAdditionPanel()',box),/ASML/);
 // Fresh known data should not trigger duplicate network fetch.
 cached={...chart};
 assert.equal(await vm.runInContext('unityDeferredFirstHistoryLoad(st)',box),true);
 assert.equal(calls,0);
 // A new curated stock without a history must be added immediately
 // then asynchronously request a quote and retain the record even offline.
 cached=null;fetchable=true;
 await vm.runInContext('addCatalogStock(0)',box);
 await new Promise(setImmediate);
 assert.equal(calls,1);
 assert.match(status().label,/Kursreihe verfügbar/);
 assert.equal(saved.filter(x=>x.table==='instruments').length,1);
 assert.ok(auditCalls.length>=1);
 // A record with ambiguous provider must be visible but never guessed.
 calls=0;cached=null;
 await vm.runInContext('unityFinishStockOnboarding(st)',Object.assign(box,{st:noSymbol}));
 assert.equal(calls,0);
 assert.match(status().label,/Daten prüfen/);
 // Failure never deletes the chosen stock or masquerades as a verified quote.
 calls=0;fetchable=false;loadFails=true;cached=null;
 await vm.runInContext('unityFinishStockOnboarding(st)',Object.assign(box,{st:stock}));
 await new Promise(setImmediate);
 assert.equal(calls,1);
 assert.match(status().label,/Daten prüfen/);
 assert.ok(renderCalls>=3);
 console.log('Stock onboarding: automatic cached quote, source status, catalogue addition and offline failure passed.');
})().catch(e=>{console.error(e);process.exitCode=1});
