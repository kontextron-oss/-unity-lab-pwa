'use strict';
const assert=require('node:assert/strict');
const {tick,sampleState,verifyQuote,fillId}=require('../worker/core.cjs');
const {syntheticFeed,syntheticState,INSTRUMENT}=require('../worker/demo-fixture.cjs');
const {runDemo}=require('../worker/run-demo.cjs');
const day='2026-11-05',next='2026-11-06',now1=Date.parse(day+'T20:00:00Z'),
  now2=Date.parse(next+'T20:00:00Z'),fx={schemaVersion:1,rates:{EUR:1},referenceDate:day};
const feed1=syntheticFeed(day,new Date(now1).toISOString()),
  feed2=syntheticFeed(next,new Date(now2).toISOString());
const s=syntheticState('2026-11-03T10:00:00Z');
const q=verifyQuote(INSTRUMENT,feed1,fx,now1);
assert.equal(q.ok,true,'Synthetic EOD/source history is internally coherent');
assert.equal(q.isin,INSTRUMENT.isin);
assert.match(q.source,/SYNTHETIC/);
assert.equal(verifyQuote({...INSTRUMENT,assetClass:'crypto'},feed1,fx,now1).ok,false,
  'Cryptocurrencies must not reuse stock purchase logic');
assert.equal(verifyQuote(INSTRUMENT,{...feed1,generatedAt:'2025-01-01T10:00:00Z'},fx,now1).ok,false,
  'Stale snapshots rejected');
assert.equal(verifyQuote({...INSTRUMENT,currency:'USD'},feed1,fx,now1).ok,false,
  'Mismatched instrument/currency rejected');
assert.equal(verifyQuote(INSTRUMENT,{...feed1,items:{...feed1.items,
  [INSTRUMENT.isin]:{...feed1.items[INSTRUMENT.isin],points:[]}}},fx,now1).ok,false,
  'Insufficient price history veto');
const first=tick(s,feed1,fx,now1);
assert.deepEqual(first.events.map(e=>e.kind),['trigger']);
assert.equal(first.state.trades.length,0,'Signal day must not fill retroactively');
assert.equal(s.orders[0].triggerQuoteDate,undefined,'Pure function does not mutate source');
assert.equal(tick(first.state,feed1,fx,now1).state.trades.length,0,'No same-day fills');
const second=tick(first.state,feed2,fx,now2);
assert.deepEqual(second.events.map(e=>e.kind),['filled']);
assert.equal(second.state.trades.length,1);
assert.equal(second.state.trades[0].tag,'SYNTHETIC TEST ONLY');
assert.equal(second.state.trades[0].feeEur,1);
assert.equal(second.state.trades[0].totalEur,100);
assert.ok(second.state.trades[0].modelPrice>feed2.items[INSTRUMENT.isin].price);
assert.equal(second.state.orders[0].active,false);
assert.equal(tick(second.state,feed2,fx,now2).state.trades.length,1,'Repeat tick is idempotent');
assert.equal(fillId(first.state.orders[0]),fillId(first.state.orders[0]));
const paused=sampleState();paused.instruments=[INSTRUMENT];
const hold=tick(paused,feed1,fx,now1);
assert.equal(hold.state.run.status,'paused');
assert.equal(hold.state.trades.length,0,'Stop control prevents simulation');
const budget=syntheticState('2026-11-03T10:00:00Z');budget.budgetEur=50;
const stage=tick(budget,feed1,fx,now1).state;
const blocked=tick(stage,feed2,fx,now2);
assert.equal(blocked.state.trades.length,0);
assert.deepEqual(blocked.events.map(e=>e.kind),['budget-block']);
const late=syntheticState('2026-11-03T10:00:00Z');late.orders[0].sandboxApproved=false;
assert.equal(tick(late,feed1,fx,now1).state.trades.length,0,
  'No implicit opt-in from existing watchlist');
const report=runDemo(new Date('2026-11-06T13:00:00Z'));
assert.equal(report.personalPortfolioConnected,false);
assert.equal(report.pCloudConnected,false);
assert.deepEqual(report.steps.signalEvents,['trigger']);
assert.deepEqual(report.steps.fillEvents,['filled']);
assert.equal(report.simulatedTradeCount,1);
assert.equal(report.simulatedTradeCountAfterRetry,1);
assert.match(report.conclusion,/NO PERSONAL ORDERS/);
console.log('UNITY WORKER: synthetic background-runner foundation, isolated equity policy, pause, budget, stale-data veto, staged fill and retry tested.');
