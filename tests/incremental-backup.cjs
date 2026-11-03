'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {webcrypto}=require('node:crypto');
const code=fs.readFileSync('incremental.js','utf8');
const stores=['instruments','quotes','transactions','strategies','audit','fundamentals','histories','analyses','settings'];
const data={
 instruments:[{id:'abb',name:'ABB',ticker:'ABBN',isin:'CH0012221716'}],
 quotes:[{id:'quote-1',instrumentId:'abb',price:61.2}],
 transactions:[{id:'buy-1',instrumentId:'abb',type:'BUY',quantity:4}],
 strategies:[{id:'strategy-1',weights:{quality:30}}],
 audit:[{id:'audit-1',action:'CREATED'}],
 fundamentals:[],
 histories:[{id:'history-1',points:Array.from({length:260},(_,i)=>({date:'2026-01-'+i,close:60+i/100}))}],
 analyses:[{id:'analysis-1',rating:'observe',score:62}],
 settings:[{id:'portfolio-capital',amount:9000}]
};
let shared=[],downloads=[],messages=[],confirmResult=true,refreshes=0,alerted=[];
let visible={hidden:true};
const box={
 Date,Math,Number,String,Array,JSON,File,TextEncoder,Uint8Array,crypto:webcrypto,STORES:stores,
 cache:data,esc:x=>String(x),console,
 all:async n=>structuredClone(data[n]),
 put:async(n,obj)=>{const i=data[n].findIndex(x=>x.id===obj.id);if(i<0)data[n].push(obj);else data[n][i]=obj},
 refresh:async()=>{refreshes++},
 bulkInsert:async sets=>{for(const [n,items] of Object.entries(sets)){for(const x of items)data[n].push(x)}},
 confirm:s=>{messages.push(s);return confirmResult},alert:s=>alerted.push(s),
 unityBackupStatus:s=>{messages.push(s)},
 unityDownloadBackup:f=>downloads.push(f),
 navigator:{canShare:()=>true,share:async opts=>{shared.push(opts.files[0]);}},
 document:{getElementById:id=>id==='inc-confirm'?visible:null}
};
vm.createContext(box);vm.runInContext(code,box);
const call=x=>vm.runInContext(x,box);
const cloneFile=async(file,transform)=>{
 const obj=JSON.parse(await file.text());transform(obj);
 return new File([JSON.stringify(obj)],file.name,{type:'application/json'});
};
(async()=>{
 let base=await call('unityIncPrepare()');
 assert.equal(base.base,true);
 assert.match(base.file.name,/BASIS.json$/);
 assert.equal(base.count,8); // 8 nonempty original entries including capital.
 assert.equal(base.snapshot.parentId,null);
 assert.equal(base.snapshot.changes.histories.length,1);
 assert.equal(base.snapshot.changes.settings[0].record.amount,9000);
 await call('unityIncShare()');
 assert.equal(shared.length,0);
 await call('unityIncSharePrepared()');
 assert.equal(shared.length,1);
 assert.equal(visible.hidden,false);
 assert.equal(data.settings.some(x=>x.id==='unity-lab-incremental-checkpoint-v1'),false);
 assert.equal(await call('unityIncPrepare()').then(x=>x.base),true); // no confirmed checkpoint yet
 confirmResult=false;await call('unityIncConfirmSaved()');
 assert.equal(data.settings.some(x=>x.id==='unity-lab-incremental-checkpoint-v1'),false);
 confirmResult=true;await call('unityIncConfirmSaved()');
 assert.equal(data.settings.some(x=>x.id==='unity-lab-incremental-checkpoint-v1'),true);
 assert.equal(await call('unityIncPrepare()'),null);
 const savedBase=shared[0];
 // Only the modified quote + new analysis should be exported.
 data.quotes[0].price=58.4;
 data.analyses.push({id:'analysis-2',rating:'waiting',score:62});
 let delta=await call('unityIncPrepare()');
 assert.equal(delta.base,false);
 assert.equal(delta.count,2);
 assert.equal(delta.snapshot.changes.quotes.length,1);
 assert.equal(delta.snapshot.changes.analyses.length,1);
 assert.equal(delta.snapshot.changes.histories.length,0);
 assert.equal(delta.snapshot.parentId,JSON.parse(await savedBase.text()).backupId);
 assert.equal(delta.snapshot.parentHash,JSON.parse(await savedBase.text()).snapshotHash);
 assert.ok(delta.file.size<savedBase.size*.8,'incremental file should be materially smaller');
 await call('unityIncShare()');
 assert.equal(shared.length,1);
 await call('unityIncSharePrepared()');
 assert.equal(shared.length,2);
 await call('unityIncConfirmSaved()');
 assert.equal(await call('unityIncPrepare()'),null);
 const forcedBase=await call('unityIncPrepare(true)');
 assert.equal(forcedBase.base,true);
 assert.equal(forcedBase.snapshot.parentId,null);
 assert.ok(forcedBase.count>delta.count);
 assert.equal(await call('unityIncPrepare()'),null); // ordinary incremental cursor remains
 const savedDelta=shared[1];
 box.savedBase=savedBase;box.savedDelta=savedDelta;
 const rebuilt=await call('unityIncAssemble([savedDelta,savedBase])');
 assert.equal(rebuilt.parts,2);
 assert.equal(rebuilt.records.quotes.get('quote-1').record.price,58.4);
 assert.equal(rebuilt.records.histories.get('history-1').record.points.length,260);
 assert.equal(rebuilt.records.analyses.size,2);
 // Missing base or tampered content must fail; never fake completeness.
 await assert.rejects(call('unityIncAssemble([savedDelta])'),/Basissicherung/);
 const changed=await cloneFile(savedDelta,d=>{d.changes.quotes[0].record.price=99});
 box.changed=changed;
 await assert.rejects(call('unityIncAssemble([savedBase,changed])'),/SHA-256-Prüfsummenfehler/);
 // An unaltered existing dataset should not write again.
 box.document.getElementById=id=>id==='inc-confirm'?visible:id==='inc-import-file'?{files:[savedBase,savedDelta]}:null;
 await call('unityIncRestore()');
 assert.match(alerted.at(-1),/bereits vorhanden/);
 // A conflicting local value must be caught, and original data kept.
 data.quotes[0].price=70;
 await assert.rejects(call('unityIncRestore()'),/nicht durchgeführt/);
 assert.equal(data.quotes[0].price,70);
 // Restore into an otherwise empty local DB by supplementing missing data.
 for(const n of stores)data[n]=[];
 await call('unityIncRestore()');
 assert.equal(data.quotes[0].price,58.4);
 assert.equal(data.analyses.length,2);
 assert.equal(data.histories.length,1);
 assert.equal(data.settings.find(x=>x.id==='portfolio-capital').amount,9000);
 assert.equal(data.settings.some(x=>x.id==='unity-lab-incremental-checkpoint-v1'),false);
 assert.equal(alerted.at(-1).includes('Wiederherstellung erfolgreich'),true);
 assert.ok(refreshes>=3);
 const html=fs.readFileSync('index.html','utf8');
 assert.match(html,/id="inc-pcloud"/);
 assert.match(html,/id="inc-share"/);
 assert.match(html,/id="inc-new-base"/);
 assert.match(html,/if\(b\.id==='inc-share'\)await unityIncSharePrepared/);
 assert.match(html,/id="inc-confirm"/);
 assert.match(html,/id="inc-import-file"/);
 assert.match(html,/if\(b\.id==='inc-import'\)await unityIncRestore/);
 assert.match(html,/incremental\.js\?v=0\.13\.49/);
 const sw=fs.readFileSync('sw.js','utf8');
 assert.match(sw,/incremental\.js\?v=0\.13\.49/);
 assert.match(sw,/unity-lab-v0\.13\.49/);
 console.log('UNITY incremental backup: first base, only changed records, explicit cloud confirmation, chain-integrity restore and conflict veto passed.');
})().catch(e=>{console.error(e);process.exitCode=1});
