'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');
const from=html.indexOf('function stockRecords(){'),to=html.indexOf('function quotesFor(sid)',from);
assert.ok(from>0&&to>from);
const code=html.slice(from,to);
const s1={id:'a',name:'ABB',ticker:'ABBN',isin:'CH0012221716',exchange:'SIX Swiss Exchange',currency:'CHF'};
const s2={id:'b',name:'Schneider Electric',ticker:'SU',isin:'FR0000121972',exchange:'Euronext Paris',currency:'EUR'};
const s3={id:'c',name:'Eaton',ticker:'ETN',isin:'IE00B8KQN827',exchange:'NYSE',currency:'USD'};
const cache={instruments:[s1,s2,s3],transactions:[
 {id:'buy',instrumentId:'b',type:'BUY',quantity:2,amount:200,price:100,fx:1,executedAt:'2026-11-01T10:00:00Z'},
 {id:'closed1',instrumentId:'c',type:'BUY',quantity:1,amount:70,price:70,fx:1,executedAt:'2026-10-20T10:00:00Z'},
 {id:'closed2',instrumentId:'c',type:'SELL',quantity:1,amount:90,price:90,fx:1,executedAt:'2026-11-01T10:00:00Z'}
],quotes:[{id:'q1',instrumentId:'a',price:12}],analyses:[{id:'ana',instrumentId:'a'}],settings:[]};
let confirmations=true,promptCount=0,refreshed=0,audited=[],saved=[];
const box={Date,Math,Number,JSON,cache,esc:v=>String(v??''),
 selectedUnityStock:'a',unityHomeSelected:'a',
 confirm:()=>{promptCount++;return confirmations},
 audit:async(...a)=>audited.push(a),refresh:async()=>refreshed++,
 put:async(k,v)=>{saved.push({k,v});const p=cache[k].findIndex(x=>x.id===v.id);if(p<0)cache[k].push(v);else cache[k][p]=v}
};
vm.createContext(box);vm.runInContext(code,box);
const fn=(expression)=>vm.runInContext(expression,box);
(async()=>{
 assert.equal(fn('stocks().length'),3);
 assert.equal(fn('archivedStocks().length'),0);
 assert.equal(await fn("unityRemoveStock('a')"),true);
 assert.equal(fn('stocks().length'),2);
 assert.equal(fn('archivedStocks().length'),1);
 assert.ok(cache.instruments.find(x=>x.id==='a').watchArchivedAt);
 assert.equal(cache.quotes.length,1);
 assert.equal(cache.analyses.length,1);
 assert.equal(box.selectedUnityStock,'');
 assert.equal(box.unityHomeSelected,'');
 assert.match(fn('unityArchivedPanel()'),/Archivierte Aktien wiederherstellen/);
 assert.match(fn('unityArchivedPanel()'),/data-watch-restore="a"/);
 await assert.rejects(fn("unityRemoveStock('b')"),/noch im Testdepot/);
 assert.equal(fn('stocks().length'),2);
 assert.equal(cache.transactions.length,3);
 assert.ok(!cache.instruments.find(x=>x.id==='b').watchArchivedAt);
 // A completely sold position may be archived while its transactions remain.
 assert.equal(await fn("unityRemoveStock('c')"),true);
 assert.equal(fn('stocks().length'),1);
 assert.equal(cache.transactions.length,3);
 assert.equal(fn('archivedStocks().length'),2);
 // Cancellation does not change a saved stock record.
 confirmations=false;
 assert.equal(await fn("unityRemoveStock('b')").catch(()=>false),false);
 // Restore is immediate without duplicates or extra confirmation.
 assert.equal(await fn("unityRestoreStock('a')"),true);
 assert.equal(fn('stocks().length'),2);
 assert.equal(fn('archivedStocks().length'),1);
 assert.equal(cache.instruments.length,3);
 assert.ok(!cache.instruments.find(x=>x.id==='a').watchArchivedAt);
 assert.equal(cache.instruments.find(x=>x.id==='a').watchHidden,false);
 assert.equal(await fn("unityRestoreStock('a')"),false);
 assert.equal(await fn("unityRemoveStock('missing')"),false);
 assert.equal(cache.quotes.length,1);
 assert.equal(cache.analyses.length,1);
 assert.ok(audited.some(x=>x[0]==='STOCK_ARCHIVED'));
 assert.ok(audited.some(x=>x[0]==='STOCK_RESTORED'));
 assert.ok(refreshed>=3);
 // Main page and stock management must both expose one-touch removal.
 const home=fs.readFileSync('home.js','utf8');
 assert.match(home,/data-watch-remove/);
 assert.match(home,/cache\.instruments\|\|\[\]/); // archived pilot item is not re-added
 assert.match(html,/data-watch-remove/);
 assert.match(html,/data-watch-restore/);
 assert.match(html,/watchlistCards\(\)\+unityArchivedPanel\(\)/);
 assert.match(html,/if\(b\.dataset\.watchRemove\)await unityRemoveStock/);
 assert.match(html,/function catalogRecord\(s\)/);
 assert.match(html,/if\(known\?\.watchArchivedAt\)return unityRestoreStock/);
 const depot=fs.readFileSync('depot.js','utf8');
 assert.equal(depot.split("const realized=(cache.instruments||[]).reduce").length-1,2);
 assert.match(html,/0\.13\.\d+/);
 assert.match(fs.readFileSync('sw.js','utf8'),/unity-lab-v0\.(13|14|15)\.\d+/);
 console.log('Watchlist remove/restore: soft archive, open position lock, closed trades preserved, restore ID, main buttons and no startup re-add passed.');
})().catch(err=>{console.error(err);process.exitCode=1});
