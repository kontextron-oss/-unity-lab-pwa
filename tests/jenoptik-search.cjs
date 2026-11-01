'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');
const slice=(a,b)=>{const i=html.indexOf(a),j=html.indexOf(b,i);assert.ok(i>0&&j>i,a);return html.slice(i,j)};
const ctx={String,Array,Intl,Set,cache:{instruments:[]},document:{getElementById:()=>({innerHTML:''})},esc:s=>String(s),normalizeSearch:undefined};
vm.createContext(ctx);
vm.runInContext(slice('const CATALOG=[','function catalogPresent('),ctx);
vm.runInContext(slice('function verifiedCatalogSearch(term){','async function searchOnline(){'),ctx);
const list=vm.runInContext("CATALOG.filter(s=>s.isin==='DE000A2NB601')",ctx);
assert.equal(list.length,1);
assert.equal(list[0].ticker,'JEN');assert.equal(list[0].exchange,'Xetra');assert.equal(list[0].currency,'EUR');
for(const query of ['Jenoptik','Jenoptik ag','JEN','DE000A2NB601']){
 const found=vm.runInContext('verifiedCatalogSearch('+JSON.stringify(query)+')',ctx);
 assert.ok(found.some(({s})=>s.isin==='DE000A2NB601'),query);
}
assert.match(html,/if\(known.length\)\{showVerifiedCatalogMatches\(known\);return\}/);
assert.match(html,/data-catalog=/);
assert.match(fs.readFileSync('scripts/refresh_market.py','utf8'),/\("DE000A2NB601", "JEN\.DE", "EUR", "Jenoptik AG"\)/);
console.log('Jenoptik: search by name, lowercase AG, ticker, ISIN and EOD feed mapping passed.');
