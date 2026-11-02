'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('research.js','utf8');
const date=new Date().toISOString().slice(0,10);
const stock={name:'Eaton',ticker:'ETN',isin:'IE00B8KQN827',providerSymbol:'ETN'};
const base={schemaVersion:1,generatedAt:new Date().toISOString(),items:{
 [stock.isin]:{name:'Eaton',ticker:'ETN',status:'metrics-partial',checkedAt:new Date().toISOString(),
 source:'SEC EDGAR',
 metrics:{revenue:{value:1000000000,unit:'USD',period:'FY',end:'2025-12-31',filed:date}},
 events:[{form:'8-K',label:'Unternehmensmeldung',filedAt:date,source:'SEC EDGAR',
 url:'https://www.sec.gov/Archives/edgar/data/1234/000001234526000001/report.htm'},
 {form:'10-Q',label:'Quartalsbericht',filedAt:'2025-01-01',source:'SEC EDGAR',
 url:'https://www.sec.gov/Archives/edgar/data/1234/000001234525000001/q.htm'}]}
}};
const ctx={Date,Math,Number,String,Array,JSON,Intl,db:null,
 fetch:async()=>({ok:true,json:async()=>base}),
 esc:x=>String(x),render:()=>{}};
vm.createContext(ctx);
vm.runInContext(source,ctx);
(async()=>{
 await new Promise(r=>setImmediate(r));
 ctx.stock=stock;
 const panel=vm.runInContext('unityResearchPanel(stock)',ctx);
 assert.match(panel,/Automatischer Quellenmonitor/);
 assert.match(panel,/1 Mrd. USD/);
 assert.match(panel,/Original öffnen/);
 assert.match(panel,/keine Handelsfreigabe/i);
 const badge=vm.runInContext('unityResearchBadge(stock)',ctx);
 assert.match(badge,/Neue Pflichtmeldung/);
 ctx.stock={...stock,isin:'GB9999999999',providerSymbol:'ETN'};
 assert.equal(vm.runInContext('unityResearchItem(stock)',ctx),null);
 ctx.stock=stock;ctx.unityResearch.generatedAt='2019-01-01T00:00:00Z';
 assert.equal(vm.runInContext('unityResearchRecent(stock)',ctx),null);
 assert.doesNotMatch(vm.runInContext('unityResearchPanel(stock)',ctx),/Amtliche Zahlen teilweise verfügbar/);
 ctx.unityResearch.generatedAt=new Date().toISOString();
 ctx.unityResearch.items[stock.isin].status='stale-previous';
 assert.equal(vm.runInContext('unityResearchRecent(stock)',ctx),null);
 assert.equal(vm.runInContext("unityResearchSourceLink('javascript:alert(1)')",ctx),'');
 assert.equal(vm.runInContext("unityResearchSourceLink('https://evil.example/sec.gov')",ctx),'');
 assert.equal(vm.runInContext("unityResearchSourceLink('https://www.sec.gov/Archives/edgar/data/1234/x.htm')",ctx),
   'https://www.sec.gov/Archives/edgar/data/1234/x.htm');
 const home=fs.readFileSync('home.js','utf8');
 const analysis=fs.readFileSync('analysis.js','utf8');
 const index=fs.readFileSync('index.html','utf8');
 const sw=fs.readFileSync('sw.js','utf8');
 assert.match(home,/unityResearchPanel\(s\)/);
 assert.match(home,/issuerBadge/);
 assert.match(analysis,/unityResearchPanel\(s\)/);
 assert.match(index,/research\.js\?v=0\.13\.\d+/);
 assert.match(index,/issuerBadge/);
 assert.match(sw,/research\.js\?v=0\.13\.\d+/);
 assert.match(sw,/data\/research\.json/);
 console.log('UNITY issuer research monitor: official events, source links, stale data, identity mismatch and PWA integration passed.');
})().catch(err=>{console.error(err);process.exitCode=1});
