# UNITY – eigenständige Hintergrundlaufzeit (0.15.3, Grundgerüst)

**Aktueller Entwicklungsstatus: öffentlicher, vollständig synthetischer Test – kein privates Depot angeschlossen.** Die iPhone-PWA bleibt zunächst auf **0.15.2**. Dieser Ordner ist keine freigegebene autonome Handelsfunktion.

## Warum eine separate Laufzeit?

iOS-Safari kann nicht garantieren, dass die lokale PWA täglich weiterläuft, wenn sie geschlossen ist. Ein zuverlässiger automatischer Testkäufer benötigt einen dauerhaft erreichbaren, **privaten** Runner oder einen eingeschalteten PC. GitHub Actions eignet sich für öffentliche Datenupdates und synthetische Funktionskontrollen, aber nicht als Ablage privater Testdepotstände in einem öffentlichen Repository.

## Aktuell implementiert

- **Portabler Node.js-Entscheidungskern:** `worker/core.cjs` nutzt weder DOM noch Safari, pCloud oder öffentliche Benutzerkonten. Die Teststrategie ist ausschließlich `technical-demo`. Kryptowährungen bleiben bewusst ausgeschlossen, bis ein eigener validierter 24/7-Krypto-Entscheidungskern existiert.
- **Verweigerungsregeln:** Keine Modellbuchung ohne ausdrückliches `sandboxApproved`, gültige unverwechselbare ISIN/Währung/Börse, 200+ Kursbeobachtungen, plausible Zeitstempel, gültige ECB-Währungsumrechnung oder bei nahen bekannten Earnings. Fehlende Daten erzeugen *blockiert*, keine geschätzten Kaufkurse.
- **Zweistufige simulierte Auftragserfassung:** Zuerst ein Signal mit EOD-Referenzdatum, erst nach einem späteren tatsächlich vorliegenden Kursdatensatz ein Modell-Fill mit Spread/Slippage/Gebühr. Identischer Auftrag erzeugt per deterministischem Schlüssel keine zusätzliche Buchung.
- **Manueller Stop als Datenflag:** `enabled:false` unterbindet Testausführungen. Es gibt **noch keine private nutzbare Bedienverbindung** zwischen iPhone und Worker.
- **Strikt synthetische Daten:** `worker/demo-fixture.cjs` enthält eine ausgedachte Testaktie; `worker/run-demo.cjs` führt zwei künstliche EOD-Zeitschritte und einen Wiederholungsversuch aus. GitHub Actions `.github/workflows/unity-worker-demo.yml` führt diesen reinen Liveness-Check zeitgesteuert bzw. manuell aus. Geplante Actions-Läufe sind **Best Effort**, keine Echtzeitgarantie. Es gibt bislang keine Zustandsfortschreibung über separate GitHub-Actions-Ausführungen hinweg.
- **CI:** `node tests/worker-demo.cjs`; keinerlei private Zugangsdaten oder Echtgeldbuchungen.

Ausführung des rein synthetischen Tests mit installiertem Node.js 22+:

```bash
node tests/worker-demo.cjs
node worker/run-demo.cjs
```

`--write-status` erstellt ausschließlich eine lokale synthetische JSON-Datei zur Upload-Prüfung. Das Ergebnis darf öffentlich sein und enthält **keine** persönlichen Positionen.

## Verbindliche spätere Zielarchitektur: PC + iPhone + pCloud

| Schicht | iPhone (PWA) | PC-Version (später) | Privater Runner (später) |
|---|---|---|---|
| Bedienung | Kompakt, manuelle Auswahl/Änderung | Recherche, Detailansichten, Archiv/Export | Keine öffentliche Verwaltungsoberfläche |
| Analyse | Gemeinsamer versionierter Entscheidungskern | Derselbe Kern/Regelstand | Derselbe Kern mit prüfbaren EOD-Referenzen |
| Private Daten | IndexedDB, offline nutzbar | Lokale DB mit Export/Import | Eigenes geschütztes persistentes Protokoll |
| Synchronisation | Später private pCloud OAuth-API | Später pCloud Drive Sync als Option | Später über abgesicherte private Schnittstelle |
| Aufträge | Aktivieren, Pausieren, Status sehen | Dieselben Freigaben und Konfliktansicht | **Genau ein autoritativer Schreiber** pro Ordergeneration |
| Risiko | Kein stilles Überschreiben | Nicht-destruktive Migration/Backup | Serverseitige Atomicity, idempotente Schlüssel und Audit |

Ein Datum bzw. ein letzter EOD-Kurs allein beweist keine ausführbare Preisstellung. Jeder simulierte Fill bleibt **ausdrücklich ein Modell**.

### Geplante Synchronisationsregeln

1. Eine Datei/Entscheidung erhält stabile `id`, `schemaVersion`, `revision`, `updatedAt`, `originDevice` und nach Möglichkeit Inhalts-Hash.
2. pCloud transportiert private verschlüsselte oder gegen unberechtigten Zugriff geschützte Daten **nur nach ausdrücklicher Nutzereinrichtung**. Kein pCloud-Token in GitHub, HTML-Quellcode, Actions-Artifacts oder öffentlichen Logs.
3. Datenkonflikte werden sichtbar, nicht über `updatedAt` still überschrieben. Jedes Gerät und jeder Runner muss ihre Rolle vor einem schreibenden Abgleich feststellen.
4. Bei einer aktivierten Hintergrundautomatik besitzt der private Runner die **alleinige Transaktionshoheit**. iPhone-/PC-Clients schicken nur Änderungswünsche und zeigen bestätigte Auftragsstände; sie dürfen nicht parallel eigene Fills buchen. Beim Offline-Betrieb können Beobachtungen fortgesetzt werden, aber keine als bestätigt markierten konkurrierenden Ausführungen entstehen.
5. Alle Änderungen werden versioniert, mit lokalen Backups, Import-Validierung und getesteter Rückfallmöglichkeit.

## Noch nicht umgesetzt und keine Freigabe zur Nutzung mit persönlichen Daten

- Sicherer privater Host oder ständig eingeschalteter PC, persistenter Server-State und Datenbank;
- echte Authentifizierung / Zugriffskontrolle, Verschlüsselung, sichere konfigurierbare Logs;
- zuverlässige tägliche Dateneingänge mit Quellen- und Eventprüfung aller Titel;
- private bidirektionale iPhone/PC/pCloud-Synchronisation einschließlich Konfliktlösung;
- sichtbarer Live-Status/Pause/Resumption in der iPhone-App und **mehrtägiger** realer Durchlauftest;
- eigenständige **Krypto-Regelstrategie** für BTC/ETH mit Markt-, Netzwerk-, Token- und Risikodaten.

Erst nach diesen Punkten kann Schritt 4 als erfolgreich betriebene persönliche Hintergrundsimulation bezeichnet werden. Das öffentliche synthetische Beispiel beweist ausschließlich die technische Ausführbarkeit einer plattformneutralen Komponente.
