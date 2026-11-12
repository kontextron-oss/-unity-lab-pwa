'use strict';
/* Validate public-only static RC1 bundle, no deployment credentials required. */
const fs=require('node:fs'),path=require('node:path'),
 cp=require('node:child_process'),assert=require('node:assert/strict'),
 crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const out=path.join(root,'dist');
const build=cp.spawnSync(process.execPath,['scripts/build-staging.cjs'],
 {cwd:root,encoding:'utf8',timeout:120000});
assert.equal(build.status,0,'Preview build failed: '+build.stderr);
assert.match(build.stdout,/public assets/);
const sw=fs.readFileSync(path.join(out,'sw.js'),'utf8');
assert.match(sw,/const CACHE='unity-lab-v0\.17\.0-rc1-datafix-20261112'/);
assert.match(fs.readFileSync(path.join(out,'index.html'),'utf8'),/0\.17\.0 RC1/);
const direct=fs.readFileSync(path.join(out,'unity-017.html'),'utf8');
assert.match(direct,/Unity Lab 0\.17\.0 RC1 · Direktstart/);
assert.match(direct,/indexedDB\.open\('unity-lab',3\)/,'direct launch uses existing user database');
assert.doesNotMatch(direct,/indexedDB\.deleteDatabase\s*\(/);
assert.match(fs.readFileSync('sw.js','utf8'),/'\.\/unity-017\.html'/);
const updatePage=fs.readFileSync(path.join(out,'update.html'),'utf8');
assert.match(updatePage,/UNITY · Sichere Aktualisierung/);
assert.match(updatePage,/UNITY_ACTIVATE_UPDATE/);
assert.match(fs.readFileSync(path.join(out,'sw.js'),'utf8'),/'\.\/update\.html'/,'Safari update helper must be in deployed offline cache');
assert.match(updatePage,/\.\/unity-017\.html/,'update points to versioned direct launch');
assert.doesNotMatch(updatePage,/indexedDB\.deleteDatabase|caches\.delete|localStorage\.clear|\.unregister\(/);
const main=fs.readFileSync(path.join(out,'manifest.webmanifest'),'utf8');
assert.equal(JSON.parse(main).short_name,'UNITY RC1');
assert.equal(fs.readFileSync(path.join(out,'robots.txt'),'utf8'),"User-agent: *\nDisallow: /\n");
const appData=[
 'data/issuer-guidance.json','data/valuation-assumptions.json',
 'data/debt-pilot-evidence.json','data/normalization-evidence.json',
 'data/financing-stress-evidence.json'
];
for(const file of appData){
 const source=fs.readFileSync(path.join(root,file));
 const staging=fs.readFileSync(path.join(out,file));
 assert.equal(crypto.createHash('sha256').update(source).digest('hex'),
  crypto.createHash('sha256').update(staging).digest('hex'));
 const doc=JSON.parse(staging);
 assert.equal(doc.schemaVersion,1);
}
for(const forbidden of ['.git','tests','docs','.github','worker','.env',
 '.env.local','node_modules','backup','pcloud','scripts','vercel.json']){
 assert.ok(!fs.existsSync(path.join(out,forbidden)),'Leaked nonpublic data '+forbidden);
}
assert.ok(!fs.existsSync(path.join(out,'data','normalization-evidence.json.json')));
assert.ok(fs.existsSync(path.join(out,'valuation-scenarios.js')));
const src=fs.readFileSync(path.join(root,'index.html'),'utf8');
const compiled=fs.readFileSync(path.join(out,'index.html'),'utf8');
assert.equal(src,compiled,'No HTML transformations allowed');
assert.ok(!compiled.includes('vercel.json'));
const nFiles=(dir)=>fs.readdirSync(dir,{withFileTypes:true})
 .reduce((n,f)=>n+(f.isDirectory()?nFiles(path.join(dir,f.name)):1),0);
assert.ok(nFiles(out)>35);
console.log('RC1 GitHub-only static package verified: public-only assets, 5 evidence files, immutable source and no private directories; no hosting provider required.');
