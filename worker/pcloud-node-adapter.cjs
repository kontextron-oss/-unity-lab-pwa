'use strict';
/*
 * UNITY PC/Electron pCloud adapter v1 – Node-only, no browser/PWA import.
 * Inspired by existing WERK-ARCHIV desktop pCloud API implementation.
 *
 * Never reads local credential files and never persists a token; the
 * caller must supply an already authorized secure Electron session.
 *
 * Read-only namespace discovery; no folder creation, deletion or rename.
 * Every write uses renameifexists=1 and nopartial=1 and is acknowledged
 * only after filename/size checks. sync-pcloud-log.js performs separate
 * cloud readback + SHA-256 before accepting a checkpoint.
 *
 * No real pCloud calls unless a token and fetcher are explicitly supplied.
 */
const {NAMESPACE}=require('../sync-pcloud-log.js');
const API_HOSTS=new Set(['api.pcloud.com','eapi.pcloud.com']);
const SEGMENTS=['UNITY-LAB','03-AUSTAUSCH','immutable-v1'];
const MAX_BYTES=4*1024*1024;
function reject(message){throw Error('UNITY pCloud-PC-Adapter: '+message)}
function ensure(c,message){if(!c)reject(message)}
function safeId(value){
 if(typeof value==='number')ensure(Number.isSafeInteger(value)&&value>0,'Datei-/Ordner-ID nicht sicher darstellbar');
 else ensure(typeof value==='string'&&/^[1-9][0-9]{0,19}$/.test(value),
  'Datei-/Ordner-ID unzulässig');
 return String(value);
}
function tokenSession(session){
 ensure(session&&typeof session==='object'&&API_HOSTS.has(session.hostname),
  'pCloud-Region nicht freigegeben');
 ensure(typeof session.token==='string'&&session.token.length>=12&&
   session.token.length<=4096&&/^[A-Za-z0-9._~+/-]+$/.test(session.token),
  'Keine authentifizierte pCloud-Sitzung übergeben');
 return {host:session.hostname,token:session.token};
}
function throwApiError(json){
 ensure(json&&typeof json==='object'&&!Array.isArray(json)&&
  Number.isSafeInteger(Number(json.result)),
  'Ungültige pCloud-Antwort');
 ensure(Number(json.result)===0,'pCloud hat die Anfrage nicht bestätigt (Fehlercode '+json.result+')');
}
function allowedContentHost(host){
 return typeof host==='string'&&
  /^[a-z0-9-]+\.pcloud\.com$/i.test(host)&&host.length<=253;
}
function exactUploadName(name){
 return typeof name==='string'&&
 /^UNITY-SYNC-V1_[0-9a-f-]{36}_[1-9][0-9]{0,11}_[a-f0-9]{64}\.json$/.test(name);
}
function createPCloudNodeAdapter({session,fetcher=fetch}={}){
 ensure(typeof process==='object'&&process?.release?.name==='node',
  'Nur im lokalen Node-/Electron-Prozess verwenden');
 ensure(typeof fetcher==='function','Netzwerkadapter fehlt');
 const auth=tokenSession(session);
 const endpoint='https://'+auth.host+'/';
 const authorizedFiles=new Map();
 let folderId=null;
 async function readJson(response){
  ensure(response&&response.ok===true,'pCloud-HTTP-Anfrage fehlgeschlagen');
  const json=await response.json();
  throwApiError(json);
  return json;
 }
 async function api(method,fields){
  ensure(['listfolder','getfilelink'].includes(method),'API-Methode nicht zugelassen');
  const body=new URLSearchParams();
  for(const [key,value] of Object.entries(fields))body.set(key,String(value));
  return readJson(await fetcher(endpoint+method,{method:'POST',
   headers:{Authorization:'Bearer '+auth.token},body,cache:'no-store',
   redirect:'error'}));
 }
 async function listFolder(id){
  const data=await api('listfolder',{folderid:id});
  const m=data.metadata;
  ensure(m&&m.isfolder===true&&Array.isArray(m.contents)&&
    (id===0||safeId(m.folderid)===String(id)),
   'pCloud hat den erwarteten Ordner nicht bestätigt');
  return m;
 }
 async function identifyFolder(){
  let id=0;
  for(const name of SEGMENTS){
   const parent=await listFolder(id);
   const matches=parent.contents.filter(x=>x&&x.isfolder===true&&x.name===name);
   ensure(matches.length===1,'Privater UNITY-Ordner '+name+' fehlt oder ist mehrdeutig');
   id=safeId(matches[0].folderid);
  }
  const target=await listFolder(id);
  ensure(target.name===SEGMENTS.at(-1),'Unbekannter pCloud-Zielordner');
  folderId=id;
  return target;
 }
 async function list(){
  const m=await identifyFolder();
  const result=[];
  authorizedFiles.clear();
  for(const x of m.contents){
   if(x?.isfolder)continue;
   ensure(x&&typeof x.name==='string'&&typeof x.size==='number'&&
     Number.isSafeInteger(x.size)&&x.size>=0&&x.size<=MAX_BYTES,
    'Ungültiger Dateieintrag im UNITY-Synchronisationsordner');
   const id=safeId(x.fileid);
   authorizedFiles.set(id,{name:x.name,size:x.size});
   result.push({fileid:id,name:x.name,size:x.size});
  }
  return {namespace:NAMESPACE,verifiedFolder:true,files:result};
 }
 async function read(fileid){
  const id=safeId(fileid),allowed=authorizedFiles.get(id);
  ensure(!!allowed,'Datei-ID stammt nicht aus dem geprüften privaten UNITY-Ordner');
  const data=await api('getfilelink',{fileid:id,forcedownload:1});
  const host=Array.isArray(data.hosts)?data.hosts.find(allowedContentHost):null;
  ensure(!!host&&typeof data.path==='string'&&data.path.startsWith('/')&&
   !data.path.startsWith('//')&&!data.path.includes('\\')&&
   !/[\r\n]/.test(data.path)&&data.path.length<=4096,
   'Unzulässige pCloud-Downloadadresse');
  const response=await fetcher('https://'+host+data.path,{
   method:'GET',cache:'no-store',redirect:'error'});
  ensure(response?.ok===true,'pCloud-Datei konnte nicht geladen werden');
  const buffer=new Uint8Array(await response.arrayBuffer());
  ensure(buffer.length===allowed.size&&buffer.length<=MAX_BYTES,
   'Cloud-Inhalt hat unerwartete Dateilänge');
  // Fatal UTF-8: no implicit substitution characters may alter a SHA-256.
  return new TextDecoder('utf-8',{fatal:true}).decode(buffer);
 }
 async function uploadNoOverwrite({filename,content,mediaType,
  folderNamespace,nopartial,renameifexists}={}){
  ensure(folderId!==null,'Privater pCloud-Ordner muss zuerst vollständig geprüft werden');
  ensure(folderNamespace===NAMESPACE&&exactUploadName(filename)&&
   mediaType==='application/json'&&nopartial===1&&renameifexists===1,
   'Uploadziel und Nichtüberschreiben-Schutz sind nicht freigegeben');
  ensure(typeof content==='string','Verschlüsselte Dateinutzlast fehlt');
  const bytes=new TextEncoder().encode(content);
  ensure(bytes.byteLength>0&&bytes.byteLength<=MAX_BYTES,'Datei zu groß oder leer');
  const body=new FormData();
  body.append('folderid',folderId);
  body.append('renameifexists','1');
  body.append('nopartial','1');
  body.append('file',new Blob([bytes],{type:'application/json'}),filename);
  const receipt=await readJson(await fetcher(endpoint+'uploadfile',{
   method:'POST',headers:{Authorization:'Bearer '+auth.token},
   body,cache:'no-store',redirect:'error'}));
  const m=receipt.metadata;
  ensure(Array.isArray(m)&&m.length===1&&
   m[0]?.name===filename&&m[0]?.size===bytes.byteLength&&
   String(m[0]?.parentfolderid)===folderId,
   'pCloud-Upload abweichend, umbenannt oder falscher Zielordner');
  const fid=safeId(m[0].fileid);
  authorizedFiles.set(fid,{name:filename,size:bytes.byteLength});
  return {filename,fileid:fid,size:m[0].size,
   nopartial:1,renameifexists:1};
 }
 return {list,read,uploadNoOverwrite,
  namespace:NAMESPACE,kind:'unity-pcloud-node-adapter-v1',
  sessionPersisted:false,accountSessionRequired:true,
  realNetworkRequestsEnabledByCaller:true,
  browserCompatible:false};
}
module.exports={createPCloudNodeAdapter,API_HOSTS,NAMESPACE,SEGMENTS};
