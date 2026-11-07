'use strict';
/*
 * Password-based AES-256-GCM envelope for manually shared UNITY sync deltas.
 * No pCloud API, credentials, remote endpoints or browser storage.
 * Salt and IV freshly randomized; PBKDF2-SHA256; authenticated metadata.
 * This encryption is separate from the legacy read-only test-order exchange.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.UNITY_SYNC_CRYPTO=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 const FORMAT='unity-sync-delta-encrypted',SCHEMA=1;
 const ITER=310000,MAX_CIPHER=4*1024*1024;
 const text=()=>new TextEncoder(),decode=()=>new TextDecoder('utf-8',{fatal:true});
 const fail=x=>{throw Error('UNITY verschlüsselter Datenaustausch: '+x)};
 function validPassword(p){
  if(typeof p!=='string'||p.length<12||p.length>256||p.trim().length<12)
   fail('Eigenes Austauschpasswort mit mindestens 12 Zeichen erforderlich');
  return true;
 }
 function b64(b){
  if(typeof Buffer!=='undefined')return Buffer.from(b).toString('base64');
  let x='';for(const n of b)x+=String.fromCharCode(n);
  return btoa(x);
 }
 function from64(s,maxBytes){
  if(typeof s!=='string'||s.length>Math.ceil(maxBytes/3)*4+10||
   !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(s))
   fail('Ungültige Base64-Nutzdaten');
  let a;
  try{a=typeof Buffer!=='undefined'?new Uint8Array(Buffer.from(s,'base64')):
    Uint8Array.from(atob(s),c=>c.charCodeAt(0))}
  catch(_){fail('Ungültige Base64-Nutzdaten')}
  if(a.length>maxBytes||b64(a)!==s)fail('Veränderte oder zu große Datei');
  return a;
 }
 function header(d){
  if(!d||typeof d!=='object'||Array.isArray(d)||
   Object.keys(d).sort().join(',')!==
    ['format','schema','algorithm','kdf','iterations','salt','iv','purpose','ciphertext'].sort().join(','))
   fail('Unbekanntes oder unvollständiges Format');
  if(d.format!==FORMAT||d.schema!==SCHEMA||d.algorithm!=='AES-256-GCM'||
   d.kdf!=='PBKDF2-SHA256'||d.iterations!==ITER||d.purpose!=='manual-review-only')
   fail('Verschlüsselungsparameter unzulässig');
  const salt=from64(d.salt,16),iv=from64(d.iv,12);
  if(salt.length!==16||iv.length!==12||typeof d.ciphertext!=='string'||
    d.ciphertext.length>Math.ceil(MAX_CIPHER*4/3)+10)
   fail('Salt, IV oder verschlüsselte Daten ungültig');
  return {header:{format:d.format,schema:d.schema,algorithm:d.algorithm,
   kdf:d.kdf,iterations:d.iterations,salt:d.salt,iv:d.iv,purpose:d.purpose},
   salt,iv};
 }
 function aad(h){return text().encode(JSON.stringify(Object.fromEntries(
  Object.keys(h).sort().map(k=>[k,h[k]]))))}
 async function key(password,salt,cryptoApi){
  validPassword(password);
  if(!cryptoApi?.subtle?.importKey||!cryptoApi?.subtle?.deriveKey)
   fail('Sichere WebCrypto-Funktion benötigt HTTPS');
  const pass=await cryptoApi.subtle.importKey('raw',text().encode(password),
   'PBKDF2',false,['deriveKey']);
  return cryptoApi.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt,iterations:ITER},
   pass,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
 }
 async function encrypt(packet,password,cryptoApi,transfer,manifest,sha){
  validPassword(password);
  if(!cryptoApi?.subtle||typeof cryptoApi.getRandomValues!=='function')
   fail('WebCrypto-Sicherheit erforderlich');
  if(!transfer?.verify)fail('Gemeinsames Datenaustauschformat fehlt');
  await transfer.verify(packet,sha,manifest);
  const data=text().encode(JSON.stringify(packet));
  if(data.length>MAX_CIPHER-48)fail('Datei zu groß');
  const salt=new Uint8Array(16),iv=new Uint8Array(12);
  cryptoApi.getRandomValues(salt);cryptoApi.getRandomValues(iv);
  const h={format:FORMAT,schema:SCHEMA,algorithm:'AES-256-GCM',kdf:'PBKDF2-SHA256',
   iterations:ITER,salt:b64(salt),iv:b64(iv),purpose:'manual-review-only'};
  const aes=await key(password,salt,cryptoApi);
  const encrypted=await cryptoApi.subtle.encrypt({
   name:'AES-GCM',iv,additionalData:aad(h),tagLength:128},aes,data);
  const wrapped={...h,ciphertext:b64(new Uint8Array(encrypted))};
  header(wrapped);
  return wrapped;
 }
 async function decrypt(wrapped,password,cryptoApi,transfer,manifest,sha){
  validPassword(password);
  if(!transfer?.verify)fail('Gemeinsames Datenaustauschformat fehlt');
  const h=header(wrapped);
  const ciphertext=from64(wrapped.ciphertext,MAX_CIPHER);
  const aes=await key(password,h.salt,cryptoApi);
  let packet;
  try{
   const plaintext=await cryptoApi.subtle.decrypt({
    name:'AES-GCM',iv:h.iv,additionalData:aad(h.header),tagLength:128},
    aes,ciphertext);
   if(plaintext.byteLength>MAX_CIPHER-48)fail('Entschlüsselter Inhalt zu groß');
   packet=JSON.parse(decode().decode(plaintext));
  }catch(_){fail('Passwort falsch oder Datei manipuliert – keine Daten übernommen')}
  const verified=await transfer.verify(packet,sha,manifest);
  return {packet,verified};
 }
 return {FORMAT,SCHEMA,ITER,MAX_CIPHER,encrypt,decrypt,validPassword};
});
