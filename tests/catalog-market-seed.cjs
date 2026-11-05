'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const source=fs.readFileSync('scripts/refresh_market.py','utf8');
const html=fs.readFileSync('index.html','utf8');

assert.match(source,/def curated_catalog_stocks\(\):/);
assert.match(source,/STOCKS = build_stocks\(\)/);
assert.match(source,/Duplicate catalog ISIN/);
assert.match(source,/Catalog values are keyed by their verified ISIN/);

const block=html.slice(html.indexOf('const CATALOG=['),html.indexOf('];',html.indexOf('const CATALOG=['))+2);
const rows=[...block.matchAll(/\{name:'([^']+)',ticker:'([^']+)',isin:'([^']+)',exchange:'([^']+)',currency:'([^']+)',providerSymbol:'([^']+)'/g)];
const fme=rows.find(x=>x[1]==='Fresenius Medical Care');
assert.ok(fme,'Fresenius Medical Care must remain in the curated catalog');
assert.equal(fme[3],'DE0005785802');
assert.equal(fme[6],'FME.DE');
assert.equal(new Set(rows.map(x=>x[3])).size,rows.length,'curated snapshot keys are unique');
console.log('Curated catalog market seeding and Fresenius identity passed.');
