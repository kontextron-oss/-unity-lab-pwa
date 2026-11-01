'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');
assert.match(html,/depotCsvPanel\(\)/);
assert.match(html,/depotcsv\.js/);
const stocks=[
{id:'abb',name:'ABB',isin:'CH0012221716',ticker:'ABBN',currency:'CHF'},
{id:'schneider',name:'Schneider Electric',isin:'FR0000121972',ticker:'SU',currency:'EUR'}
];
const cache={transactions:[],instruments:stocks};
const sandbox={stocks:()=>stocks,cache,document:{addEventListener(){},getElementById(){return null}},render(){},alert(){},Date,Number,Math,Array,JSON,Set,Map,
 id:()=>Math.random().toString(),esc:s=>String(s??''),confirm:()=>true};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('depotcsv.js','utf8'),sandbox);
function parse(s){return vm.runInContext('depotCsvPrepare(depotCsvParse('+JSON.stringify(s)+'))',sandbox)}
const input='Datum;ISIN;Typ;Stückzahl;Kurs;Währung;FX;Gebühren\n'+
'30.10.2026;FR0000121972;Kauf;10;237,50;EUR;;4,50\n'+
'30.10.2026;CH0012221716;Kauf;2;70,68;CHF;1,08;0\n'+
'31.10.2026;FR0000121972;Verkauf;4;250,00;EUR;;2,00\n';
let p=parse(input);
assert.equal(p.length,3);
assert.ok(p.every(x=>x.errors.length===0));
assert.equal(p[0].transaction.amount,2379.5);
assert.equal(p[1].transaction.fx,1.08);
assert.equal(p[2].transaction.amount,998);
assert.equal(p[2].transaction.type,'SELL');
assert.equal(p[0].transaction.executedAt.slice(0,10),'2026-10-30');
assert.match(vm.runInContext('depotCsvPanel()',sandbox),/CSV/);
const existing=p[0].transaction;cache.transactions.push(existing);
p=parse(input);
assert.equal(p.filter(x=>x.duplicate).length,1);
assert.equal(p.filter(x=>x.transaction&&!x.duplicate).length,2);
const missingFx=parse('Date,ISIN,Type,Quantity,Price,Currency\n2026-10-30,CH0012221716,Buy,2,70.68,CHF\n');
assert.match(missingFx[0].errors.join(' '),/Wechselkurs/);
const unknown=parse('Datum;ISIN;Typ;Stückzahl;Kurs;Währung\n30.10.2026;DE0001234567;Kauf;2;10;EUR\n');
assert.match(unknown[0].errors.join(' '),/nicht eindeutig/);
const oversell=parse('Datum;ISIN;Typ;Stückzahl;Kurs;Währung\n30.10.2026;FR0000121972;Verkauf;30;250;EUR\n');
assert.match(oversell[0].errors.join(' '),/chronologischen Bestand/);
const quoted=vm.runInContext("depotCsvParse('Datum;ISIN;Typ;Stückzahl;Kurs;Währung;Notiz\\n30.10.2026;FR0000121972;Kauf;1;10;EUR;\"Text; mit Trennzeichen\"')",sandbox);
assert.equal(quoted[0].fields.note,'Text; mit Trennzeichen');
console.log('CSV import: locale numbers, buys/sells, fees, FX, duplicate detection, unknown stocks, oversells and quoting passed.');
