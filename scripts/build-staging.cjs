'use strict';
/* Release-candidate PREVIEW ONLY.
 * Build an explicit public-asset allowlist; never publish repo tests, CI,
 * worker state, personal portfolios, .env, keys or backups to a hosting site.
 * This script does NOT deploy, merge, change GitHub Pages, or access secrets. */
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const output=path.join(root,'dist');
const worker=fs.readFileSync(path.join(root,'sw.js'),'utf8');
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.webmanifest'),'utf8'));
const obj=vm.runInNewContext(worker+';({CACHE,ASSETS})',{
 self:{addEventListener(){}},
 URL,location:{origin:'https://staging.invalid'}
},{timeout:3000});
if(obj.CACHE!=='unity-lab-v0.17.0-rc1'||
   !index.includes('Unity Lab 0.17.0 RC1')||
   !index.includes('valuation-scenarios.js?v=0.17.0-rc1')||
   manifest.short_name!=='UNITY RC1')
 throw Error('Not the source-verified UNITY 0.17.0 RC1 candidate');
const assets=new Set(['index.html','sw.js','manifest.webmanifest','icon.svg']);
function assetPath(url) {
 if(typeof url!=='string'||!/^\.\//.test(url)||url.includes('\\'))throw Error('Invalid asset URL '+url);
 const u=new URL(url,'https://staging.invalid/');
 if(u.origin!=='https://staging.invalid')throw Error('Remote asset rejected');
 const value=decodeURIComponent(u.pathname.slice(1))||'index.html';
 if(!/^[a-zA-Z0-9_./-]+$/.test(value)||value.startsWith('/')||
    value.split('/').some(p=>p==='..'||p==='.')||
    value.startsWith('.'))throw Error('Unsafe asset path '+value);
 return value;
}
for(const asset of obj.ASSETS){
 if(asset==='./')continue;
 assets.add(assetPath(asset));
}
const scripts=[...index.matchAll(/<script\s+src=["']([^"']+)["']/g)].map(m=>m[1]);
for(const ref of scripts){
 const file=assetPath(ref);
 if(!assets.has(file))throw Error('HTML script not precached: '+file);
}
const sources=[
 'data/issuer-guidance.json','data/valuation-assumptions.json',
 'data/debt-pilot-evidence.json','data/normalization-evidence.json',
 'data/financing-stress-evidence.json'
];
for(const source of sources){
 if(!assets.has(source))throw Error('Evidence excluded from offline precache: '+source);
 const doc=JSON.parse(fs.readFileSync(path.join(root,source),'utf8'));
 if(doc.schemaVersion!==1||!doc.items||Array.isArray(doc.items))throw Error('Invalid evidence JSON '+source);
}
if(fs.existsSync(output)){
 if(fs.lstatSync(output).isSymbolicLink())throw Error('Output is symlink');
 fs.rmSync(output,{recursive:true,force:true});
}
fs.mkdirSync(output,{recursive:true});
const manifestReport=[];
for(const relative of [...assets].sort()){
 const from=path.join(root,relative),to=path.join(output,relative);
 const stat=fs.lstatSync(from);
 if(!stat.isFile()||stat.isSymbolicLink())throw Error('Unsafe or missing public asset '+relative);
 fs.mkdirSync(path.dirname(to),{recursive:true});
 fs.copyFileSync(from,to);
 const raw=fs.readFileSync(to);
 manifestReport.push({path:relative,bytes:raw.length,
  sha256:crypto.createHash('sha256').update(raw).digest('hex')});
}
fs.writeFileSync(path.join(output,'robots.txt'),'User-agent: *\nDisallow: /\n');
fs.writeFileSync(path.join(output,'BUILD-INFO.txt'),
 'UNITY 0.17.0 RC1 · separate-origin test only\n'+
 'No real orders. No private data included. Not a production release.\n');
const included=new Set(fs.readdirSync(output));
if(included.has('.git')||included.has('worker')||included.has('tests')||
   included.has('docs')||included.has('.github'))throw Error('Nonpublic repo file accidentally exported');
console.log('UNITY RC1 static preview: '+assets.size+' public assets, '+
 sources.length+' evidence sources, no repo tests/private folders.');
if(process.env.UNITY_STAGING_REPORT==='1'){
 for(const entry of manifestReport)console.log(entry.path+' '+entry.sha256);
}
