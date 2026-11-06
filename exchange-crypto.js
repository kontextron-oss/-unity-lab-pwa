'use strict';
/*
 * UNITY 0.15.3.3 – password-protected manual exchange, Safari + Node.
 * AES-256-GCM authenticates all ciphertext and metadata (AAD), PBKDF2-SHA256.
 * No keys, passwords, or personal data are stored or sent to an API.
 * This is NOT a background-worker authentication or pCloud sync channel.
 */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.UNITY_EXCHANGE_CRYPTO=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const FORMAT='unity-exchange-encrypted',SCHEMA=1,ALGORITHM='AES-256-GCM',
    KDF='PBKDF2-SHA256',ITERATIONS=310000,MIN_ITERATIONS=250000,MAX_ITERATIONS=750000,
    MIN_PASSWORD_LENGTH=12,MAX_PASSWORD_LENGTH=256,
    MAX_PLAINTEXT_BYTES=5*1024*1024,MAX_CIPHERTEXT_BYTES=MAX_PLAINTEXT_BYTES+100000;
  const keys='algorithm,ciphertext,format,iterations,iv,kdf,purpose,salt,schema';
  const enc=()=>new TextEncoder(),dec=()=>new TextDecoder('utf-8',{fatal:true});
  const canonical=obj=>JSON.stringify(Object.fromEntries(Object.keys(obj).sort().map(k=>[k,obj[k]])));
  function assert(condition,message){if(!condition)throw Error('UNITY Verschlüsselung: '+message)}
  function validPassword(password){
    assert(typeof password==='string'&&password.length>=MIN_PASSWORD_LENGTH&&
      password.length<=MAX_PASSWORD_LENGTH&&password.trim().length>=MIN_PASSWORD_LENGTH,
      'Passwort muss mindestens 12 Zeichen enthalten');
  }
  function encode64(input){
    const u8=new Uint8Array(input);
    if(typeof Buffer!=='undefined')return Buffer.from(u8).toString('base64');
    let binary='';
    for(let i=0;i<u8.length;i+=16384){
      for(const b of u8.subarray(i,i+16384))binary+=String.fromCharCode(b);
    }
    return btoa(binary);
  }
  function decode64(s,sizeLimit){
    assert(typeof s==='string'&&s.length>0&&s.length<=Math.ceil(sizeLimit*4/3)+10&&
      /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(s),
      'Base64-Daten ungültig');
    const bytes=typeof Buffer!=='undefined'?new Uint8Array(Buffer.from(s,'base64')):
      Uint8Array.from(atob(s),c=>c.charCodeAt(0));
    assert(bytes.length<=sizeLimit&&encode64(bytes)===s,'Base64-Inhalt ungültig');
    return bytes;
  }
  function header(packet){
    assert(packet&&typeof packet==='object'&&!Array.isArray(packet)&&
      Object.keys(packet).sort().join(',')===keys,'Unerwartete verschlüsselte Felder');
    assert(packet.format===FORMAT&&packet.schema===SCHEMA&&
      packet.algorithm===ALGORITHM&&packet.kdf===KDF&&packet.purpose==='review-only'&&
      Number.isInteger(packet.iterations)&&packet.iterations>=MIN_ITERATIONS&&
      packet.iterations<=MAX_ITERATIONS,'Verschlüsselungsformat oder Kostenparameter ungültig');
    const salt=decode64(packet.salt,16),iv=decode64(packet.iv,12);
    assert(salt.length===16&&iv.length===12,'Salt oder Initialisierungsvektor ungültig');
    assert(typeof packet.ciphertext==='string'&&packet.ciphertext.length>0&&
      packet.ciphertext.length<=Math.ceil(MAX_CIPHERTEXT_BYTES*4/3)+10,
      'Verschlüsselte Daten zu groß');
    return {format:packet.format,schema:packet.schema,algorithm:packet.algorithm,
      kdf:packet.kdf,iterations:packet.iterations,salt:packet.salt,iv:packet.iv,
      purpose:packet.purpose};
  }
  async function derive(passphrase,salt,iterations,subtle){
    validPassword(passphrase);
    assert(subtle&&typeof subtle.importKey==='function'&&typeof subtle.deriveKey==='function',
      'Sichere WebCrypto-Schnittstelle nicht verfügbar');
    const base=await subtle.importKey('raw',enc().encode(passphrase),'PBKDF2',false,['deriveKey']);
    return subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt,iterations},
      base,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  }
  async function encrypt(packet,passphrase,cryptoApi,protocol,sha256){
    assert(cryptoApi?.subtle&&typeof cryptoApi.getRandomValues==='function',
      'Sichere Zufallsquelle fehlt');
    assert(protocol&&typeof protocol.verify==='function',
      'Gemeinsames UNITY-Austauschformat fehlt');
    // Protect against accidental encryption of an executable/invalid order.
    await protocol.verify(packet,sha256);
    validPassword(passphrase);
    const plaintext=enc().encode(JSON.stringify(packet));
    assert(plaintext.length<=MAX_PLAINTEXT_BYTES,'Austauschpaket zu groß');
    const salt=new Uint8Array(16),iv=new Uint8Array(12);
    cryptoApi.getRandomValues(salt);cryptoApi.getRandomValues(iv);
    const signedHeader={format:FORMAT,schema:SCHEMA,algorithm:ALGORITHM,kdf:KDF,
      iterations:ITERATIONS,salt:encode64(salt),iv:encode64(iv),purpose:'review-only'};
    const key=await derive(passphrase,salt,ITERATIONS,cryptoApi.subtle);
    const ciphertext=await cryptoApi.subtle.encrypt({name:'AES-GCM',iv,
      additionalData:enc().encode(canonical(signedHeader)),tagLength:128},key,plaintext);
    return {...signedHeader,ciphertext:encode64(ciphertext)};
  }
  async function decrypt(wrapped,passphrase,cryptoApi,protocol,sha256){
    const signedHeader=header(wrapped);
    assert(cryptoApi?.subtle&&typeof cryptoApi.subtle.decrypt==='function',
      'Sichere WebCrypto-Schnittstelle nicht verfügbar');
    assert(protocol&&typeof protocol.verify==='function',
      'Gemeinsames UNITY-Austauschformat fehlt');
    validPassword(passphrase);
    const ciphertext=decode64(wrapped.ciphertext,MAX_CIPHERTEXT_BYTES);
    const salt=decode64(wrapped.salt,16),iv=decode64(wrapped.iv,12);
    const key=await derive(passphrase,salt,wrapped.iterations,cryptoApi.subtle);
    let packet;
    try{
      const bytes=await cryptoApi.subtle.decrypt({name:'AES-GCM',iv,
        additionalData:enc().encode(canonical(signedHeader)),tagLength:128},key,ciphertext);
      assert(bytes.byteLength<=MAX_PLAINTEXT_BYTES,'Paket zu groß');
      packet=JSON.parse(dec().decode(bytes));
    }catch(_){
      throw Error('UNITY Verschlüsselung: Falsches Passwort oder Datei verändert – keine Daten übernommen');
    }
    const verified=await protocol.verify(packet,sha256);
    return {packet,verified};
  }
  function isEncrypted(value){return value?.format===FORMAT}
  return {FORMAT,SCHEMA,ITERATIONS,MIN_PASSWORD_LENGTH,MAX_CIPHERTEXT_BYTES,
    isEncrypted,validPassword,encrypt,decrypt};
});
