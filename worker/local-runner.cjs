#!/usr/bin/env node
'use strict';
/*
 * UNITY 0.15.3 LOCAL RUNNER FOUNDATION, SYNTHETIC ONLY.
 * A durable private PC-process prototype, NOT a connected iPhone portfolio.
 * No pCloud API calls. No GitHub writes. No real market orders.
 */
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const crypto=require('node:crypto');
const {tick,validate}=require('./core.cjs');
const {syntheticFeed,syntheticState}=require('./demo-fixture.cjs');
const FORMAT='unity-worker-local-v1';
const FILE='state.json',BACKUP='state.previous.json',LOCK='.writer.lock';
const root=path.resolve(__dirname,'..');
const hash=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
function privateDir(target=path.join(os.homedir(),'UNITY-LAB-PRIVATE-WORKER')){
  const folder=path.resolve(String(target));
  const rel=path.relative(root,folder);
  if(rel===''||(!rel.startsWith('..'+path.sep)&&rel!=='..'&&!path.isAbsolute(rel)))
    throw Error('Private state must stay OUTSIDE the public GitHub working tree');
  if(fs.existsSync(folder)){
    if(!fs.lstatSync(folder).isDirectory()||fs.lstatSync(folder).isSymbolicLink())
      throw Error('Private worker directory must be an ordinary directory');
  }else fs.mkdirSync(folder,{recursive:true,mode:0o700});
  try{fs.chmodSync(folder,0o700)}catch(err){if(process.platform!=='win32')throw err}
  return folder;
}
function isLive(pid){
  if(!Number.isInteger(pid)||pid<=0)return false;
  try{process.kill(pid,0);return true}catch(e){return e?.code==='EPERM'}
}
function lockAgeMs(file){try{return Date.now()-fs.statSync(file).mtimeMs}catch{return 0}}
function takeLock(folder){
  const target=path.join(folder,LOCK),token=crypto.randomUUID();
  for(let attempt=0;attempt<2;attempt++){
    let fd;
    try{fd=fs.openSync(target,'wx',0o600)}
    catch(e){
      if(e?.code!=='EEXIST')throw e;
      let record=null;
      try{record=JSON.parse(fs.readFileSync(target,'utf8'))}catch(_){}
      if(lockAgeMs(target)>15000&&!isLive(Number(record?.pid))){
        // Stale after a crash. Retry with an exclusive fresh lock. The
        // durable trade record itself prevents re-executing an old order.
        fs.unlinkSync(target);continue;
      }
      throw Error('Private worker writer already running. No concurrent write allowed.');
    }
    try{
      fs.writeFileSync(fd,JSON.stringify({pid:process.pid,token,createdAt:new Date().toISOString()}));
      fs.fsyncSync(fd);
    }finally{fs.closeSync(fd)}
    return ()=>{
      try{
        const found=JSON.parse(fs.readFileSync(target,'utf8'));
        if(found.token===token)fs.unlinkSync(target);
      }catch(e){if(e?.code!=='ENOENT')throw e}
    };
  }
  throw Error('Unable to recover private worker lock');
}
function withLock(folder,fn){
  const release=takeLock(folder);
  try{return fn()}finally{release()}
}
function parseFile(target){
  const payload=JSON.parse(fs.readFileSync(target,'utf8'));
  if(payload?.format!==FORMAT||!Number.isSafeInteger(payload.revision)||payload.revision<1||
     typeof payload.savedAt!=='string'||typeof payload.prevDigest!=='string'||
     typeof payload.digest!=='string'||!payload.state)
    throw Error('Invalid private worker state file');
  const material={format:payload.format,revision:payload.revision,savedAt:payload.savedAt,
    prevDigest:payload.prevDigest,state:payload.state};
  if(hash(material)!==payload.digest)throw Error('Private state checksum mismatch – stop, inspect backup');
  validate(payload.state);
  return payload;
}
function readState(folder){
  const filename=path.join(folder,FILE);
  if(!fs.existsSync(filename)){
    if(fs.existsSync(path.join(folder,BACKUP)))
      throw Error('Primary state missing but previous checkpoint exists. Manual recovery required.');
    return null;
  }
  return parseFile(filename);
}
function fsyncDir(dir){
  if(process.platform==='win32')return;
  let fd;
  try{fd=fs.openSync(dir,'r');fs.fsyncSync(fd)}catch(e){
    if(!['EINVAL','ENOTSUP','EISDIR'].includes(e?.code))throw e
  }finally{if(fd!==undefined)fs.closeSync(fd)}
}
function writeAtomic(file,obj){
  const tmp=file+'.tmp-'+process.pid+'-'+crypto.randomUUID();
  let fd;
  try{
    fd=fs.openSync(tmp,'wx',0o600);
    fs.writeFileSync(fd,JSON.stringify(obj,null,2)+'\n');
    fs.fsyncSync(fd);fs.closeSync(fd);fd=undefined;
    fs.renameSync(tmp,file);
    fsyncDir(path.dirname(file));
  }finally{
    if(fd!==undefined)fs.closeSync(fd);
    try{fs.unlinkSync(tmp)}catch(e){if(e?.code!=='ENOENT')throw e}
  }
}
function saveState(folder,state,prior){
  validate(state);
  const savedAt=new Date().toISOString(),revision=(prior?.revision||0)+1,
    payload={format:FORMAT,revision,savedAt,prevDigest:prior?.digest||'',state};
  payload.digest=hash(payload);
  const main=path.join(folder,FILE),backup=path.join(folder,BACKUP);
  if(prior){
    // Keep a checked copy of the previous checkpoint; never automatically
    // overwrite the primary with it or erase a conflicting new revision.
    const original=parseFile(main);
    if(original.digest!==prior.digest)throw Error('Concurrent change detected');
    writeAtomic(backup,original);
  }
  writeAtomic(main,payload);
  return payload;
}
function init(dir,activatedAt){
  const folder=privateDir(dir);
  return withLock(folder,()=>{
    if(readState(folder))throw Error('Worker state already exists; refusing to overwrite');
    const state=syntheticState(activatedAt||new Date().toISOString());
    state.enabled=false;
    state.run.status='paused';
    return saveState(folder,state,null);
  });
}
function changeEnabled(dir,value){
  const folder=privateDir(dir);
  return withLock(folder,()=>{
    const prior=readState(folder);
    if(!prior)throw Error('No worker state: run init first');
    if(prior.state.enabled===value)return prior;
    const next=structuredClone(prior.state);
    next.enabled=!!value;
    next.run.status=value?'ready':'paused';
    next.events.push({kind:value?'resume':'pause',at:new Date().toISOString(),
      detail:'Local synthetic demo toggle only'});
    return saveState(folder,next,prior);
  });
}
function runTick(dir,day){
  const folder=privateDir(dir);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(day||''))||
     !Number.isFinite(Date.parse(day+'T20:00:00Z')))
    throw Error('Date must be YYYY-MM-DD');
  const now=Date.parse(day+'T20:00:00Z');
  return withLock(folder,()=>{
    const prior=readState(folder);
    if(!prior)throw Error('No local worker: run init');
    const feed=syntheticFeed(day,new Date(now).toISOString());
    const result=tick(prior.state,feed,
      {schemaVersion:1,rates:{EUR:1},referenceDate:day},now);
    const written=saveState(folder,result.state,prior);
    return {revision:written.revision,status:written.state.run.status,events:result.events,
      trades:written.state.trades.length,lastSuccess:written.state.run.lastSuccess,
      enabled:written.state.enabled};
  });
}
function currentStatus(dir){
  const prior=readState(privateDir(dir));
  if(!prior)return {initialized:false,mode:'synthetic-demo'};
  const {state}=prior;
  return {initialized:true,mode:state.mode,enabled:state.enabled,revision:prior.revision,
    savedAt:prior.savedAt,checksum:prior.digest.slice(0,16),
    activeOrders:state.orders.filter(x=>x.active).length,
    demoTrades:state.trades.length,run:state.run,
    noRealPortfolio:true,pCloudConnected:false};
}
function argumentsOf(argv){
  const [command,...rest]=argv;
  const read=(name,defaultValue)=>{
    const i=rest.indexOf('--'+name);
    if(i<0)return defaultValue;
    if(!rest[i+1]||rest[i+1].startsWith('--'))throw Error('Missing value for --'+name);
    return rest[i+1];
  };
  return {command,dir:read('dir',undefined),date:read('date',new Date().toISOString().slice(0,10)),
    interval:Number(read('interval-seconds','3600'))};
}
async function main(argv=process.argv.slice(2)){
  const args=argumentsOf(argv),print=x=>process.stdout.write(JSON.stringify(x,null,2)+'\n');
  switch(args.command){
    case 'init':return print({mode:'synthetic-demo',
      revision:init(args.dir,args.date+'T10:00:00Z').revision,
      message:'Synthetic demo initialized PAUSED (activation date '+args.date+'). Run resume explicitly.'});
    case 'resume':return print({enabled:changeEnabled(args.dir,true).state.enabled});
    case 'pause':return print({enabled:changeEnabled(args.dir,false).state.enabled});
    case 'status':return print(currentStatus(args.dir));
    case 'tick':return print(runTick(args.dir,args.date));
    case 'serve':{
      if(!Number.isInteger(args.interval)||args.interval<60||args.interval>86400)
        throw Error('Interval must be between 60 and 86400 seconds');
      process.stdout.write('UNITY SYNTHETIC PC DEMO loop; Ctrl+C stops it. No iPhone/pCloud credentials.\n');
      while(true){
        const day=new Date().toISOString().slice(0,10);
        try{print(runTick(args.dir,day))}catch(e){
          process.stderr.write('Worker tick blocked: '+e.message+'\n');
        }
        await new Promise(resolve=>setTimeout(resolve,args.interval*1000));
      }
    }
    default:throw Error('Usage: node worker/local-runner.cjs init|resume|pause|status|tick|serve [--dir ABSOLUTE_PATH] [--date YYYY-MM-DD] [--interval-seconds N]. SYNTHETIC ONLY');
  }
}
if(require.main===module)main().catch(e=>{console.error('UNITY worker refused:',e.message);process.exitCode=1});
module.exports={FORMAT,privateDir,withLock,readState,saveState,init,changeEnabled,runTick,currentStatus,main};
