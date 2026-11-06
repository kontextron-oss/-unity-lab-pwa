'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const stamp=new Date().toISOString().slice(0,10);
const future=new Date(Date.now()+30*86400000).toISOString().slice(0,10);
const nextWeek=new Date(Date.now()+2*86400000).toISOString().slice(0,10);
const ABB={id:'abb',name:'ABB',isin:'CH0012221716',ticker:'ABBN',exchange:'SIX',currency:'CHF'};
const SE={id:'se',name:'Siemens Energy',isin:'DE000ENER6Y0',ticker:'ENR',exchange:'Xetra',currency:'EUR'};
const SU={id:'su',name:'Schneider Electric',isin:'FR0000121972',ticker:'SU',exchange:'Paris',currency:'EUR'};
const IFX={id:'ifx',name:'Infineon',isin:'DE0006231004',ticker:'IFX',exchange:'Xetra',currency:'EUR'};
const instruments=[ABB,SE,SU,IFX];
const manual={
 id:'su',dataSource:'https://www.se.com/reports',balanceChecked:true,guidanceChecked:true,
 thesis:'Kritische Energieinfrastruktur mit nachprüfbarem Wachstum',
 risks:'Widerlegung bei rückläufiger Auftragslage',flowEvidence:'Offizieller Bericht, geprüft',
 alternativeEvidence:'Peer-Vergleich mit Industrietechnikunternehmen',
 eps:12,bookValue:40,fairValue:300,roe:18,debtEquity:.5,epsGrowth:10,fcfYield:4,
 stop:170,target:300,flowScore:75,alternativesScore:70
};
const stockData={
 abb:{quote:{x:{date:stamp,price:100,exchange:'SIX',currency:'CHF',source:'official',
   points:Array.from({length:220},(_,i)=>({close:100+i/10}))},
   m:{trend:'Aufwärtstrend',rsi:50},valid:true,technical:true,quality:{level:'eod'}}},
 se:{quote:{x:{date:stamp,price:100,exchange:'Xetra',currency:'EUR',source:'official',
   points:Array.from({length:220},(_,i)=>({close:100+i/10}))},
   m:{trend:'Aufwärtstrend',rsi:55},valid:true,technical:true,quality:{level:'eod'}}},
 su:{quote:{x:{date:stamp,price:200,exchange:'Paris',currency:'EUR',source:'official',
   points:Array.from({length:220},(_,i)=>({close:100+i/10}))},
   m:{trend:'Aufwärtstrend',rsi:52},valid:true,technical:true,quality:{level:'eod'}}},
 ifx:{quote:{x:{date:stamp,price:80,exchange:'Xetra',currency:'EUR',source:'official',
   points:Array.from({length:220},(_,i)=>({close:100+i/10}))},
   m:{trend:'Abwärtstrend',rsi:35},valid:true,technical:true,quality:{level:'eod'}}}
};
const reports={
 abb:{status:'issuer-release-only',officialHighlights:{facts:{revenue:{value:200}}},checkedAt:stamp},
 se:{status:'issuer-release-only',officialHighlights:{facts:{revenue:{value:200},netIncome:{value:10}}},checkedAt:stamp},
 su:{status:'metrics-complete',latestFiling:{periodEnd:'2025-12-31',reportUrl:'https://filings.xbrl.org/a'},checkedAt:stamp},
 ifx:{status:'issuer-release-only',officialHighlights:{facts:{revenue:{value:20}}},checkedAt:stamp}
};
let fxCHF=null,missingQuote=false,badIdentity=false,earningsNear=false;
const box={
 Date,Math,Number,Array,Object,JSON,
 cache:{fundamentals:[manual]},stocks:()=>instruments,
 unityHomeQuote:s=>missingQuote&&s.id==='abb'?{x:null,m:null,quality:null,valid:false,technical:false}:
   badIdentity&&s.id==='abb'?{...stockData[s.id].quote,valid:false,quality:{level:'invalid',detail:'ISIN-Konflikt'}}:
   stockData[s.id].quote,
 unityEuroRate:c=>c==='EUR'?{rate:1,date:stamp,source:'EUR'}:fxCHF,
 unityFundPilotItem:s=>reports[s.id],
 unityDeepFilingEvidence:s=>({verified:s.id==='su',period:s.id==='su'?'2025-12-31':'',source:s.id==='su'?'https://filings.xbrl.org/a':''}),
 unityIssuerCalendarItem:s=>s.id==='su'||s.id==='ifx'?{
   status:'confirmed-future-earnings',nextEarnings:s.id==='ifx'&&earningsNear?nextWeek:future,
   checkedAt:stamp,sourceUrl:'https://example.com/ir'}:null,
 unityIssuerCalendarFresh:()=>true,
 esc:v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;')
};
vm.createContext(box);
vm.runInContext(fs.readFileSync('readiness-audit.js','utf8'),box);
const inspect=id=>vm.runInContext('unityReadinessEvidence('+JSON.stringify(instruments.find(s=>s.id===id))+')',box);
let r=inspect('se');
assert.equal(r.technicalReady,true);
assert.equal(r.sourceComplete,false);
assert.equal(r.status,'missing');
assert.equal(r.adverse.length,0,'Missing data must never be negative signal');
assert.match(r.fields.filing.detail,/issuer-release-only/);
assert.match(r.fields.filing.detail,/2 Fakten/);
assert.equal(r.fields.earnings.status,'missing');
assert.equal(r.tradeApproved,false);
r=inspect('abb');
assert.equal(r.fields.fx.status,'missing');
assert.equal(r.adverse.length,0);
fxCHF={rate:1.1,date:stamp,source:'EZB'};
assert.equal(inspect('abb').fields.fx.status,'ready');
r=inspect('su');
assert.equal(r.sourceComplete,true,'All nine source fields and valuation inputs can be complete');
assert.equal(r.status,'review');
assert.equal(r.tradeApproved,false,'Even complete source data cannot grant an order');
manual.target=240;
r=inspect('su');
assert.equal(r.sourceComplete,true);
assert.ok(r.adverse.some(x=>/Chance-Risiko-Verhältnis/.test(x)));
assert.equal(r.status,'negative','Real unfavorable R:R must differ from data missing');
manual.target=300;
manual.fairValue=210;
assert.ok(inspect('su').adverse.some(x=>/Sicherheitsmarge/.test(x)));
manual.fairValue=300;
stockData.se.quote.m.rsi=null;
assert.equal(inspect('se').adverse.length,0,'Missing RSI must not be called an adverse technical signal');
stockData.se.quote.m.rsi=55;
r=inspect('ifx');
assert.equal(r.status,'missing');
assert.ok(r.adverse.some(x=>/Abwärtstrend/.test(x)));
assert.ok(r.adverse.some(x=>/RSI/.test(x)));
earningsNear=true;
assert.ok(inspect('ifx').adverse.some(x=>/Ergebnisereignis/.test(x)));
earningsNear=false;
badIdentity=true;
r=inspect('abb');
assert.equal(r.fields.quote.status,'conflict','Wrong security reference must be a source conflict');
assert.equal(r.adverse.length,0,'Identity conflict must not be a sell decision');
badIdentity=false;missingQuote=true;
r=inspect('abb');
assert.equal(r.fields.quote.status,'missing');
assert.equal(r.technicalReady,false);
assert.equal(r.adverse.length,0,'Missing price must not invent valuation or trend rejection');
missingQuote=false;
// The standard contract must cover arbitrary newly added equities, not only
// the four European pilot issuers. Missing sources are not negative signals.
const dataset=vm.runInContext('unityReadinessStandardDataset(stocks())',box);
assert.equal(dataset.schemaVersion,1);
assert.equal(dataset.kind,'unity-equity-readiness-dataset');
assert.equal(dataset.total,4);
assert.equal(dataset.records.length,4);
assert.equal(dataset.counts.technicalReady,4);
assert.equal(dataset.counts.sourceComplete,1);
assert.equal(dataset.counts.incomplete,3);
assert.equal(dataset.counts.adverse,1,'Independent negative indicators stay separate');
assert.equal(dataset.records[0].instrument.isin,ABB.isin);
assert.equal(dataset.records[0].fields.filing.status,'missing');
assert.equal(dataset.records[0].tradeApproved,false);
assert.doesNotThrow(()=>JSON.stringify(dataset),'The contract must be portable JSON');
const expanded=vm.runInContext('unityReadinessStandardDataset(stocks().concat([{id:"new",name:"Neuer Wert",isin:"GB0000000001",ticker:"NEW",exchange:"London",currency:"GBP"}]))',box);
assert.equal(expanded.records.length,5,'New equities must use the same source schema');
assert.equal(expanded.records.at(-1).instrument.name,'Neuer Wert');
assert.equal(expanded.records.at(-1).dataStatus,'incomplete');
assert.equal(expanded.records.at(-1).adverseSignals.length,0,'Unmapped issuer is not a SELL');
assert.equal(expanded.records.at(-1).tradeApproved,false);
badIdentity=true;
assert.equal(vm.runInContext('unityReadinessStandardDataset(stocks())',box).records[0].dataStatus,'conflict');
badIdentity=false;
box.unityIsCryptoAsset=x=>x.id==='abb';
assert.equal(vm.runInContext('unityReadinessStandardDataset(stocks())',box).total,3,'Cryptocurrencies require a separate model');
delete box.unityIsCryptoAsset;
let overview=vm.runInContext('unityReadinessOverview(stocks())',box);
assert.match(overview,/technisch auswertbar/);
assert.match(overview,/Prüffelder belegt/);
assert.match(overview,/Daten unvollständig/);
assert.match(overview,/Schneider Electric/);
assert.match(overview,/Siemens Energy/);
assert.match(overview,/Infineon/);
assert.match(overview,/ABB/);
assert.match(overview,/Datenstatus aller 4 Aktien der Masterliste/);
box.unityIsCryptoAsset=x=>x.id==='abb';
overview=vm.runInContext('unityReadinessOverview(stocks())',box);
assert.match(overview,/3<\/b><small>technisch auswertbar/,'Crypto excluded from equity readiness counts');
delete box.unityIsCryptoAsset;
const detail=vm.runInContext('unityReadinessDetail(stocks()[1])',box);
assert.match(detail,/Warum ist die UNITY-Freigabe offen/);
assert.match(detail,/issuer-release-only/);
assert.match(detail,/Daten/);
const index=fs.readFileSync('index.html','utf8'),sw=fs.readFileSync('sw.js','utf8');
assert.match(index,/readiness-audit\.js\?v=0\.15\.3\.5/);
assert.match(sw,/readiness-audit\.js\?v=0\.15\.3\.5/);
assert.match(index,/home\.js\?v=0\.15\.3\.5/);
assert.match(sw,/unity-lab-v0\.15\.3\.5/);
const source=fs.readFileSync('home.js','utf8');
assert.match(source,/unityReadinessOverview/);
assert.match(source,/unityReadinessDetail/);
console.log('UNITY readiness 0.15.0: missing facts, FX, earnings, negative signals, identity conflicts, pilot display and no order approval passed.');
