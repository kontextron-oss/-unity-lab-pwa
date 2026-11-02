'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('home.js','utf8'),start=source.indexOf('function unityPullbackAlert(s){'),end=source.indexOf('function unityHomeVerdict(s)',start);
assert.ok(start>=0&&end>start);
const script=source.slice(start,end);
const stock={id:'S1',name:'ABB',ticker:'ABBN',isin:'CH0012221716',currency:'CHF'};
const points=Array.from({length:220},(_,i)=>({date:'2026-'+String(i+1),close:100}));
points.at(-2).close=104;points.at(-1).close=101;
let price=101,quality=true,experimental=false;
let market={isin:stock.isin,currency:'CHF',price,date:'2026-11-02',points};
let metric={ma50:100,ma200:90,rsi:55,trend:'Aufwärtstrend'};
let fundamentals=[];
const ctx={
 Date,Math,Number,String,Array,JSON,
 cache:{fundamentals},unityHomeQuote:s=>({x:market,m:metric,technical:true,quality:{canCompare:quality}}),
 esc:x=>String(x)
};
vm.createContext(ctx);vm.runInContext(script,ctx);
const status=()=>vm.runInContext('unityPullbackAlert(s)',Object.assign(ctx,{s:stock}));
let d=status();
assert.equal(d.kind,'reached');
assert.equal(d.label,'Rücksetzer eingetreten');
assert.equal(d.low,98);
assert.equal(d.high,102);
assert.equal(d.date,'2026-11-02');
assert.match(vm.runInContext('unityPullbackLabel(s,unityPullbackAlert(s))',ctx),/Rücksetzer eingetreten/);
// At an active zone already reached yesterday, mark reached but do not claim a new event.
points.at(-2).close=101;
d=status();
assert.equal(d.label,'Einstiegszone erreicht');
// Price above zone: observe until a real valid daily close confirms the pullback.
market={...market,price:104,points};
d=status();
assert.equal(d.kind,'watch');
assert.equal(d.label,'Rücksetzer abwarten');
assert.match(vm.runInContext('unityPullbackLabel(s,unityPullbackAlert(s))',ctx),/Rücksetzer abwarten/);
// Too large a drop: avoid a misleading positive notification.
market={...market,price:96};
d=status();
assert.equal(d.kind,'broken');
assert.equal(vm.runInContext('unityPullbackLabel(s,unityPullbackAlert(s))',ctx),'');
// Market closed or quote invalid => no alert, even with seemingly favorable prices.
market={...market,price:101};
quality=false;d=status();assert.equal(d.kind,'data');assert.equal(d.label,'');
quality=true;
market.dynamicExperimental=true;
d=status();assert.equal(d.kind,'data');assert.equal(d.label,'');
market.dynamicExperimental=false;market.currency='USD';
d=status();assert.equal(d.kind,'data');market.currency='CHF';
// Trend or RSI deterioration removes an otherwise attractive entry trigger.
metric.rsi=75;assert.equal(status().kind,'none');
metric.rsi=55;metric.trend='Abwärtstrend';assert.equal(status().kind,'none');
metric.trend='Aufwärtstrend';
// Documented bad RR blocks a green entry alert.
fundamentals.push({id:stock.id,stop:96,target:108});
d=status();assert.equal(d.kind,'blocked');
assert.match(d.detail,/unter 2:1/);
fundamentals.splice(0,1);
// Earnings within 7 days keeps alert visible but clearly risk-labeled.
fundamentals.push({id:stock.id,earningsConfirmed:true,
 earningsDate:new Date(Date.now()+2*86400000).toISOString().slice(0,10)});
d=status();assert.equal(d.kind,'blocked');assert.match(d.detail,/Earnings/);
fundamentals.splice(0,1);
// Portfolio and chart view both show the same status, all stocks remain rendered.
assert.match(source,/const position=depotPosition\(s\),research=unityResearchIndicator\(s\),pullback=unityPullbackAlert\(s\)/);
assert.match(source,/const reachedPullbacks=pullbackResults.filter/);
assert.match(source,/ranks=new Map\(list.map/);
const html=fs.readFileSync('index.html','utf8');
assert.match(html,/unityPullbackLabel\(s,pullback\)/);
assert.match(html,/0\.13\.\d+/);
assert.match(fs.readFileSync('sw.js','utf8'),/unity-lab-v0\.13\.\d+/);
// Deep analysis must apply the same *lower* SMA50 boundary.
const analyse=fs.readFileSync('analysis.js','utf8');
const ac={Date,Math,Number,Array,JSON,Intl,document:{addEventListener(){}},cache:{fundamentals:[],histories:[],strategies:[]},
 unityCalc:()=>({q:{price:100},p:100,t:{n:260,last:97,ma50:100,ma200:90,rsi:55}})};
ac.uc=n=>Math.max(0,Math.min(100,n));ac.unityNumber=(n,d=2)=>Number(n).toFixed(d);
const candidateStart=analyse.indexOf('function unityCandidate(s){'),candidateEnd=analyse.indexOf('/* Compact decision brief',candidateStart);
assert.ok(candidateStart>0&&candidateEnd>candidateStart);
vm.createContext(ac);vm.runInContext(analyse.slice(candidateStart,candidateEnd),ac);
let candidate=vm.runInContext('unityCandidate(st)',Object.assign(ac,{st:stock}));
assert.equal(candidate.status,'wait');assert.match(candidate.action,/Kaufzone unterschritten/);
ac.unityCalc=()=>({q:{price:101},p:101,t:{n:260,last:101,ma50:100,ma200:90,rsi:55}});
candidate=vm.runInContext('unityCandidate(st)',ac);
assert.equal(candidate.status,'candidate');assert.equal(candidate.buy,'Kaufzone aktiv');
ac.unityCalc=()=>({q:{price:104},p:104,t:{n:260,last:104,ma50:100,ma200:90,rsi:55}});
candidate=vm.runInContext('unityCandidate(st)',ac);
assert.equal(candidate.action,'Kauf bei Rücksetzer');
console.log('Daily pullback: new SMA50 zone crossing, watching, broken, stale, experimental, FX, RSI, risk veto, watchlist and deep-analysis alignment passed.');
