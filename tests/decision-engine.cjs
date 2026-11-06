'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const today=new Date().toISOString().slice(0,10),future=new Date(Date.now()+30*86400000).toISOString().slice(0,10),
 soon=new Date(Date.now()+2*86400000).toISOString().slice(0,10);
const s={id:'unified-1',isin:'DE000ENER6Y0',ticker:'ENR',name:'Siemens Energy',exchange:'Xetra',currency:'EUR'};
const report={id:s.id,earningsConfirmed:true,earningsDate:future,fairValue:135};
const cache={instruments:[s],fundamentals:[report],analyses:[],transactions:[],settings:[]};
let quotes={x:{date:today,price:100,exchange:'Xetra',currency:'EUR',source:'verified EOD'},quality:{canCompare:true,level:'eod'},valid:true,technical:true};
let fx={rate:1,source:'EUR',date:today},miss=[],adverse=[],available=true,position=0,
 signal={kind:'reached',high:103,low:97,date:today,close:100},exitLevel=94,issuer=null;
let autoOrder={mode:'technical',allocationEur:250};
let deep={kind:'positive',investmentReady:true,investmentScore:81.2,entryLower:97,entryUpper:103,
 rr:2.8,confidence:'Hoch (nur für die modellierten Bedingungen)',missing:[],reason:'Freigabe geprüft'};
const stored=[],sandbox={
 Date,Math,Number,Array,Object,JSON,Set,String,
 cache,
 unityIsCryptoAsset:()=>false,
 unityHomeQuote:()=>quotes,
 unityEuroRate:()=>fx,
 unityReadinessEvidence:()=>({missing:miss.map(label=>({label})),adverse}),
 unityDeepDecision:()=>deep,
 depotPosition:()=>({qty:position}),
 unityPullbackAlert:()=>signal,
 unityAutoExitZone:()=>exitLevel,
 unityIssuerDecisionEvidence:()=>issuer,
 unityAutoBuy:()=>autoOrder,
 unityAutoEurAmount:o=>o?.allocationEur===undefined?NaN:Number(o.allocationEur),
 depotMoney:n=>Number(n).toFixed(2)+' €',
 esc:x=>String(x??''),
 put:async(store,obj)=>{assert.equal(store,'analyses');stored.push(obj)}
};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('decision-engine.js','utf8'),sandbox);
const evaluate=(mode='strict')=>vm.runInContext("unityDecisionForStock(stock,"+JSON.stringify(mode)+")",Object.assign(sandbox,{stock:s}));
const assertContract=x=>{
 for(const key of ['action','dataStatus','mode','scoreBand','confidence','veto','signalAt','priceRef',
  'trigger','invalidation','capitalPct','why','realOrderApproved','testActionEligible','reasonCode']){
  assert.ok(Object.hasOwn(x,key),'Missing canonical field: '+key);
 }
 assert.equal(x.realOrderApproved,false);
};
(async()=>{
 // A fully sourced model can propose a strict paper purchase but never real orders.
 let v=evaluate();
 assertContract(v);
 assert.equal(v.action,'BUY');assert.equal(v.reasonCode,'fundamentally-approved');
 assert.equal(v.capitalPct,null);assert.equal(v.scoreBand,'80–89 / 100');
 assert.equal(v.priceRef.price,100);assert.equal(v.priceRef.exchange,'Xetra');
 assert.equal(v.testActionEligible,true);
 let copy=evaluate();
 assert.deepEqual(JSON.parse(JSON.stringify(v)),JSON.parse(JSON.stringify(copy)),'Same inputs must yield same decision');
 let tech=evaluate('technical');assert.equal(tech.action,'BUY');
 assert.equal(tech.capitalPct,null);
 assert.equal(tech.confidence,'Nur technisches Signal – keine Anlagefreigabe');
 autoOrder={mode:'technical',allocationEur:250};
 tech=evaluate('technical');
 assert.equal(tech.capitalEur,250,'Decision must show configured EUR amount');
 assert.equal(tech.capitalPct,null,'EUR allocation must not be described as 2 percent');
 assert.match(vm.runInContext('unityDecisionPanel(stock)',sandbox),/Fester Testbetrag 250.00 €/);
 autoOrder={mode:'technical',allocationEur:250};
 // Source missing must NOT imply a negative company opinion or a SELL.
 miss=['Geprüfte Unternehmenszahlen'];
 v=evaluate();
 assert.equal(v.action,'BLOCKED');assert.equal(v.reasonCode,'missing-data');
 assert.equal(v.testActionEligible,false);
 assert.equal(evaluate('technical').action,'BUY','Technical simulation may remain a separate small test');
 miss=[];
 quotes={...quotes,valid:false,quality:{canCompare:false,level:'stale'}};
 assert.equal(evaluate().action,'BLOCKED');
 assert.equal(evaluate('technical').action,'BLOCKED');
 quotes={...quotes,valid:true,quality:{canCompare:true,level:'eod'}};
 fx=null;assert.equal(evaluate('technical').action,'BLOCKED','Missing EUR conversion vetoes a paper trade');
 fx={rate:1,date:today,source:'EUR'};
 quotes.x={...quotes.x,currency:'USD'};
 assert.equal(evaluate('technical').action,'BLOCKED','Wrong quote currency must block');
 quotes.x={...quotes.x,currency:'EUR'};
 // Hard financial risks cannot be offset by a bullish RSI or the total score.
 adverse=['Chance-Risiko-Verhältnis unter 2:1'];
 v=evaluate('technical');assert.equal(v.action,'BLOCKED');assert.equal(v.reasonCode,'risk-veto');
 assert.equal(evaluate().action,'BLOCKED');
 adverse=[];
 issuer={earnings:{confirmed:true,date:soon},positionRisk:null};
 assert.equal(evaluate('technical').reasonCode,'event-veto','Near earnings blocks fresh entries');
 assert.equal(evaluate().action,'BLOCKED');
 issuer=null;
 // A negative entry today is NOT a sale of a held position.
 position=5;signal={kind:'watch',high:103};v=evaluate();
 assert.equal(v.action,'HOLD');assert.equal(v.reasonCode,'position-monitor');
 assert.equal(evaluate('technical').action,'HOLD');
 deep={...deep,kind:'no',investmentReady:false,reason:'Einstiegsbedingungen verfehlt'};
 assert.equal(evaluate().action,'HOLD','Failed new-entry conditions do not force a sale');
 deep={...deep,kind:'positive',investmentReady:true};
 quotes.x={...quotes.x,price:91};exitLevel=95;
 v=evaluate('technical');assert.equal(v.action,'SELL');
 assert.equal(v.reasonCode,'technical-exit');assert.equal(v.testActionEligible,true);
 // Strict: a fundamental exit needs VERIFIED issuer evidence; unverified rumours never count.
 issuer={earnings:{confirmed:true,date:future},positionRisk:{verified:false,kind:'thesis-broken',label:'Rumour'}};
 assert.equal(evaluate().action,'HOLD');
 issuer={earnings:{confirmed:true,date:future},positionRisk:{verified:true,kind:'guidance-cut',label:'Guidance reduced'}};
 assert.equal(evaluate().action,'SELL');
 quotes={...quotes,valid:false,quality:{canCompare:false,level:'stale'}};
 assert.equal(evaluate().action,'BLOCKED','No inferred executable sale on stale price');
 quotes={...quotes,valid:true,quality:{canCompare:true,level:'eod'}};
 position=0;issuer=null;quotes.x={...quotes.x,price:100};signal={kind:'watch',high:103};deep={...deep,kind:'wait',investmentReady:false};
 assert.equal(evaluate('technical').action,'HOLD','Waiting is not a negative or sell recommendation');
 // Confirm automatic immutable ledger uses the actual decision reference (never Date alone).
 signal={kind:'reached',high:103};
 assert.equal(await vm.runInContext("unityDecisionLedgerCapture(stock,'strict')",sandbox),true);
 assert.equal(stored.length,1);
 assert.equal(cache.analyses.length,1);
 assert.equal(stored[0].kind,'unity-decision-ledger-v1');
 assert.equal(stored[0].decisionSnapshot.action,'HOLD');
 assert.equal(stored[0].decisionSnapshot.realOrderApproved,false);
 assert.equal(await vm.runInContext("unityDecisionLedgerCapture(stock,'strict')",sandbox),false,'Same snapshot deduped');
 assert.equal(stored.length,1);
 const oldId=stored[0].id;
 quotes.x={...quotes.x,date:future,price:101};
 assert.equal(await vm.runInContext("unityDecisionLedgerCapture(stock,'strict')",sandbox),true);
 assert.equal(stored.length,2);assert.notEqual(stored[1].id,oldId);
 assert.match(vm.runInContext('unityDecisionPanel(stock)',sandbox),/Hierarchisches Entscheidungssystem/);
 assert.match(vm.runInContext('unityDecisionPanel(stock)',sandbox),/Technische Testsimulation separat/);
 assert.match(vm.runInContext('unityDecisionPanel(stock)',sandbox),/Entscheidungsprotokoll/);
 sandbox.unityIsCryptoAsset=()=>true;
 assert.equal(evaluate(),null,'Crypto uses its separate decision system');
 assert.equal(await vm.runInContext("unityDecisionLedgerCapture(stock,'strict')",sandbox),false);
 const html=fs.readFileSync('index.html','utf8'),sw=fs.readFileSync('sw.js','utf8'),home=fs.readFileSync('home.js','utf8');
 assert.match(html,/decision-engine\.js\?v=0\.15\.1\.3/);
 assert.match(sw,/decision-engine\.js\?v=0\.15\.1\.3/);
 assert.match(sw,/unity-lab-v0\.15\.1\.3/);
 assert.match(home,/unityDecisionPanel\(s\)/);
 assert.match(home,/approval\.testActionEligible/);
 assert.match(home,/unityDecisionLedgerCapture/);
 console.log('UNITY 0.15.1: reproducible BUY/HOLD/SELL/BLOCKED, hard veto, FX, issuer risk, position monitoring, local ledger and PWA cache passed.');
})().catch(e=>{console.error(e);process.exitCode=1});
