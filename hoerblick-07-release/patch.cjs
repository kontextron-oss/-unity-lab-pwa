'use strict';
const fs=require('node:fs');
const path=require('node:path');
const root=process.argv[2]||process.cwd();
const page=path.join(root,'app/page.tsx');
const cssFile=path.join(root,'app/globals.css');
let s=fs.readFileSync(page,'utf8');
function once(a,b,label=''){const n=s.split(a).length-1;if(n!==1)throw Error(`Unexpected source ${label||a.slice(0,80)}: ${n} occurrences`);s=s.replace(a,b);}
function segmentReplace(start,end,fn,label){const a=s.indexOf(start),b=s.indexOf(end,a+start.length);if(a<0||b<0)throw Error('Missing section '+label);const old=s.slice(a,b);s=s.slice(0,a)+fn(old)+s.slice(b);}
// Camera opens on launch; no home action is required.
once('const [view, setView] = useState<View>("home");','const [view, setView] = useState<View>("magnifier");','initial view');
once('  const videoRef = useRef<HTMLVideoElement>(null);',`  const videoRef = useRef<HTMLVideoElement>(null);
  const initialCameraStartRef = useRef(false);
  const suppressCameraTapRef = useRef(false);
  const captureBusyRef = useRef(false);`,'new refs');
// No button is necessary to retry after denying camera access: tapping the preview will request camera again.
segmentReplace('  const openMagnifier = async () => {','  const adjustZoom = (next: number) => {',old=>{
 if(!old.includes('setView("home");'))throw Error('Camera failure fallback missing');
 old=old.replace('setView("home");','setView("magnifier");');
 old=old.replace('setStatus("Ein Finger verschiebt den Text. Zwei Finger vergrößern.");','setStatus("Blatt ausrichten. Zum Fotografieren das Bild antippen.");');
 return old;
},'camera open');
// A photograph is taken once per tap; no second shutter action appears.
once('  const captureMagnifier = async () => {',`  const captureMagnifier = async () => {
    if (captureBusyRef.current || loading) return;
    captureBusyRef.current = true;`,'capture lock');
segmentReplace('  const captureMagnifier = async () => {','  const toggleCameraLight = async () => {',old=>{
 const needle=`    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Die Aufnahme ist fehlgeschlagen.");
    }
  };`;
 if(!old.includes(needle))throw Error('capture end not found');
 return old.replace(needle,`    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Die Aufnahme ist fehlgeschlagen.");
    } finally {
      captureBusyRef.current = false;
    }
  };`)+`
  // Auto-launch: the browser may ask once for camera permission.
  useEffect(() => {
    if (initialCameraStartRef.current) return;
    initialCameraStartRef.current = true;
    void openMagnifier();
    // Only the first mount automatically starts the camera.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

`;
},'capture + first camera useEffect');
// Pinch/drag must not accidentally fire the shutter when Safari sends a synthetic click.
once('  const onTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {',`  const onTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    suppressCameraTapRef.current = true;`,'touch move suppression');
once('  const onTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {',`  const onTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length > 1) suppressCameraTapRef.current = true;`,'touch pinch suppression');
once('  const onTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {',`  const onTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    window.setTimeout(() => { suppressCameraTapRef.current = false; }, 450);`,'touch restore');
// Ensure low-quality single-line results get a fallback rather than appearing as an entire document.
once('      const text = selectBestRecognitionText(candidates);',`      let text = selectBestRecognitionText(candidates);
      if (!usedNativeRecognition && countRecognitionWords(text) < 12) {
        try {
          setStatus("Wenige Wörter erkannt – Dokument wird zusätzlich geprüft …");
          const worker = await createWorker();
          await worker.setParameters({ tessedit_pageseg_mode: "3" });
          const additional = await worker.recognize(image, {}, { blocks: true });
          const alternate = additional.data.text?.trim() ?? "";
          if (countRecognitionWords(alternate) > countRecognitionWords(text) + 5) text = alternate;
        } catch { /* the existing recognition remains available */ }
      }`,'sparse OCR fallback');
const renderStart=s.indexOf('  if (view === "magnifier") {');
if(renderStart<0)throw Error('Magnifier render not found');
// Attach native tap handler to the live camera area (not over buttons, not during pinch).
const stageNeedle='          className={`magnifier-stage${fullscreenReading ? " reading-text-stage" : ""}`}';
const stageStart=s.indexOf(stageNeedle,renderStart);
if(stageStart<0)throw Error('Stage class missing');
s=s.slice(0,stageStart)+s.slice(stageStart).replace(stageNeedle,stageNeedle+`
          onClick={(event) => {
            if (fullscreenReading || loading || frozenImage || importedDocumentName || suppressCameraTapRef.current) return;
            if (event.target instanceof Element && event.target.closest("button")) return;
            if (!streamRef.current) { void openMagnifier(); return; }
            void captureMagnifier();
          }}`);
// Processing is a clean white text-first state, not a second photo pane.
const imageStart=s.indexOf('          ) : frozenImage ? (',renderStart);
const imageEnd=s.indexOf('          ) : (\n            <video',imageStart);
if(imageStart<0||imageEnd<0)throw Error('Photo render branch not found');
s=s.slice(0,imageStart)+`          ) : (loading || frozenImage || importedDocumentName) ? (
            <div className="hb07-processing" role="status" aria-live="polite">
              <p>{status}</p>
            </div>
`+s.slice(imageEnd);
// Remove camera rectangle and unnecessary floating zoom badge.
const badge='<div className="magnifier-badge">{zoom.toFixed(1)}×</div>';
if(!s.includes(badge))throw Error('Legacy badge not found');s=s.replace(badge,'');
// New photo button only appears after text is fully available.
const newPhotoNeedle='          {frozenImage && (\n            <button\n              className="magnifier-new-photo"';
if(!s.includes(newPhotoNeedle))throw Error('New photo element missing');
s=s.replace(newPhotoNeedle,newPhotoNeedle.replace('{frozenImage &&','{fullscreenReading &&'));
// Voice selection from 0.6 remains accessible on the reading screen.
const modalStart=s.lastIndexOf('      {showVoiceSettings && (');
const modalEnd=modalStart<0?-1:s.indexOf('\n      )}\n    </main>',modalStart);
if(modalStart<0||modalEnd<0)throw Error('0.6 voice settings modal missing');
const modal=s.slice(modalStart,modalEnd+'\n      )}'.length);
const voiceButton='<button className="reading-voice" onClick={() => setShowVoiceSettings(true)}>Stimme</button>\n            ';
const readingButton='<button className="reading-repeat"';
if(!s.includes(readingButton))throw Error('Reader action button missing');
s=s.replace(readingButton,voiceButton+readingButton);
// Return button goes straight back to camera, no intermediary menu.
const returnLine='<button className="reading-return" onClick={closeMagnifier} aria-label="Zurück zur Startseite">←</button>';
if(!s.includes(returnLine))throw Error('Reader back button missing');
s=s.replace(returnLine,'<button className="reading-return" onClick={() => void openMagnifier()} aria-label="Neues Foto aufnehmen">📷</button>');
// No camera toolbar with shutter, zoom +/- and other controls.
const toolbarStart=s.indexOf('        ) : (\n          <div className="magnifier-toolbar">',renderStart);
const toolbarEnd=s.indexOf('        )}\n      </main>',toolbarStart);
if(toolbarStart<0||toolbarEnd<0)throw Error('Original camera toolbar not found');
s=s.slice(0,toolbarStart)+`        ) : (
          <div className="hb07-camera-hint" role="status" aria-live="polite">
            {loading || frozenImage ? status : "Blatt ausrichten · Zum Fotografieren Bild antippen"}
          </div>
`+s.slice(toolbarEnd);
// Place the existing settings dialog in the only screen used for reading.
const mainClose=s.indexOf('      </main>',s.indexOf('  if (view === "magnifier") {'));
if(mainClose<0)throw Error('Reader closing main not found');
s=s.slice(0,mainClose)+modal+'\n'+s.slice(mainClose);
fs.writeFileSync(page,s);
let css=fs.readFileSync(cssFile,'utf8');
css+=`
/* Hörblick 0.7: uninterrupted camera > photo > readable text, no photo duplication. */
.magnifier-screen { background: #060a0b; }
.magnifier-screen .magnifier-stage video { object-fit: cover; }
.hb07-camera-hint { position: absolute; z-index: 10; left: 20px; right: 20px; bottom: max(24px, calc(env(safe-area-inset-bottom) + 16px)); padding: 16px 18px; border-radius: 18px; background: rgba(6,18,25,.78); color: white; text-align: center; font-size: 19px; line-height: 1.3; font-weight: 700; pointer-events: none; }
.hb07-processing { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; padding: 30px; background: #fffdfa; color: #17243a; font-size: 23px; text-align: center; line-height: 1.45; }
.hb07-processing p { max-width: 18em; }
.reading-fullscreen .magnifier-stage { inset: 0; overflow: auto; background: #fffdfa; }
.reading-fullscreen .reading-document { font-weight: 520; line-height: 1.45; padding: max(72px, calc(env(safe-area-inset-top) + 48px)) 18px max(110px, calc(env(safe-area-inset-bottom) + 80px)); }
.reading-voice { min-width: 65px; padding: 0 9px; background: #fff; color: #15233a; font-size: 16px; font-weight: 700; }
.reading-toolbar { gap: 7px; }
.reading-return { width: 48px; }
.reading-repeat { padding: 0 13px; }
.reading-translate { min-width: 45px; }
.reading-sentence { cursor: pointer; }
`;
fs.writeFileSync(cssFile,css);
// Isolate this test PWA: no shared caches or path collisions with 0.6.
const html=path.join(root,'index.html');if(fs.existsSync(html)){
 let t=fs.readFileSync(html,'utf8').replaceAll('Hörblick 0.6','Hörblick 0.7').replaceAll('HÖRBLICK 0.6','HÖRBLICK 0.7');fs.writeFileSync(html,t);
}
const vite=path.join(root,'vite.config.ts');let v=fs.readFileSync(vite,'utf8');if(!v.includes('/hoerblick-06/'))throw Error('Vite base path for Hörblick 0.6 missing');v=v.replaceAll('/hoerblick-06/','/hoerblick-07/');fs.writeFileSync(vite,v);
const manifest=path.join(root,'public/manifest.webmanifest');if(fs.existsSync(manifest)){
 let m=fs.readFileSync(manifest,'utf8').replaceAll('Hörblick 0.6','Hörblick 0.7').replaceAll('HÖRBLICK 0.6','HÖRBLICK 0.7');fs.writeFileSync(manifest,m);
}
const sw=path.join(root,'public/sw.js');if(fs.existsSync(sw)){
 let w=fs.readFileSync(sw,'utf8');w=w.replace(/hoerblick(-[^'"\s]*)?-v(?:\d+(?:\.\d+)?)\b/g,m=>m.replace(/-v\d+(?:\.\d+)?\b/,'-v07'));
 w=w.replaceAll('hoerblick-06','hoerblick-07');fs.writeFileSync(sw,w);
}
const checks={autoCamera:s.includes('initialCameraStartRef.current = true;'),tapCapture:s.includes('void captureMagnifier();'),fullText:s.includes('segmentReadingText(readingText)'),noPhotoDisplay:!s.includes('src={frozenImage}'),settings:s.includes('<button className="reading-voice"'),noCameraToolbar:!s.includes('<div className="magnifier-toolbar">'),sparseFallback:s.includes('Wenige Wörter erkannt')};
if(Object.values(checks).some(x=>!x))throw Error('Missing behavior '+JSON.stringify(checks));
console.log('Hörblick 0.7 patches passed:',JSON.stringify(checks));
