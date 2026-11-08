'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = process.argv[2] || process.cwd();
const page = path.join(root,'app/page.tsx');
const cssFile = path.join(root,'app/globals.css');
let source = fs.readFileSync(page,'utf8');
function one(before,after){
  const count = source.split(before).length - 1;
  if(count !== 1) throw new Error('Expected exactly one source anchor, got '+count+': '+before.slice(0,100));
  source = source.replace(before,after);
}
// Derive from the tested HÖRBLICK 0.7 read-only camera/reader workflow.
one('import { useCallback, useEffect, useRef, useState } from "react";',
    'import { useCallback, useEffect, useRef, useState } from "react";\nimport { analyzeDocumentStructure } from "./document-structure";');
one('  const [photoText, setPhotoText] = useState("");',
    '  const [photoText, setPhotoText] = useState("");\n  const [showFullText, setShowFullText] = useState(false);');
const resets=source.split('setPhotoText("");').length-1;
if(resets<2 || resets>8)throw new Error('Unexpected number of text-reset sites: '+resets);
source=source.replaceAll('setPhotoText("");','setPhotoText("");\n    setShowFullText(false);');
one('  const readingText = translatedText || photoText;',
`  // Prefer letter body only when the OCR clearly identifies a formal salutation
  // and a separate administrative header. All original words remain recoverable.
  const documentStructure = analyzeDocumentStructure(photoText);
  const isFormalLetter = documentStructure.kind === 'letter';
  const readingText = translatedText || (isFormalLetter && !showFullText ? documentStructure.contentText : photoText);`);
one('              {readingSentences.map((sentence) => (',
`              {isFormalLetter && !translatedText && (
                <div className="hb08-letter-controls" role="group" aria-label="Ansicht des Schreibens">
                  <span>{showFullText ? "Gesamtes Schreiben" : "Briefinhalt"}</span>
                  <button type="button" aria-pressed={showFullText} onClick={(event) => {
                    event.stopPropagation();
                    stopReading();
                    setShowFullText(!showFullText);
                  }}>
                    {showFullText ? "Nur Briefinhalt" : "Alle Angaben"}
                  </button>
                </div>
              )}
              {readingSentences.map((sentence) => (`);
one('style={{ fontSize: `${Math.round(29 * zoom)}px` }}',
    'style={{ fontSize: `${Math.round(21 * zoom)}px` }}');
fs.copyFileSync(path.join(__dirname,'document-structure.ts'),path.join(root,'app/document-structure.ts'));
fs.writeFileSync(page,source);
let css=fs.readFileSync(cssFile,'utf8');
css += `
/* HÖRBLICK 0.8: conservative letter-body reader. Document metadata is always recoverable. */
.hb08-letter-controls { display:flex; flex-wrap:wrap; gap:10px; justify-content:space-between; align-items:center; margin:0 0 16px; padding:7px 0 13px; border-bottom:1px solid #ccd5df; color:#44546a; font-size:16px; font-weight:650; }
.hb08-letter-controls button { border:1px solid #6c7b8b; border-radius:11px; background:#eef3fa; color:#14223b; padding:9px 13px; min-height:43px; font-size:16px; font-weight:700; cursor:pointer; }
.hb08-letter-controls button:focus-visible { outline:3px solid #da9d29; outline-offset:2px; }
`;
fs.writeFileSync(cssFile,css);
const html=path.join(root,'index.html');
if(fs.existsSync(html)) {
 let t=fs.readFileSync(html,'utf8').replaceAll('Hörblick 0.7','Hörblick 0.8').replaceAll('HÖRBLICK 0.7','HÖRBLICK 0.8');
 fs.writeFileSync(html,t);
}
const vite=path.join(root,'vite.config.ts');
let v=fs.readFileSync(vite,'utf8');
if(!v.includes('/hoerblick-07/'))throw Error('Expected isolated Hörblick 0.7 path');
v=v.replaceAll('/hoerblick-07/','/hoerblick-08/');
fs.writeFileSync(vite,v);
for(const relative of ['public/manifest.webmanifest','public/sw.js']){
 const filename=path.join(root,relative);
 if(fs.existsSync(filename)){
  let c=fs.readFileSync(filename,'utf8').replaceAll('hoerblick-07','hoerblick-08').replaceAll('Hörblick 0.7','Hörblick 0.8').replaceAll('HÖRBLICK 0.7','HÖRBLICK 0.8').replaceAll('hoerblick-v07','hoerblick-v08');
  fs.writeFileSync(filename,c);
 }
}
const checks={separateMetadata:source.includes('isFormalLetter'),allText:source.includes('Alle Angaben'),defaultMain:source.includes('documentStructure.contentText'),unchangedOCR:source.includes('selectBestRecognitionText'),cameraFirst:source.includes('initialCameraStartRef.current = true;'),originalSource:source.includes('const [photoText, setPhotoText]'),zoom:source.includes('Math.round(21 * zoom)')};
if(Object.values(checks).some(v=>!v))throw Error('Regression '+JSON.stringify(checks));
console.log('Hörblick 0.8 patch validated: '+JSON.stringify(checks));
