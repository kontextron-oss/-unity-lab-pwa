'use strict';
/* Publicly shareable synthetic quotes. Never represent them as market data. */
const {sampleState}=require('./core.cjs');
const INSTRUMENT=Object.freeze({id:'synthetic-equity-01',ticker:'SYN',isin:'TEST00000001',
  currency:'EUR',exchange:'TEST',assetClass:'equity',name:'Synthetische Testaktie'});
function daysBefore(date,count){
  const day=Date.parse(date+'T00:00:00Z'),out=[];
  for(let i=count-1;i>=0;i--)out.push(new Date(day-i*86400000).toISOString().slice(0,10));
  return out;
}
function syntheticFeed(date,generatedAt){
  const days=daysBefore(date,210),points=days.map((d,i)=>({
    date:d,close:i<150?100+(i%2?0.1:-0.1):105+(i%2?0.1:-0.1)}));
  const price=points.at(-1).close;
  return {schemaVersion:1,generatedAt,kind:'FAKE DATA FOR CI ONLY',items:{
    [INSTRUMENT.isin]:{isin:INSTRUMENT.isin,currency:'EUR',exchange:'TEST',
      date,price,points,source:'SYNTHETIC UNIT-TEST FIXTURE'}
  }};
}
function syntheticState(activatedAt='2026-11-03T10:00:00Z'){
  const s=sampleState();
  s.enabled=true;s.budgetEur=150;s.openingCashEur=1000;s.instruments=[{...INSTRUMENT}];
  s.orders=[{id:'sandbox-buy-1',instrumentId:INSTRUMENT.id,side:'BUY',
    mode:'technical-demo',sandboxApproved:true,active:true,state:'waiting',
    amountEur:100,activatedAt}];
  return s;
}
module.exports={syntheticFeed,syntheticState,INSTRUMENT};
