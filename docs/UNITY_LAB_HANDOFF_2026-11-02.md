# UNITY LAB – Übergabe 2. November 2026

## Ausgangslage am Abend

- iPhone-Safari-PWA / Local-First. Aktuelle Version: **0.13.47**.
- main-Commit der aktuellen App: 36abc70eb86d33bccb32891af5129d4fc2636fd2.
- Repository: kontextron-oss/-unity-lab-pwa; GitHub Pages: https://kontextron-oss.github.io/-unity-lab-pwa/
- PR #9 für die pCloud-Handoff-Sicherung wurde zusammengeführt. GitHub-Actions-Hauptzweigprüfung und Datenworkflow erfolgreich. Praxistest der aktualisierten Anzeige und echte pCloud-Speicherung auf dem iPhone noch offen.
- Bestehende Funktionen: Kursübersicht, lokale Aktienliste, Hinzufügen/archivieren/wiederherstellen, Recherche-Radar, Rücksetzerkennzeichen, Tiefenanalyse mit regelbasiertem Ja/Nein/Offen, fiktives Depot. Keine echte Broker-Order.

## Unterscheidung der Datenquellen

1. **Google Sheets / UNITY KURSKONTROLLE**: Tabellenanwendung mit dafür vorbereiteten GOOGLEFINANCE-Formeln. Google stellt hierbei Börsendaten bereit, wenn die Formeln in Google Sheets berechnet werden (Kurs, Änderungswerte, Währung, Zeitangaben). Eine exportierte Excel- oder CSV-Kopie in pCloud ist nur ein Datenstand und berechnet GOOGLEFINANCE nicht automatisch weiter. Es ist im aktuellen PWA-Repository **keine direkte, dauerhaft aktive Anbindung der privaten Google-Tabelle als Hauptkursfeed** nachgewiesen.
2. **Regelmäßiger PWA-Kursfeed**: separate inoffizielle, verzögerte Yahoo-Finance-Tagesreferenzen über scripts/refresh_market.py, GitHub-Actions und data/market.json; außerdem lokales Zwischenspeichern ausgewählter Kurshistorien beim Hinzufügen einer Aktie. Keine garantierten Echtzeit- oder offiziellen Börsendaten.
3. **Lokale persönliche Daten**: IndexedDB-Datenbank unity-lab auf dem jeweiligen Gerät, mit neun Stores: instruments, quotes, transactions, strategies, audit, fundamentals, histories, analyses, settings.
4. **pCloud**: künftig privater Sicherungsspeicher. Separater privater Ordner empfohlen: UNITY-LAB/Sicherungen. Nicht mit dem WERK-ARCHIV vermischen. Keine öffentliche Freigabe der Sicherungen oder der privaten Google-Tabelle.

## Bereits umgesetzt in 0.13.47

- Datensicherung → **In pCloud sichern · Teilen** erzeugt eine vollständige, datierte JSON-Datei mit allen neun lokalen Stores und öffnet, falls vom Gerät unterstützt, das iOS Share Sheet. Die Datei muss vom Nutzer bewusst in den privaten pCloud-Ordner gespeichert werden. Ein geschlossener Share-Dialog ist **kein nachgewiesener erfolgreicher Upload**.
- Alternativ **JSON-Sicherung herunterladen**, danach manuell in pCloud speichern.
- Datensicherung → **Aus pCloud wiederherstellen** wählt eine JSON-Datei über die iPhone-Dateiauswahl aus; der bestehende Import prüft IDs, bricht bei konfligierenden Datensätzen ab und überschreibt nicht still. Gesonderte Zustimmung beim abweichenden fiktiven Startkapital.
- Backup-Format: unity-lab-backup, Schema 3, datierte Dateinamen; Importlimit 50 MB. Die Sicherungsdatei enthält sensible persönliche Investmentdaten.
- **Noch nicht umgesetzt:** automatische pCloud-OAuth-Verbindung, regelmäßig bestätigte Cloud-Uploads im Hintergrund, bidirektionale Synchronisation.

## Nächste Sitzung (ab 3. November 2026): konkreter Arbeitsauftrag

1. Auf dem iPhone überprüfen, dass Version 0.13.47 geladen ist. Bestehende lokale Daten und Testkäufe nicht verändern oder löschen.
2. Einen privaten Ordner UNITY-LAB/Sicherungen in pCloud anlegen oder bestätigen; ohne öffentliche Freigabelinks.
3. In UNITY unter Datensicherung eine datierte JSON-Datei über „In pCloud sichern · Teilen“ erstellen, im privaten Ziel ablegen und danach **in pCloud selbst** Vorhandensein, Dateinamen und plausible Dateigröße kontrollieren. Wenn die iOS-Dateifreigabe fehlt, Download-Fallback verwenden.
4. Anschließend den Wiederherstellungsablauf mit einer kontrollierten Sicherung auf Lesbarkeit und Konfliktbehandlung prüfen. Vor Tests eine unveränderte sichere Rückfallebene bewahren; keine stillen Überschreibungen und keine Datenverluste.
5. Erst dann die **direkte, nutzerautorisierte pCloud-Sicherung** entwickeln: nur mit geeigneter Zugriffsauthorisierung, keine Zugangsdaten/Tokens im öffentlichen GitHub-Frontend, in Google Sheets, in Logs oder im Backup; sichtbarer Status letzter tatsächlich bestätigter Sicherung, Versionierung, Prüfsumme und Wiederherstellungstest.
6. Automatische bidirektionale Sync ist eine **spätere** eigenständige Ausbaustufe: stabile IDs, Zeitstempel/Revisionen, Konflikterkennung, nichtdestruktive Zusammenführung. Die iPhone-PWA kann nicht pauschal eine zuverlässige Sicherung bei geschlossener App versprechen.
7. Die Google-Tabelle bleibt für Kurskontrolle unabhängig von pCloud. GOOGLEFINANCE braucht Google Sheets; eine Datei in pCloud ist nur Speicherung/Snapshot, kein ersetzender Formel-/Finanzdatenserver.

## Datenschutz / Projektkontinuität

- Diese Übergabedatei liegt im **öffentlichen Code-Repository** und enthält bewusst keine privaten Sheet-Links, Benutzer-/Depotdaten, pCloud-Adressen, IDs, Passwörter oder Zugangs-Tokens.
- Benutzerwunsch: die echte pCloud-Anbindung heute **nicht** weiter vornehmen, sondern die nötigen Schritte beim nächsten Termin fortsetzen; ohne Grundsatzdiskussion oder erneutes Aufsetzen der App.

## Ergänzung 2. November 2026 – offizieller Quellenmonitor

- UNITY LAB 0.13.47 enthält SEC-/XBRL-Unternehmensmeldungs-Monitor im Aktien- und Tiefenanalysebereich.
- Automatischer werktäglicher SEC-Abruf eingerichtet; erster Versuch vom GitHub-Runner wurde durch die SEC für Tickerindex und direkte SEC-Zugriffe blockiert. Der Collector dokumentiert für zehn US-Kandidaten **source-unavailable**, statt Kennzahlen zu erfinden. Die vier vorhandenen EU-Pilotberichte bleiben abrufbar. Kein belegtes US-Ergebnis vorgeben.
- Nur tatsächliche Veröffentlichungsdaten dürfen Nachrichtenmarkierungen auslösen; der Tag der Quellenprüfung gilt nicht als Veröffentlichungsdatum.
- Für spätere Verbesserung: SEC-kompatiblen, ausdrücklich erlaubten Datenzugang oder alternative belastbare offene Quelle prüfen. Keine unnötigen Proxys mit unklaren Nutzungsbedingungen.
- Der getrennte pCloud-Sicherungs- und Wiederherstellungstest bleibt unverändert als nächster persönlicher Arbeitsschritt vorgesehen.
