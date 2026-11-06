#!/usr/bin/env node
'use strict';
/* Scheduled PUBLIC demonstration. Executes NO personal trades, PWA data,
   pCloud sync, third-party APIs or broker instructions. */
const fs=require('node:fs'),path=require('node:path');
const {tick,verifyQuote}=require('./core.cjs');
const {syntheticFeed,syntheticState,INSTRUMENT}=require('./demo-fixture.cjs');
const dateOffset=(day,offset)=>new Date(Date.parse(day+'T00:00:00Z')+offset*86400000)
  .toISOString().slice(0,10);
function runDemo(now=new Date()){
  const date=now.toISOString().slice(0,10);
  const signalDate=dateOffset(date,-1),startDate=dateOffset(date,-3);
  const state=syntheticState(startDate+'T10:00:00Z');
  const asOfSignal=Date.parse(signalDate+'T20:00:00Z'),asOfFill=Date.parse(date+'T20:00:00Z');
  const first=tick(state,syntheticFeed(signalDate,new Date(asOfSignal).toISOString()),
    {schemaVersion:1,rates:{EUR:1},referenceDate:signalDate},asOfSignal);
  const second=tick(first.state,syntheticFeed(date,new Date(asOfFill).toISOString()),
    {schemaVersion:1,rates:{EUR:1},referenceDate:date},asOfFill);
  const third=tick(second.state,syntheticFeed(date,new Date(asOfFill).toISOString()),
    {schemaVersion:1,rates:{EUR:1},referenceDate:date},asOfFill);
  const result={
    runAt:now.toISOString(),mode:'SYNTHETIC-DEMONSTRATION-ONLY',
    personalPortfolioConnected:false,pCloudConnected:false,brokerConnected:false,
    independentRuntime:'GitHub Actions demo – stateless per run',
    syntheticInstrument:INSTRUMENT.ticker,
    steps:{signalEvents:first.events.map(x=>x.kind),fillEvents:second.events.map(x=>x.kind),
      repeatedRunEvents:third.events.map(x=>x.kind)},
    simulatedTradeCount:second.state.trades.length,
    simulatedTradeCountAfterRetry:third.state.trades.length,
    sampleTrade:second.state.trades[0]?{
      quoteDate:second.state.trades[0].quoteDate,
      syntheticPrice:second.state.trades[0].modelPrice,
      sizeEur:second.state.trades[0].totalEur,
      feeEur:second.state.trades[0].feeEur}:null,
    conclusion:'NO PERSONAL ORDERS: synthetic liveness check, not 0.15.3 user automation'
  };
  if(!verifyQuote(INSTRUMENT,syntheticFeed(date,new Date(asOfFill).toISOString()),
      {schemaVersion:1,rates:{EUR:1},referenceDate:date},asOfFill).ok||
     result.simulatedTradeCount!==1||result.simulatedTradeCountAfterRetry!==1)
    throw Error('Synthetic runner liveness invariant failed');
  return result;
}
if(require.main===module){
  const result=runDemo();
  const json=JSON.stringify(result,null,2);
  if(process.argv.includes('--write-status')){
    const out=path.join(__dirname,'demo-status.json');
    fs.writeFileSync(out,json+'\n',{flag:'w',mode:0o600});
    console.log('Synthetic status created: worker/demo-status.json (NO PERSONAL DATA)');
  }
  console.log(json);
}
module.exports={runDemo};
