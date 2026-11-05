'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('issuer-calendar.js','utf8');
const stock={ticker:'ABCD',providerSymbol:'ABCD',isin:'US0000000001'};
const end=new Date(Date.now()-120*86400000).toISOString().slice(0,10);
const ctx={Date,Number,String,Array,JSON,esc:x=>String(x),render:()=>{},
 unityFundPilotItem:()=>({latestFiling:{periodEnd:end,reportUrl:'https://data.sec.gov/api/xbrl/companyfacts/CIK0000000001.json'},
  metrics:{revenue:{value:1},netIncome:{value:1},assets:{value:1},equity:{value:1},operatingCashFlow:{value:1}}}),
 fetch:async()=>({ok:true,json:async()=>({generatedAt:new Date().toISOString(),items:{ABCD:{status:'confirmed-future-earnings',nextEarnings:'2026-12-01',sourceUrl:'https://investor.example.com/calendar',annualReportUrl:'https://investor.example.com/annual-report'}}})})};
vm.createContext(ctx);vm.runInContext(source,ctx);
(async()=>{
 await new Promise(resolve=>setTimeout(resolve,10));
 ctx.stock=stock;
 const rows=vm.runInContext('unityIssuerEvidenceMatrix(stock)',ctx);
 assert.equal(rows.length,5);
 assert.equal(rows.find(x=>x.key==='fundamentals').verified,true);
 assert.equal(rows.find(x=>x.key==='fundamentals').sourceUrl,'https://data.sec.gov/api/xbrl/companyfacts/CIK0000000001.json');
 assert.equal(rows.find(x=>x.key==='earnings').verified,true);
 assert.equal(rows.find(x=>x.key==='guidance').verified,false);
 assert.equal(rows.find(x=>x.key==='risk').verified,false);
 const decision=vm.runInContext('unityIssuerDecisionEvidence(stock)',ctx);
 assert.equal(decision.fundamentals.verified,true);
 assert.equal(decision.guidance.verified,false);
 const panel=vm.runInContext('unityIssuerEvidencePanel(stock)',ctx);
 assert.match(panel,/Entscheidungsbelege/);
 assert.match(panel,/Guidance/);
 assert.match(panel,/nicht durch technische Signale/);
 console.log('Issuer decision evidence: source-bound fundamentals and earnings, no fabricated guidance/thesis/risk evidence passed.');
})().catch(error=>{console.error(error);process.exitCode=1});
