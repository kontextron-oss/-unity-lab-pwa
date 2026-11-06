#!/usr/bin/env node
'use strict';
/*
 * Offline inspection for future PC / private worker exchange.
 * No personal data is stored, synchronized, modified, or turned into orders.
 */
const fs=require('node:fs');
const crypto=require('node:crypto');
const protocol=require('../exchange-protocol.js');
const digest=async str=>crypto.createHash('sha256').update(str,'utf8').digest('hex');
async function readPacket(file){
  if(!file||typeof file!=='string')throw Error('Dateipfad fehlt');
  const stat=fs.statSync(file);
  if(!stat.isFile()||stat.size>protocol.MAX_BYTES*1.8)
    throw Error('Austauschdatei ist ungültig oder zu groß');
  const packet=JSON.parse(fs.readFileSync(file,'utf8'));
  const verified=await protocol.verify(packet,digest);
  return {packet,verified};
}
async function inspect(first,second){
  const a=await readPacket(first);
  const result={valid:true,format:a.packet.format,schema:a.packet.schema,
    sourceDevice:a.verified.originId.slice(0,8)+'…',revision:a.verified.revision,
    exportedAt:a.verified.exportedAt,orders:a.verified.orders,trades:a.verified.trades,
    instruments:a.verified.instruments,
    limitEur:a.verified.limit,spentEur:a.verified.spend,
    mode:'READ-ONLY',executionEnabled:false,privateOrdersStored:false,
    statement:'Keine Daten geändert, keine Testorders aktiviert, keine pCloud-Verbindung.'};
  if(second){
    const b=await readPacket(second);
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
module.exports={readPacket,inspect,digest};
