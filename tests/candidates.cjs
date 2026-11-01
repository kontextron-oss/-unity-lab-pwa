'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const stock={id:'s1',isin:'FR0000121972',currency:'EUR',exchange:'Paris'};
const points=Array.from({length:220},(_,i)=>({date:'2026-01-'+String((i%28)+1).padStart(2,'0'),close:100+i*.02+(i%2?.04:-.04)}));
const market={price:points.at(-1).close,date:new Date().toISOString().slice(0,10),exchange:'Paris',points};
const sandbox={Date,Math,Number,Array,JSON,Intl,cache:{fundamentals:[],histories:[],strategies:[]},keys:['valuation','quality','rr','flows','timing','alternatives'],defaults:{valuation:30,quality:20,rr:20,flows:15,timing:10,alternatives:5},unityMarketItem:()=>market,unityDataQuality:()=>({canCompare:true}),quote:()=>null,document:{addEventListener(){}},number:(v,d=2)=>Number(v).toFixed(d),esc:v=>String(v??''),stocks:()=>[stock],stamp:v=>String(v),id:()=>String(Math.random()),put:async()=>{},audit:async()=>{},refresh:async()=>{}};
vm.createContext(sandbox);vm.runInContext(fs.readFileSync('analysis.js','utf8'),sandbox);const c=vm.runInContext('unityCandidate('+JSON.stringify(stock)+')',sandbox);assert.equal(c.status,'candidate');assert.match(c.action,/Kauf/);assert.match(c.condition,/SMA50/);assert.ok(c.score>=60);
const outcome=vm.runInContext('unityDecisionOutcome({createdAt:new Date(Date.now()-86400000*3).toISOString(),reference:{price:100}},'+JSON.stringify(stock)+')',sandbox);assert.match(outcome.label,/% seit Snapshot/);console.log('UNITY candidate engine: trend, pullback zone and data separation passed.');
