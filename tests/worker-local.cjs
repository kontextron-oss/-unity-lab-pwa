'use strict';
/* Multi-process synthetic PC runner: persistence, crash/restart, pause,
 * lock, tamper, backup. No personal data or pCloud token is ever used. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const runtime=require('../worker/local-runner.cjs');
const sandbox=fs.mkdtempSync(path.join(os.tmpdir(),'unity-private-worker-test-'));
const worker=path.join(__dirname,'..','worker','local-runner.cjs');
function command(...args){
  const result=spawnSync(process.execPath,[worker,...args,'--dir',sandbox],{
    encoding:'utf8',timeout:10000});
  if(result.status!==0)throw Error('worker failed: '+result.stderr);
  return JSON.parse(result.stdout);
}
try{
 assert.throws(()=>runtime.privateDir(path.join(__dirname,'..','worker','test-local-state')),
   /OUTSIDE the public/,'Never store private state inside a public repo');
 assert.equal(runtime.currentStatus(sandbox).initialized,false);
 const created=runtime.init(sandbox,'2026-11-03T10:00:00Z');
 assert.equal(created.revision,1);
 assert.equal(created.state.enabled,false,'Default is explicit opt-out');
 assert.throws(()=>runtime.init(sandbox),/already exists/,'Never reinitialize and overwrite a ledger');
 assert.equal(command('status').initialized,true);
 const runWhilePaused=command('tick','--date','2026-11-05');
 assert.equal(runWhilePaused.trades,0);
 assert.equal(command('resume').enabled,true);
 let first=command('tick','--date','2026-11-05');
 assert.equal(first.trades,0);
 assert.deepEqual(first.events.map(x=>x.kind),['trigger']);
 assert.equal(command('status').activeOrders,1);
 assert.equal(runtime.readState(sandbox).state.orders[0].triggerQuoteDate,'2026-11-05');
 first=command('tick','--date','2026-11-05');
 assert.equal(first.trades,0,'Signal day cannot become a fill when retried');
 let second=command('tick','--date','2026-11-06');
 assert.equal(second.trades,1,'A later actual supplied sample EOD fills once');
 assert.deepEqual(second.events.map(x=>x.kind),['filled']);
 const filled=runtime.readState(sandbox);
 assert.equal(filled.state.trades[0].tag,'SYNTHETIC TEST ONLY');
 assert.equal(filled.state.trades[0].totalEur,100);
 assert.equal(command('tick','--date','2026-11-06').trades,1,
   'Separate process restart does not duplicate the paper trade');
 assert.equal(command('status').demoTrades,1);
 assert.equal(fs.existsSync(path.join(sandbox,'state.previous.json')),true,
   'Previous checkpoint retained as independent backup');
 const state=runtime.readState(sandbox);
 assert.equal(runtime.readState(sandbox).digest,state.digest);
 assert.ok(state.revision>=5);
 const status=command('status');
 assert.equal(status.pCloudConnected,false);
 assert.equal(status.noRealPortfolio,true);
 assert.equal(command('pause').enabled,false);
 assert.equal(command('status').enabled,false);
 const locked=path.join(sandbox,'.writer.lock');
 fs.writeFileSync(locked,JSON.stringify({pid:process.pid,token:'other',createdAt:new Date().toISOString()}));
 assert.throws(()=>runtime.runTick(sandbox,'2026-11-07'),/already running/,
   'Live lock blocks concurrent writers');
 fs.unlinkSync(locked);
 fs.writeFileSync(locked,JSON.stringify({pid:2147483647,token:'dead'}));
 const age=new Date(Date.now()-31000);
 fs.utimesSync(locked,age,age);
 assert.equal(runtime.runTick(sandbox,'2026-11-07').status,'paused',
   'Expired crashed writer lock can be recovered without duplication');
 const original=fs.readFileSync(path.join(sandbox,'state.json'),'utf8');
 const corrupted=original.replace('synthetic-demo','SYNTHETIC-TAMPER');
 assert.notEqual(corrupted,original);
 fs.writeFileSync(path.join(sandbox,'state.json'),corrupted);
 assert.throws(()=>runtime.readState(sandbox),/checksum mismatch|Invalid private/,
   'Tampering must block rather than silently restoring stale backup');
 assert.throws(()=>runtime.runTick(sandbox,'2026-11-08'),/checksum mismatch|Invalid private/,
   'Corrupt primary never causes a new action');
 assert.equal(fs.existsSync(path.join(sandbox,'state.previous.json')),true);
 console.log('Local UNITY synthetic PC runner: cross-process persistence, pause, idempotency, atomic backup, lock recovery, checksum fail-closed passed.');
}finally{fs.rmSync(sandbox,{force:true,recursive:true})}
