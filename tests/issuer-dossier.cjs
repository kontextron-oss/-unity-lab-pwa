'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const stock={name:'Schneider Electric',ticker:'SU',isin:'FR0000121972',currency:'EUR'};
const evidence=[
 {key:'fundamentals',verified:true,date:'2025-12-31',detail:'Vollständiger geprüfter Jahresbericht 2025-12-31',sourceUrl:'https://filings.xbrl.org/report.json'},
 {key:'earnings',verified:false,date:'',detail:'Kein bestätigter nächster Ergebnisbericht',sourceUrl:''},
 {key:'guidance',verified:false,date:'',detail:'Keine einzeln zugeordnete, aktuelle Primärquelle geprüft',sourceUrl:''},
 {key:'thesis',verified:false,date:'',detail:'Keine belegte These mit überprüfbarer Widerlegungsbedingung hinterlegt',sourceUrl:''},
 {key:'risk',verified:false,date:'',detail:'Keine einzeln geprüften Risikofaktoren als Entscheidungsbeleg hinterlegt',sourceUrl:''}
];
const sandbox={
 esc:v=>String(v??''),unityIsCryptoAsset:s=>/krypto|crypto/i.test(String(s?.exchange||'')),
 unityMarketForStock:()=>({price:240,date:'2026-11-05',source:'Xetra · Tages-Schlusskurs'}),
 unityFundPilotItem:()=>({latestFiling:{reportUrl:'https://filings.xbrl.org/report.json'}}),
 unityIssuerEvidenceMatrix:()=>evidence,
 unityFundValuation:()=>({available:true,period:'2025-12-31',pe:20,pb:4,fcfYield:0.03})
};
vm.createContext(sandbox);vm.runInContext(fs.readFileSync('issuer-dossier.js','utf8'),sandbox);
const html=vm.runInContext('unityIssuerDossierPanel('+JSON.stringify(stock)+')',sandbox);
for(const label of ['Datenakte','Kurs & Börsenplatz','Jahresabschluss','Bewertung','Ergebnisbericht','Guidance','These & Widerlegung','Risiko & Ereignisse'])assert.match(html,new RegExp(label));
assert.match(html,/3\/7 Bereiche belegt/);
assert.match(html,/Original öffnen/);
assert.match(html,/○ offen/);
assert.equal(vm.runInContext("unityIssuerDossierPanel({ticker:'SOL',exchange:'Krypto USD'})",sandbox),'');
console.log('Issuer dossier: sourced evidence, gaps and crypto exclusion passed.');
