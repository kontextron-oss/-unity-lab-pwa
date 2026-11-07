# UNITY 0.17.0 RC1 – iPhone- und Offline-Abnahme

Stand: 07.11.2026 · **Nur Entwicklungszweig** `feat/unity-017-valuation-evidence` / GitHub PR #78. **Nicht nach `main` gemergt, nicht öffentlich als installierbare Safari-PWA bereitgestellt.** Die bestehende UNITY-0.16.5-App bleibt unverändert.

## Umsetzung RC1

- Testkennung in Titel, Header und Footer: `0.17.0 RC1`. Das `manifest.webmanifest` trägt **UNITY RC1** als Home-Screen-Name, bei unverändertem `start_url` und PWA-Scope.
- `index.html` lädt nur das geänderte Bewertungsmodul als `valuation-scenarios.js?v=0.17.0-rc1`; alle sonstigen bewährten Module behalten ihre unveränderten Referenzversionen.
- Der Service Worker verwendet das neue Cache-Namespace `unity-lab-v0.17.0-rc1` und installiert atomar alle bisherigen App-Assets **plus** `data/debt-pilot-evidence.json`, `data/normalization-evidence.json` und `data/financing-stress-evidence.json`.
- Kein `skipWaiting()` beim Installieren, kein erzwungenes `location.reload()` durch ein `controllerchange`-Ereignis und kein Löschen bisheriger `unity-lab-`-Caches bei der RC-Aktivierung. **ACHTUNG:** Beibehaltene Cache-Einträge sind keine garantierte eigenständige App-Rückfallinstallation. Auf derselben Web-Origin gilt weiterhin die aktive Service-Worker-Registrierung; ein späterer Live-Rollback benötigt eine kontrollierte Veröffentlichung.
- Lokale IndexedDB unverändert: **`unity-lab`, Version 3**, mit den bisherigen neun Object Stores. Keine Schema-Migration, keine automatische Löschung, kein Überschreiben von Benutzerdepotdaten durch öffentliche SEC-Forschungsdaten. Die öffentliche Analyse bleibt read-only; die bestehenden Simulationsdepots bleiben getrennt.
- Neue Finanzdiagnosen bleiben **Eaton/Vertiv-Pilot** und Forschungsanzeige. Keine echte Order, kein stiller Eintrag im Decision Ledger, keine bewertungsbasierte automatische Kaufentscheidung.

## Bereits technisch testbar

`tests/rc17-offline-safety.cjs` überprüft unter Node 22:
1. Gleiche IndexedDB-Identität und Stores und keine destruktive Löschoperation.
2. Exakte Versionsbindung `index.html` ↔ `sw.js` ↔ Bewertungsmodul; unterscheidbare RC1-Home-Screen-Kennung.
3. Atomaren Precache: Alle referenzierten Dateien existieren und die drei neuen öffentlichen SEC-Datendateien sind dabei.
4. Simulierten Flugmodus mit `fetch`-Fehlern: Service Worker liefert die JSON-Dateien aus Cache Storage; das Bewertungsmodul lädt mit seinem offiziellen Offline-Fallback weiter alle fünf Quellen.
5. Keine Zwangsaktivierung bzw. kein erzwungener Reload; alte Cache-Namen bleiben erhalten. Keine erfundenen Bewertungsannahmen.

Die regulären GitHub-Actions-Läufe `UNITY 0.17 valuation regression` und `Validate Unity Lab JavaScript` müssen am **jeweiligen letzten Commit** grün sein. Grün allein bedeutet *nicht*, dass Safari, Face ID oder pCloud in echt getestet wurden.

## Noch erforderliche manuelle iPhone-Praxisabnahme

**Nicht über die einzige bestehende Installationsadresse testen, bevor eine separate, überprüfte Safari-Test-URL bereitsteht.** Das GitHub-PR ist selbst keine im Safari-Browser installierbare PWA.

1. Auf dem iPhone in der bestehenden App **vorher ein vollständiges Backup exportieren**, und kontrollieren, dass sich die Sicherungsdatei in pCloud unabhängig von der App öffnen bzw. nachweisen lässt. Nicht davon ausgehen, dass der Share-Dialog allein die Sicherung bestätigt.
2. Vor dem Update Anzahl/ID einer kleinen, eindeutig wiedererkennbaren Auswahl von Aktien, Entscheidungen, Simulationsorders und benutzerdefinierten Einstellungen notieren. Niemals Test-Bestände als reales Depot behandeln.
3. RC1 erst auf einer getrennten, funktionierenden HTTPS-Testadresse in Safari öffnen. Hierbei ist die Herkunft (Origin) wesentlich: **andere Origin bedeutet separate IndexedDB**; Bestandsdaten sind dort nicht automatisch verfügbar. Ist die Origin identisch, teilt die Testversion den lokalen Speicher, weshalb eine separate Sicherung und gezielter Migrationstest unumgänglich sind.
4. `UNITY RC1` über **Zum Home-Bildschirm** hinzufügen und die Home-Screen-Ansicht des iPhone 15 Pro überprüfen: keine horizontale Überbreite, schnelle Aktienauswahl, flüssige Detailanzeige, vollständige Watchlist einschließlich der letzten Titel.
5. Eaton und Vertiv öffnen. Sieben Bewertungsnachweise, TTM, Normalisierungsrisiken, Nettozinsen und kontrafaktischer Zinsstress müssen aufklappbar sein; niemals `Kaufen` oder reale Orders aus diesen Forschungsabschnitten ableiten.
6. Flugmodus einschalten, WLAN ausschalten, **RC1 vollständig schließen und neu öffnen**: App und die fünf öffentlichen Bewertungsquellen müssen verfügbar bleiben. Lokal eine Testnotiz oder Einstellung bearbeiten und speichern, erneut öffnen und Fortbestand prüfen – nur in einer gesicherten Testdatenumgebung.
7. Zurück online gehen. Verifizieren, dass weder ältere lokale Nutzerwerte noch Watchlist-Einträge überschrieben werden; Backups und ggf. manueller pCloud-Austausch dürfen nur auf ausdrückliche Bedienung erfolgen.
8. Getrennt prüfen: Apple-Passwort-AutoFill/Face-ID-Vorschlag (kein automatisches iOS-Biometrieversprechen), Import- und Exportdateien, Konfliktbehandlung und Performance. Die vorhandene stabile PWA muss weiterhin verwendbar bleiben.
9. Ein neues Browser-PWA-Bundle darf erst als Release vorgestellt werden, wenn die Safari-URL **tatsächlich erreichbar und getestet** ist; GitHub-Code allein ist kein installiertes iPhone-Build.

## Freigabebedingungen

**Nicht vor diesen Voraussetzungen nach `main` mergen:** frische CI-Ergebnisse, zugängliche RC1-HTTPS-Testadresse, tatsächlicher Offline-/Online-Test auf dem iPhone, unabhängiges Backup, kein Datenverlust, keine Performance-Regressions, klare Release-/Rollback-Anleitung. Für endgültiges 0.17 ohne „RC1“ müssen Cache-ID, Titel, Manifest und betroffene Assertions kontrolliert neu versioniert werden.

Dieser Teststand ist eine **technische Kandidatenversion**, keine Behauptung, dass der reale iPhone-Test oder die Veröffentlichung bereits stattgefunden hat.

## Isolierte HTTPS-Vorschau: Vercel, noch nicht veröffentlicht

Die bestehende Produktiv-URL auf GitHub Pages ist `https://kontextron-oss.github.io/-unity-lab-pwa/`. **Ein zweiter Pfad unter dieser Domain reicht zur Isolation nicht aus:** IndexedDB ist originbezogen, nicht service-worker-scope-bezogen. Deshalb darf RC1 nicht dort als scheinbar separate App veröffentlicht werden.

Die GitHub-Dateien `scripts/build-staging.cjs` und `vercel.json` bereiten eine **statische Vorschau auf einer anderen HTTPS-Origin** vor. Der Builder erzeugt `dist/` ausschließlich aus der geprüften öffentlich verwendeten Service-Worker-Dateiliste (plus Index, Manifest und Icon), schließt `worker/`, `tests/`, `docs/`, `.env`, CI und andere Repo-Dateien vom öffentlichen Upload aus und prüft alle fünf Bewertungsquellen. Es werden keine persönlichen Depotdaten aus dem iPhone kopiert.

Die Vorschau ist zurzeit **noch nicht gehostet und hat noch keine bestätigte URL**. Der GitHub-PR ist nur Quellcode. Für eine echte Adresse wird ein verbundener Vercel-Hosting-Zugang benötigt:

1. In ChatGPT Vercel verbinden (Authentifizierung beim Anbieter, keine Token oder Passwörter hier senden). Vercel kann das vorhandene GitHub-Projekt deployen.
2. Aus `kontextron-oss/-unity-lab-pwa` einen **Preview-Deploy** des Branches `feat/unity-017-valuation-evidence` erzeugen – **kein Merge und kein Deploy zur bestehenden GitHub-Pages-Domain**.
3. Build Command: `node scripts/build-staging.cjs`; Output Directory: `dist` (bereits in `vercel.json`). Vertrauliche Umgebungsvariablen dürfen nicht für die Preview benötigt werden. Die Vorschau enthält ausschließlich statische Quellen.
4. Zugriffsschutz unter **Deployment Protection / Vercel Authentication für Preview** aktivieren, sofern nach gewählter Hosting-Konfiguration verfügbar. Die Vorschau soll nicht in Suchmaschinen erscheinen: `X-Robots-Tag: noindex` und `robots.txt` sind vorbereitet. Ein öffentliches Repository bedeutet nicht, dass man private Testdaten veröffentlichen darf.
5. Erst die durch Vercel tatsächlich zurückgemeldete, erreichbare `*.vercel.app`-Vorschauadresse verwenden. **Nicht** eine URL aus Projektnamen raten. Den Safari-Login, Home-Screen-Start, Offline-Rückkehr und Cache-Effekt auf dem iPhone real prüfen. Geschützte Vorschau und iOS-PWA-Cookies können sich unterscheiden.
6. Die Testversion hat eine andere Website-Origin als GitHub Pages und damit eine **getrennte IndexedDB**. Das ist beabsichtigt: Testdaten werden dort getrennt angelegt; persönliche Daten werden nicht von der Produktiv-App automatisch übernommen. Beim Test weder Produktions-Backups hochladen noch Produktiv-Accounts verbinden, sofern das nicht ausdrücklich und mit Sicherungsstrategie freigegeben wurde.

### CI-Nachweis

`tests/rc17-staging-bundle.cjs` startet den Builder unter Node, validiert die Dateihashes aller fünf öffentlichen SEC-Datenquellen, sichert den Ausschluss von privaten Quellordnern und prüft Vercel-Build-/Noindex-Einstellungen. Der Test ist Teil der GitHub-Pipeline `.github/workflows/unity-017-valuation.yml`. Erfolgreiche CI bedeutet **nur bereites Paket**, nicht tatsächliche HTTPS-Veröffentlichung.

Das **einzige notwendige externe Handlungsstück** vor der ersten Safari-Testadresse ist daher die Verbindung eines Hosting-Kontos und das Auslösen der Preview-Veröffentlichung; die bestehende GitHub-Pages-App bleibt davon unberührt.
