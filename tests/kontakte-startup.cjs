'use strict';
const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const html=fs.readFileSync('kontakte/index.html','utf8');
const sw=fs.readFileSync('kontakte/sw.js','utf8');
assert.match(sw,/kontakte-pwa-v09/,'Expected Kontakte 0.9 offline cache');
assert.match(sw,/klaus-kontakte/,'Expected separate Klaus profile cache');
assert.match(sw,/jan-kontakte/,'Expected separate Jan profile cache');
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
assert.equal(scripts.length,1,'Expected one inline app script');
new vm.Script(scripts[0],{filename:'kontakte/index.html:inline'});
assert.match(html,/Kontakte werden geöffnet/,'Accessible initial loading message required');
const root={innerHTML:'',events:{},addEventListener(type,fn){this.events[type]=fn;},querySelector(){return null;}};
const local=new Map();
const localStorage={getItem:k=>local.has(k)?local.get(k):null,setItem:(k,v)=>local.set(k,v),removeItem:k=>local.delete(k)};
localStorage.setItem('kontakte-lokal-fallback-v1',JSON.stringify([
 {id:'legacy-1',name:'Frühere Nummer',phone:'0351 12345',street:'Altweg',house:'5',zip:'01067',city:'Dresden'}
]));
const document={getElementById:id=>id==='app'?root:null,querySelector:()=>({setAttribute(){}})};
const window={};
const navigator={};
const location={href:'',pathname:'/kontakte/'};
let confirmed=0;
class FakeFormData{
 constructor(form){this.fields=form.fields;}
 get(k){return this.fields[k]||'';}
 getAll(k){return this.fields[k]||[];}
}
const testScript=scripts[0].replace(/\}\)\(\);\s*$/, 'window.__contactsTest={valid,phoneList,toVcard,parseVcard,spoken,importPlan};})();');
assert.notEqual(testScript,scripts[0],'Test helper injection must work');
new Function('window','document','navigator','localStorage','crypto','FormData','confirm','location',testScript)(
 window,document,navigator,localStorage,{randomUUID:()=> 'test-id'},FakeFormData,()=>{confirmed++;return true;},location
);
(async()=>{
 await new Promise(resolve=>setImmediate(resolve));
 assert.match(root.innerHTML,/>Kontakte öffnen<\/button>/);
 assert.match(root.innerHTML,/>Neuer Kontakt<\/button>/);
 assert.equal((root.innerHTML.match(/data-a="/g)||[]).length,2,'Home has exactly two clear actions');
 const click=async(a,id,index)=>root.events.click({target:{closest:()=>({dataset:{a,id,index}})}});
 await click('contacts');
 assert.match(root.innerHTML,/Kontakt suchen/);
 assert.match(root.innerHTML,/Anna Müller \(Beispiel\)/);
 assert.match(root.innerHTML,/<h2>Kontakte<\/h2>/);
 assert.match(root.innerHTML,/Musterstraße 12/);
 assert.match(root.innerHTML,/01234 Dresden/);
 assert.match(root.innerHTML,/iPhone-Tastatur/);
 await click('select','__beispiel__');
 assert.match(root.innerHTML,/Musterstraße 12/);
 assert.match(root.innerHTML,/Postleitzahl|01234/);
 await click('new');
 assert.match(root.innerHTML,/Kontakt(e)? bearbeiten|Neuer Kontakt/);
 assert.match(root.innerHTML,/id="name"/);
 assert.match(root.innerHTML,/phone-fields/,'phone-entry section shown');
 assert.match(root.innerHTML,/Weitere Telefonnummer/);
 assert.match(root.innerHTML,/E-Mail-Adresse/);
 assert.match(root.innerHTML,/Webseite/);
 assert.match(root.innerHTML,/id="website" name="website" type="text" inputmode="text"/,'Website field keeps the iPhone dictation keyboard');
 assert.match(root.innerHTML,/Kommentare \/ Notizen/);
 assert.match(root.innerHTML,/vCard exportieren/);
 assert.match(root.innerHTML,/In pCloud sichern · Teilen/);
 assert.match(root.innerHTML,/Sicherung in Dateien speichern/);
 assert.match(root.innerHTML,/Kontakte importieren/);
 assert.doesNotMatch(html,/data-a="sms"|data-a="message"/);
 const {valid,phoneList,toVcard,parseVcard,importPlan}=window.__contactsTest;
 const legacy=valid({id:'a',name:'Altbestand',phone:'012 3456'});
 assert.equal(legacy.phone,'012 3456');
 assert.deepEqual(phoneList(legacy),[{label:'Mobil',number:'012 3456'}],
  'Migration preserves a legacy single number');
 const sample=valid({
  id:'new-id',name:'Max Muster',phones:[{label:'Mobil',number:'+491701234'},
   {label:'Arbeit',number:'0351 678'}],
  street:'Ringstraße',house:'12',zip:'01234',city:'Dresden',
  email:'max@example.org',website:'example.org',notes:'Bitte abends anrufen.'
 });
 const parsed=parseVcard(toVcard([sample]))[0];
 assert.equal(parsed.name,sample.name,'vCard name');
 assert.deepEqual(parsed.phones,sample.phones,'vCard multi-number roundtrip');
 assert.equal(parsed.email,sample.email,'vCard email');
 assert.equal(parsed.website,sample.website,'vCard website');
 assert.equal(parsed.notes,sample.notes,'vCard notes');
 assert.equal(parsed.house,sample.house,'vCard house');
 assert.equal(parsed.zip,sample.zip,'vCard ZIP');
 const plan=importPlan([
  sample,
  {...sample,id:'duplicate-id'},
  {id:'missing-name',phone:'0123'}
 ]);
 assert.equal(plan.add.length,1,'Import preview keeps one new contact');
 assert.equal(plan.duplicates,1,'Import preview identifies duplicate contacts');
 assert.equal(plan.invalid,1,'Import preview identifies incomplete contacts');
 await click('contacts');
 assert.match(root.innerHTML,/Frühere Nummer/,'Existing legacy contact remains available');
 await click('select','legacy-1');
 assert.match(root.innerHTML,/0351 12345/,'Legacy number in detail');
 assert.match(root.innerHTML,/Anrufen/,'Call button on selected number');
 await click('call',undefined,0);
 assert.equal(location.href,'tel:035112345','Native telephone handoff');
 assert.equal(confirmed,1,'User must confirm call');
 await click('new');
 await root.events.submit({target:{id:'form',fields:{
  name:'Mehrfach-Test',phoneType:['Mobil','Arbeit'],phoneNumber:['0176 555','0351 999'],
  street:'Testweg',house:'8',zip:'01067',city:'Dresden',
  email:'test@example.org',website:'example.org',notes:'Am Wochenende'
 }},preventDefault(){}});
 assert.match(localStorage.getItem('kontakte-lokal-fallback-v1'),/Mehrfach-Test/,
  'Saved contact persisted in local storage');
 await click('contacts');
 assert.match(root.innerHTML,/Mehrfach-Test/);
 assert.match(root.innerHTML,/Mobil: 0176 555/);
 assert.match(root.innerHTML,/Arbeit: 0351 999/);
 await click('select','k-test-id');
 assert.match(root.innerHTML,/Kontakt löschen/,'Individual delete is available directly on the contact card');
 await click('delete');
 await click('contacts');
 assert.doesNotMatch(root.innerHTML,/Mehrfach-Test/,'Directly deleted contact no longer appears');
 await click('new');
 assert.match(root.innerHTML,/Alle eigenen Kontakte löschen/,'Bulk-delete action is available in contact management');
 await click('delete-all');
 assert.equal(localStorage.getItem('kontakte-lokal-fallback-v1'),'[]','Bulk delete clears only the current profile storage');
 await click('contacts');
 assert.doesNotMatch(root.innerHTML,/Mehrfach-Test/,'Bulk-deleted contact no longer appears');
 assert.match(html,/Klaus – Kontakte/,'Klaus profile title included');
 assert.match(html,/Jan – Kontakte/,'Jan profile title included');
 console.log('Kontakte: startup, legacy migration, multi-number save, phone-call handoff and vCard roundtrip passed.');
})().catch(err=>{console.error(err);process.exitCode=1;});
