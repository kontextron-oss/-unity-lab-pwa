'use strict';
/*
 * Static Safari integration regression: Apple Passwords recognises standard
 * username/current-password fields; this does not impersonate Face ID.
 * No password, Apple-ID token or auth state is stored in UNITY.
 */
const assert=require('node:assert/strict'),fs=require('node:fs');
const html=fs.readFileSync('index.html','utf8'),ui=fs.readFileSync('exchange-ui.js','utf8'),
  sw=fs.readFileSync('sw.js','utf8');
const main=html.slice(html.indexOf('03 · Austausch für PC / Hintergrundprozess'),
  html.indexOf('Geplante direkte pCloud-Verbindung'));
assert.ok(main.length>800,'Backup panel must include exchange form');
assert.match(main,/Apple Passwörter mit Face ID verwenden/);
assert.match(main,/Austauschkennung für Apple Passwörter/);
assert.match(main,/id="unity-exchange-focus-password"/);
assert.match(main,/<details class="unity-exchange-inspect-detail">/);
assert.match(main,/<details class="unity-exchange-confirm-detail">/);
assert.match(html,/if\(b\.id==='unity-exchange-focus-password'\)document\.getElementById\('unity-exchange-password'\)\?\.focus\(\);/);

assert.match(main,/value="unity-austausch" autocapitalize="none"/);
assert.match(main,/id="unity-exchange-create-form"[^>]*autocomplete="on"/);
assert.match(main,/id="unity-exchange-inspect-form"[^>]*autocomplete="on"/);
assert.equal((main.match(/name="username" autocomplete="username"/g)||[]).length,2,
  'Both export and inspection must identify the same credential username');
assert.match(main,/id="unity-exchange-password" type="password" name="password" autocomplete="current-password"/);
assert.match(main,/id="unity-exchange-inspect-password" type="password" name="password" autocomplete="current-password"/);
assert.match(main,/id="unity-exchange-password-confirm" type="password" name="password-confirm" autocomplete="off"/);
assert.match(main,/Passwort bei erster manueller Eingabe wiederholen/);
assert.match(main,/Das Feld selbst startet Face ID nicht/);
assert.match(main,/keine Verbindung zu deiner Apple-ID/);
assert.match(html,/if\(e\.target\.id==='unity-exchange-create-form'\|\|e\.target\.id==='unity-exchange-inspect-form'\)return;/,
  'Form submission must be prevented before reading FormData');
assert.match(ui,/if\(confirmation&&passphrase!==confirmation\)/,
  'Confirmation is optional for iOS AutoFill, but mismatch still rejected');
assert.match(ui,/if\(passInput\)passInput\.value='';/);
assert.match(ui,/if\(confirmInput\)confirmInput\.value='';/);
assert.match(ui,/if\(passwordInput\)passwordInput\.value='';/);
assert.doesNotMatch(ui,/localStorage\.setItem\([^)]*(password|passphrase)/i);
assert.doesNotMatch(ui,/put\('settings',\{[^}]*passphrase/);
assert.match(sw,/unity-lab-v0\.16\.0/);
assert.match(html,/exchange-ui\.js\?v=0\.16\.0/);
console.log('Safari Apple Passwords AutoFill: two semantic login forms, credential alias, safe no-submit, optional confirmation, no secret persistence and offline version passed.');
