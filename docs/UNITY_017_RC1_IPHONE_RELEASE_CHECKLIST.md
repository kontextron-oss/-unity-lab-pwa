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
