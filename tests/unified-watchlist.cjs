'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');
const first=html.indexOf('function watchlistCards(){'),second=html.indexOf('function stocksView(){',first);
assert.ok(first>0&&second>first);
const block=html.slice(first,second);
assert.doesNotMatch(html.slice(second,second+180),/unityHomeManagePanel/);
assert.match(html.slice(second,second+200),/watchlistCards\(\)/);
const items=[
 {id:'a',name:'ABB',ticker:'ABBN',isin:'CH0012221716',exchange:'SIX',currency:'CHF'},
 {id:'b',name:'Hubbell',ticker:'HUBB',isin:'US4435106079',exchange:'NYSE',currency:'USD'},
 {id:'c',name:'Quanta',ticker:'PWR',isin:'US74762E1029',exchange:'NYSE',currency:'USD',watchHidden:true}
];
const ctx={stocks:()=>items,unityHomeStocks:()=>items.filter(x=>!x.watchHidden),
 unityDisplayQuote:()=>null,unityMarketItem:()=>null,quote:()=>null,
 number:(x,d)=>Number(x).toFixed(d),esc:x=>String(x??'')};
vm.createContext(ctx);vm.runInContext(block,ctx);
const result=vm.runInContext('watchlistCards()',ctx);
assert.equal((result.match(/data-analyze=/g)||[]).length,3);
assert.equal((result.match(/data-home-toggle=/g)||[]).length,3);
assert.equal((result.match(/data-home-shift=/g)||[]).length,6);
assert.match(result,/ABB/);assert.match(result,/Hubbell/);
assert.match(result,/Auf Startseite ausgeblendet/);assert.match(result,/Anzeigen/);
assert.doesNotMatch(result,/home-manage-row|stock-tile/);
assert.equal((result.match(/class="unity-unified-row/g)||[]).length,3);
assert.match(result,/Kurs &amp; Analyse ansehen/);
console.log('Single unified stock list: open analysis, reorder, hide/show and hidden recovery passed.');
