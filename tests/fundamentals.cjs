'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const src=fs.readFileSync('fundamentals.js','utf8');
assert.match(fs.readFileSync('home.js','utf8'),/unityFundPilotPanel\(s\)/);
assert.match(fs.readFileSync('analysis.js','utf8'),/unityFundPilotPanel\(s\)/);
assert.match(fs.readFileSync('index.html','utf8'),/fundamentals\.js/);
const ctx={Date,Number,Math,JSON,Object,Intl,esc:x=>String(x),db:null,
 fetch:async()=>({ok:true,json:async()=>({schemaVersion:1,items:{
  FR0000121972:{isin:'FR0000121972',name:'Schneider Electric',status:'metrics-partial',reportCurrency:'EUR',source:'XBRL',checkedAt:'2026-11-01',
   latestFiling:{periodEnd:'2025-12-31',reportUrl:'https://filings.xbrl.org/test'},priorFiling:{periodEnd:'2024-12-31'},derived:{revenueGrowth:{value:5.2,unit:'percent',periodEnd:'2025-12-31',priorPeriodEnd:'2024-12-31'}},
   metrics:{revenue:{value:123000000,currency:'EUR',periodEnd:'2025-12-31',concept:'ifrs-full:Revenue'},
            equity:{value:1,currency:'USD',periodEnd:'2025-12-31',concept:'ifrs-full:Equity'}}}
 }})})};
vm.createContext(ctx);vm.runInContext(src,ctx);
(async()=>{
 await new Promise(r=>setTimeout(r,10));
 ctx.s={isin:'FR0000121972'};
 const panel=vm.runInContext('unityFundPilotPanel(s)',ctx);
 assert.match(panel,/123\.000\.000/);
 assert.match(panel,/Originalbericht/);
 assert.match(panel,/Umsatzwachstum gegenüber Vorjahr/);
 assert.match(panel,/5,2 %/);
 assert.match(panel,/Nicht zuverlässig verfügbar/);
 assert.match(panel,/keine Kauf- oder Verkaufsfreigabe/);
 ctx.unknown={isin:'US92537N1081'};
 assert.equal(vm.runInContext('unityFundPilotPanel(unknown)',ctx),'');
 ctx.s={isin:'DE0006231004'};
 assert.match(vm.runInContext('unityFundPilotPanel(s)',ctx),/noch nicht verfügbar/);
 vm.runInContext('unityFundPilot.items["DE0006231004"]={isin:"DE0006231004",status:"issuer-release-only",reportCurrency:"EUR",officialHighlights:{fiscalYear:"2025",sourceType:"issuer-primary-disclosure",sourceUrl:"https://www.infineon.com/press-release/2025/infxx202511-021",currency:"EUR",facts:{revenue:{value:14662000000,currency:"EUR",periodEnd:"2025",kind:"issuer-release",label:"Umsatz"},adjustedFreeCashFlow:{value:1803000000,currency:"EUR",periodEnd:"2025",kind:"issuer-release",label:"Bereinigter Free Cashflow"}}}}',ctx);
 const officialPanel=vm.runInContext('unityFundPilotPanel(s)',ctx);
 assert.match(officialPanel,/14\.662\.000\.000/);
 assert.match(officialPanel,/Bereinigter Free Cashflow/);
 assert.match(officialPanel,/Originalmeldung des Unternehmens/);
 assert.doesNotMatch(officialPanel,/Aus geprüften Berichtskennzahlen berechnet/);
 console.log('Source-linked financial metrics, mismatched-currency veto, no invented metrics and four-company pilot passed.');
})().catch(e=>{console.error(e);process.exitCode=1});
