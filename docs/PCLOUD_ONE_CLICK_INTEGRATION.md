# UNITY LAB – direkte pCloud-Sicherung mit einem Knopfdruck (technischer Übergabevertrag)

Stand: 2026-11-03 · Ziel nach Version 0.13.49 · noch **nicht** live angebunden.

## Zielbild und vorläufige Ordner

Privat in einem pCloud-Konto:

- `/UNITY-LAB/01-AENDERUNGEN/` – BASIS und AENDERUNG-Dateien der SHA-256-geprüften inkrementellen Sicherungskette.
- `/UNITY-LAB/02-VOLLSICHERUNG/` – vollständige JSON-Rückfallebenen, nur gelegentlich.
- Bestehende `UNITY-LAB-CLOUD-…`-Dateien müssen bis zum bestätigten neuen BASIS-Checkpoint zusammenbleiben. Keine automatische Verschiebung oder Löschung.

## Sicherheitsarchitektur

1. **Einmalige pCloud-Freigabe** über offiziellen OAuth-2.0-Code-Flow und serverseitigen Callback; CSRF-sicherer `state`-Wert, HTTPS, eingeschränkte App-Berechtigungen, nur erforderliche Scopes.
2. Die serverseitige Vermittlung speichert pCloud-Bearer-Token sicher und benutzergebunden. **Keine** pCloud-Access-Tokens/Client-Secrets in öffentlichen GitHub-Dateien, LocalStorage, PWA-Quelltext, Cloud-JSON, Browser-URLs oder App-Logs.
3. Der pCloud-API-Host kommt aus der bestätigten OAuth-Rückgabe (`api.pcloud.com` bzw. `eapi.pcloud.com`), wird gegen diese erlaubten Hosts geprüft und benutzergebunden gespeichert.
4. Die Vermittlung erzeugt/verwendet ausschließlich die zwei privaten Sicherungs-Unterordner. Sie benutzt feste pCloud-`folderid`-Werte statt ungeprüfter Pfade oder öffentlich geteilte Links.
5. Der Client benötigt vor dem erstmaligen Upload eine erfolgreiche Authentifizierung der Sitzung. Keine Upload-Aktion durch fremde Nutzer und kein öffentlich zugänglicher Upload-Endpunkt.

## Gewünschter Ablauf nach einmaliger Verbindung

**Einmaliger Klick „Änderungen jetzt in pCloud sichern“**:

1. Die PWA stellt die nächste inkrementelle Sicherung aus lokaler IndexedDB und dem zuletzt **bestätigten** Checkpoint zusammen. Kein Update des lokalen Cursors vor erfolgreicher Cloud-Bestätigung.
2. PWA übermittelt die Datei an einen autorisierten HTTPS-Endpunkt. Server überprüft Datei-MIME/Größe, Backup-Format, UTC-Zeitstempel, `backupId`, `parentId`, Hash der Datensätze und das erwartete Ziel.
3. Server vergleicht vor dem Upload den zuletzt bestätigten Cloud-Index; bei Konflikt keinesfalls still überschreiben.
4. Server lädt per pCloud-`uploadfile` in `01-AENDERUNGEN` oder `02-VOLLSICHERUNG`. Idempotenter Upload anhand `backupId` / Dateinamen: erneutes Klicken bei Funkunterbrechung erzeugt keine doppelten Bestände.
5. Ein `result:0` allein genügt nicht: pCloud-Datei-ID, Dateiname und exakte Byteanzahl kontrollieren, nach Möglichkeit remote content hash überprüfen und im Audit-Log den vollständigen bestätigten Status speichern.
6. Erst nach dieser bestätigten Antwort darf die PWA das lokale `unity-lab-incremental-checkpoint-v1` aktualisieren und „pCloud gesichert · Datum/Uhrzeit“ anzeigen.
7. Bei Serverfehler, Offlinezustand oder unterbrochenem Upload unveränderten alten Cursor erhalten; nächster Versuch wiederholt idempotent.

**Vollsicherung**: Separater expliziter Befehl, gleiches Auth-/Transportverfahren, anderer privater Zielordner; keine regelmäßigen Vollkopien bei jedem Aktien-Update.

**Wiederherstellung**: Bestätigte Basis samt sämtlichen Änderungsdateien zur lokalen SHA-256-Prüfung lesen; bei abweichenden IDs sichtbaren Konflikt erzeugen und niemals vorhandene Käufe, Verkäufe oder Analysen unbemerkt ersetzen.

## Minimaler Vertrag für eine spätere, authentifizierte Sync-Schnittstelle

- `GET /api/pcloud/connection` → verbunden/nicht verbunden, bestätigtes Konto (keine Zugangsdaten), Ordnerstatus, letzte bestätigte Sicherung.
- `GET /api/pcloud/auth/start` → nutzerinitiierter Redirect zur offiziellen pCloud-OAuth-Seite.
- `GET /api/pcloud/auth/callback` → Code + State prüfen, serverseitiger Tokenaustausch, sichere Sitzung.
- `POST /api/pcloud/backups/incremental` → privater JSON-Änderungssatz, idempotenter `backupId`/Hash, geprüfter Upload, Rückgabe erst nach Verifikation.
- `POST /api/pcloud/backups/full` → private Vollsicherung, gleicher Integritätsschutz, eigener Ordner.
- `GET /api/pcloud/backups/manifest` → bestätigte private BASIS-/Änderungskette für kontrolliertes Restore.

## Vorbedingungen, die noch fehlen

- Eine sicher betriebene, nutzerautorisierte HTTPS-Vermittlung mit geheimer serverseitiger Konfiguration (auf GitHub Pages **nicht** vorhanden).
- Ein für UNITY eingerichtetes pCloud-OAuth-Anwendungsprofil einschließlich Client-ID, Callback und Autorisierung durch den Kontoinhaber.
- Integrations- und echte iPhone-/pCloud-Dateitests: Auth abgebrochen, falscher Ordner, 403, 429, Speicher voll, Netzabbruch, identischer Upload, Cloud-Konflikt, erneute Anmeldung, Wiederherstellung ohne Datenverlust.

Bis dahin bleibt der **bekannt funktionsfähige manuelle iPhone-Share-Sheet-Weg** erhalten; kein UI darf behaupten, die automatische Speicherung laufe schon.

## Originaldokumentation

- pCloud OAuth: https://docs.pcloud.com/methods/oauth_2.0/authorize.html
- pCloud `uploadfile`: https://docs.pcloud.com/methods/file/uploadfile.html
- pCloud `listfolder`: https://docs.pcloud.com/methods/folder/listfolder.html
