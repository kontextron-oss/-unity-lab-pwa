'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');
const start=html.indexOf('async function unityBackupFile(){');
const end=html.indexOf('async function importBackup(){',start);
assert.ok(start>0&&end>start);
const src=html.slice(start,end);
const stores=['instruments','quotes','transactions','strategies','audit','fundamentals','histories','analyses','settings'];
const fake={instruments:[{id:'s1',name:'ABB',isin:'CH0012221716'}],
 quotes:[{id:'q1',price:75}],transactions:[{id:'t1',type:'BUY',quantity:2}],
 strategies:[],audit:[{id:'a1',type:'TEST'}],fundamentals:[],
 histories:[{id:'h1',points:[{date:'2026-11-02',close:75}]}],
 analyses:[{id:'x1',deepDecision:{kind:'technical',realOrderApproved:false}}],
 settings:[{id:'portfolio-capital',amount:5000}]};
let downloaded=0,urlRevoked=0,shareCalled=0,selected=null,canShare=true,shareMode='ok',status='';
const box={Date,Math,Number,String,Array,JSON,File,Blob,STORES:stores,
 all:async n=>fake[n],
 URL:{createObjectURL:()=>('blob:test/'+(++downloaded)),revokeObjectURL:()=>urlRevoked++},
 document:{getElementById:id=>id==='unity-backup-status'?{set textContent(x){status=x}}:null,
   createElement:tag=>({href:'',download:'',click(){}})},
 setTimeout:()=>0,console,
 navigator:{share:async data=>{shareCalled++;selected=data;if(shareMode==='abort'){const e=new Error('cancel');e.name='AbortError';throw e}if(shareMode==='reject')throw new Error('unavailable')},canShare:()=>canShare}
};
vm.createContext(box);vm.runInContext(src,box);
const run=x=>vm.runInContext(x,box);
(async()=>{
 const file=await run('unityBackupFile()');
 assert.ok(file.name.startsWith('UNITY-LAB-VOLLSICHERUNG_2026-'));
 assert.ok(file.name.endsWith('.json'));
 assert.equal(file.type,'application/json');
 const obj=JSON.parse(await file.text());
 assert.equal(obj.format,'unity-lab-backup');
 assert.equal(obj.schema,3);
 assert.deepEqual(Object.keys(obj.data).sort(),stores.slice().sort());
 assert.equal(obj.data.transactions[0].type,'BUY');
 assert.equal(obj.data.analyses[0].deepDecision.kind,'technical');
 assert.equal(obj.data.histories[0].points.length,1);
 assert.equal(obj.data.settings[0].amount,5000);
 assert.ok(obj.exportedAt.endsWith('Z'));
 await run('unityBackupShare()');
 assert.equal(shareCalled,1);
 assert.equal(downloaded,0);
 assert.match(selected.files[0].name,/^UNITY-LAB-VOLLSICHERUNG_.*\.json$/);
 assert.match(status,/Bitte in pCloud prüfen/);
 assert.doesNotMatch(status,/erfolgreich gesichert/);
 shareMode='abort';await run('unityBackupShare()');
 assert.equal(shareCalled,2);assert.equal(downloaded,0);
 assert.match(status,/Teilen abgebrochen/);
 shareMode='reject';await run('unityBackupShare()');
 assert.equal(shareCalled,3);assert.equal(downloaded,1);
 assert.match(status,/Download bereitgestellt/);
 canShare=false;await run('unityBackupShare()');
 assert.equal(shareCalled,3);assert.equal(downloaded,2);
 await run('exportBackup()');
 assert.equal(downloaded,3);
 assert.match(status,/keine bestätigte pCloud-Sicherung/);
 assert.match(html,/id="backup-pcloud"/);
 assert.match(html,/id="import-file"/);
 assert.match(html,/if\(b.id==='backup-pcloud'\)await unityBackupShare/);
 assert.match(html,/if\(file.size>50e6\)/);
 assert.doesNotMatch(html,/localStorage\.setItem\(['"]pcloud|access_token|client_secret/);
 assert.match(fs.readFileSync('sw.js','utf8'),/unity-lab-v0\.(13|14)\.\d+/);
 console.log('Private backup: all IndexedDB stores, timestamp, share handoff, user cancellation, fallback and import guard passed.');
})().catch(e=>{console.error(e);process.exitCode=1});
