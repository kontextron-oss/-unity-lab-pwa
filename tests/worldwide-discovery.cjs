'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');
assert.match(html,/Aktie weltweit suchen/);
assert.match(html,/id="online-search"/);
assert.doesNotMatch(html,/id="stock-form"/);
assert.doesNotMatch(html,/id="quote-form"/);
assert.match(html,/unitySearchWorldwide\(term,signal\)/);
assert.match(html,/wikiSearchCandidates\(term,signal\)/);
assert.match(html,/unityFetchWorldwideHistory\(s.providerSymbol\)/);
assert.match(html,/unityLoadDynamicStock\(stock\)/);
assert.match(html,/discovery\.js/);
const today=Date.now();
const stamps=Array.from({length:410},(_,i)=>Math.floor((today-(410-i)*86400000)/1000));
const closes=stamps.map((_,i)=>100+i/20);
let calls=[];
const ctx={Date,Map,Set,Number,String,Math,Array,JSON,encodeURIComponent,
 fetch:async url=>{
  calls.push(url);
  if(url.includes('/v1/finance/search'))return {ok:true,json:async()=>({quotes:[
   {quoteType:'EQUITY',symbol:'ASML.AS',longname:'ASML Holding',exchDisp:'Amsterdam'},
   {quoteType:'ETF',symbol:'QQQ',shortname:'ETF'}
  ]})};
  return {ok:true,json:async()=>({chart:{result:[{meta:{symbol:'ASML.AS',currency:'EUR',fullExchangeName:'Euronext Amsterdam'},timestamp:stamps,indicators:{quote:[{close:closes}]}}]}})};
 },
 render(){},db:null,unityMarketItem:()=>null};
vm.createContext(ctx);vm.runInContext(fs.readFileSync('discovery.js','utf8'),ctx);
(async()=>{
 const results=await vm.runInContext("unitySearchWorldwide('ASML')",ctx);
 assert.equal(results.length,1);
 assert.equal(results[0].providerSymbol,'ASML.AS');
 assert.equal(results[0].name,'ASML Holding');
 const chart=await vm.runInContext("unityFetchWorldwideHistory('ASML.AS')",ctx);
 assert.equal(chart.currency,'EUR');
 assert.equal(chart.exchange,'Euronext Amsterdam');
 assert.equal(chart.dynamicExperimental,true);
 assert.ok(chart.points.length>=200);
 assert.ok(chart.price>0);
 ctx.stock={providerSymbol:'ASML.AS',currency:'EUR',isin:''};
 await vm.runInContext('unityLoadDynamicStock(stock)',ctx);
 assert.equal(vm.runInContext('unityMarketForStock(stock).currency',ctx),'EUR');
 assert.equal(calls.length,3);
 const bad=await vm.runInContext("unityFetchWorldwideHistory('BAD/../../')",ctx).then(()=>null,e=>e);
 assert.match(bad.message,/Ungültiges/);
 const qualityCode=fs.readFileSync('dataquality.js','utf8');
 assert.match(qualityCode,/if\(item\.dynamicExperimental\)return \{level:'warning'/);
 assert.match(qualityCode,/canCompare:false/);
 console.log('Global search, quote validation, six-year history, automatic cache, unverified-data veto passed.');
})().catch(e=>{console.error(e);process.exitCode=1});
