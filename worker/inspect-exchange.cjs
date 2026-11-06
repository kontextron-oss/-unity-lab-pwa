#!/usr/bin/env node
'use strict';
/*
 * Read-only PC inspector for encrypted UNITY files. Decryption is local,
 * password must NEVER be given as a command-line argument, env var or log.
 * The script does not save imported records or enable any worker order.
 */
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const protocol=require('../exchange-protocol.js');
const protection=require('../exchange-crypto.js');
const digest=async str=>crypto.createHash('sha256').update(str,'utf8').digest('hex');
function promptPassword(filename){
  if(!process.stdin.isTTY||typeof process.stdin.setRawMode!=='function')
    throw Error('Für geschützte Dateien ist eine interaktive Konsole zur verdeckten Passworteingabe erforderlich.');
  process.stderr.write('UNITY-Austauschpasswort für '+filename+' (Eingabe unsichtbar): ');
  return new Promise((resolve,reject)=>{
    let input='',ended=false;
    const initiallyRaw=process.stdin.isRaw||false;
    const stop=(error)=>{
      if(ended)return;
      ended=true;
      process.stdin.off('data',onData);
      process.stdin.off('error',onError);
      process.stdin.setRawMode(initiallyRaw);
      process.stdin.pause();
      process.stderr.write('\n');
      if(error)reject(error);else resolve(input);
    };
    const onError=err=>stop(err);
    const onData=chunk=>{
      for(const c of String(chunk)){
        if(c==='\r'||c==='\n'){stop();return}
        if(c==='\u0003'){stop(Error('Passworteingabe abgebrochen'));return}
        if(c==='\b'||c==='\u007f'){input=input.slice(0,-1);continue}
        if(c>=' '&&input.length<256)input+=c;
      }
    };
    process.stdin.setEncoding('utf8');
    process.stdin.setRawMode(true);
    process.stdin.on('data',onData);
    process.stdin.on('error',onError);
    process.stdin.resume();
  });
}
async function readPacket(file,passphraseProvider=promptPassword){
  if(!file||typeof file!=='string')throw Error('Dateipfad fehlt');
  const stat=fs.statSync(file);
  if(!stat.isFile()||stat.size>protocol.MAX_BYTES*1.8)
    throw Error('Austauschdatei ist ungültig oder zu groß');
  const document=JSON.parse(fs.readFileSync(file,'utf8'));
  if(protection.isEncrypted(document)){
    const password=await passphraseProvider(path.basename(file));
    const result=await protection.decrypt(document,password,crypto.webcrypto,protocol,digest);
    return {...result,encrypted:true};
  }
  // Backwards-compatible inspection of pre-0.15.3.3 files; never allow execution.
  const verified=await protocol.verify(document,digest);
  return {packet:document,verified,encrypted:false};
}
async function inspect(first,second,passphraseProvider=promptPassword){
  const a=await readPacket(first,passphraseProvider);
  const result={valid:true,format:a.packet.format,schema:a.packet.schema,
    encryption:a.encrypted?'AES-256-GCM':'UNENCRYPTED LEGACY FILE – ONLY READ',
    sourceDevice:a.verified.originId.slice(0,8)+'…',revision:a.verified.revision,
    exportedAt:a.verified.exportedAt,orders:a.verified.orders,trades:a.verified.trades,
    instruments:a.verified.instruments,
    limitEur:a.verified.limit,spentEur:a.verified.spend,
    mode:'READ-ONLY',executionEnabled:false,privateOrdersStored:false,
    statement:'Keine Daten geändert, keine Testorders aktiviert, keine pCloud-Verbindung.'};
  if(second){
    const b=await readPacket(second,passphraseProvider);
    result.secondEncryption=b.encrypted?'AES-256-GCM':'UNENCRYPTED LEGACY FILE – ONLY READ';
    if(a.packet.originId===b.packet.originId){
      result.sameOrigin=true;
      result.revisionOrder=a.packet.revision<b.packet.revision?'zweite Version neuer':
        a.packet.revision>b.packet.revision?'erste Version neuer':'gleiche Revisionsnummer';
      if(a.packet.revision===b.packet.revision&&a.packet.sha256!==b.packet.sha256)
        result.revisionConflict=true;
    }else result.sameOrigin=false;
    result.differences=protocol.compare(a.packet.payload,b.packet.payload);
  }
  return result;
}
if(require.main===module){
  inspect(process.argv[2],process.argv[3])
    .then(value=>console.log(JSON.stringify(value,null,2)))
    .catch(err=>{console.error('UNITY: Austauschdatei abgelehnt: '+err.message);process.exitCode=1});
}
module.exports={readPacket,inspect,digest,promptPassword};
