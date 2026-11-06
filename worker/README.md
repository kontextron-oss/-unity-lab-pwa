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

## Neu: privater lokaler PC-Testprozess – dauerhafte Protokolldatei (0.15.3.1)

**Der Testprozess funktioniert ausschließlich mit synthetischen Beispieldaten.** Er ist ein technischer Meilenstein für die spätere PC-Version und den privaten Hintergrundrunner, **noch keine Verbindung** zum realen iPhone-Testdepot. Die PWA-Version bleibt 0.15.2.

`worker/local-runner.cjs` kann auf einem PC mit Node.js 22+ betrieben werden. Er speichert einen synthetischen Testdepotstand in einem **privaten lokalen Verzeichnis außerhalb des öffentlichen GitHub-Repositorys**, zunächst deaktiviert. Durch das Starten eines separaten Prozesses, einen Neustart oder wiederholte Kursprüfungen gehen frühere Testereignisse nicht verloren und dieselbe Demobuchung wird nicht erneut angelegt. Die Daten sind lokal **nicht verschlüsselt**; daher niemals echte Depot- oder Zugangsdaten in diese Demo übernehmen.

**Beispielbefehle für eine spätere lokale PC-Testumgebung:**

```bash
node worker/local-runner.cjs init --date 2026-11-03
node worker/local-runner.cjs status
node worker/local-runner.cjs resume
node worker/local-runner.cjs tick --date 2026-11-05
node worker/local-runner.cjs tick --date 2026-11-06
node worker/local-runner.cjs status
node worker/local-runner.cjs pause
```

Das Datumsargument beim Anlegen dient **nur der reproduzierbaren synthetischen Simulation** (es ist kein reales Orderdatum). Ohne `--date` wird der heutige Tag als Demonstrationsaktivierung verwendet.

Das Standardverzeichnis ist `~/UNITY-LAB-PRIVATE-WORKER/`; mit `--dir <absoluter Pfad>` kann ein anderer privater Speicherort gewählt werden, solange er **außerhalb** des Repos liegt. `serve --interval-seconds 3600` wiederholt die synthetische Prüfung, **solange der PC-Prozess tatsächlich läuft**. Es handelt sich ausdrücklich um keine Installation eines Startdienstes: Bei ausgeschaltetem PC bleibt die Demo stehen.

**Sicherungs- und Ausführungsregeln des lokalen Prototyps:**

- Eine exklusive lokale Schreibsperre verhindert konkurrierende Prozesse. Ein nachweislich verwaister Lock kann nach Ablauf zurückgesetzt werden.
- Status, auslösender Kurs, modellierte Fills und Ereignisse befinden sich **in einem zusammengehörigen versionierten JSON-Checkpoint**, der über eine temporäre Datei und Dateisystem-Rename geschrieben wird. Der vorherige Prüfstand wird separat als `state.previous.json` erhalten.
- Ein SHA-256-Inhaltsprüfwert erkennt beschädigte oder veränderte Checkpoints. Bei Inkonsistenz erfolgt **keine automatische Rücksetzung auf einen alten Stand**, sondern ein erklärter Abbruch zur manuellen Prüfung.
- `pause`, `resume` und `status` sind bereits als CLI verfügbar, aber **noch nicht in der iPhone-App**.
- Der neue systemübergreifende Test `tests/worker-local.cjs` prüft mehrfache PC-Prozessstarts, einmaligen simulierten Kauf, Pausieren, Schreibsperre, Wiederanlauf nach Lock-Abbruch und Reaktion auf beschädigte Daten.

**Nicht verwechseln:** Die bereits vorhandene manuelle pCloud-Sicherung vom iPhone transportiert lokale Backup-Dateien. Dieser neue Demo-Runner greift nicht auf diese Sicherungen zu und kann **keine** Nutzerdaten von pCloud herunterladen oder zurückschreiben. Vor späterem automatischem Abgleich brauchen wir getrennte private Authentifizierung, einen einzigen autoritativen Auftrags-Schreiber, Abgleich-/Konfliktregeln und Testmigration des bisherigen iPhone-Depots.

## Neu: UNITY 0.15.3.2 – manuelles iPhone/PC-Austauschformat (nur Prüfung)

**Jetzt tatsächlich in der iPhone-PWA integriert:** Im Tab **Datensicherung**, Abschnitt **03 · Austausch für PC / Hintergrundprozess**, kann das iPhone eine getrennte Austauschdatei vorbereiten und anschließend über die **iOS-Dateifreigabe** bewusst in den privaten pCloud-Ordner `UNITY-LAB/03-AUSTAUSCH/` teilen. Eine vorhandene Austauschdatei lässt sich auf dem iPhone vor der Übernahme in irgendein anderes System auf SHA-256- und Schema-Konsistenz prüfen. Bei widersprüchlichen gleichen IDs werden Konfliktzahlen angezeigt, aber **niemals Daten überschrieben oder Testaufträge verbucht**.

Die Austauschdatei enthält **nur** alle noch aktiven automatischen Aktien-Testaufträge, die dazu gehörenden Aktienkennungen, bereits abgeschlossene automatische Testbuchungen und das EUR-Gesamtbudget. Nicht enthalten sind sämtliche Unternehmensanalysen, generelle Depotdaten, Zugangsschlüssel oder automatisch generierte Brokerorderaufträge. Das Format ist `unity-exchange-readonly` / Schema 1, mit `authority:local-iphone`, `purpose:review-only` und `executionPermission:false`. Die iPhone-App speichert die Gerätekennung und Exportrevision als lokale Export-Metadaten; sie ändert keine vorhandenen Depotpositionen.

**Später am PC, mit lokal heruntergeladener Datei:**

```bash
node worker/inspect-exchange.cjs /pfad/zur/UNITY-AUSTAUSCH-NUR-PRUEFUNG_....json
node worker/inspect-exchange.cjs /pfad/zu/stand-A.json /pfad/zu/stand-B.json
```

Der erste Befehl validiert Format, Prüfsumme, Summen und Revision, der zweite meldet bei gleichen IDs gleiche, abweichende und nur in einer Version vorhandene Einträge. Der Befehl speichert die eingelesenen persönlichen Daten **nicht** in den Worker oder in das GitHub-Repository und erteilt keine Orderfreigabe. Ein korrupter oder unzulässiger Datensatz wird abgelehnt.

**Datenschutz:** Die ausgetauschte JSON-Datei ist **nicht verschlüsselt**. Sie enthält persönliche simulierte Aufträge und gehört ausschließlich in das private pCloud-Konto oder andere geschützte Speichermedien. Der einfache SHA-256-Prüfwert erkennt versehentliche/unerkannte Änderungen und Konsistenzfehler, stellt aber **keine** kryptographische Herkunfts-/Authentizitätsgarantie gegen jemanden dar, der die Prüfsumme selbst neu berechnen kann. Für späteren automatischen Datentransport müssen private Authentifizierung, Integritätsschutz über authentifizierte Kanäle, Berechtigungen, konfliktfreie Migration und **eine** autoritative Order-Ausführungsinstanz hinzukommen.

**Die vorhandene manuelle BASIS-/ÄNDERUNGSSICHERUNG nach pCloud bleibt unabhängig bestehen.** Die Austauschdatei ist kein Ersatz für ein vollständiges Backup. Der eigenständige Node-Worker handelt auch nach diesem Entwicklungsschritt weiterhin **nur synthetische Daten**; seine persönliche iPhone-Verbindung und automatische pCloud-Synchronisierung sind ausdrücklich noch **nicht** eingerichtet.

## Bereits nutzbar: manuelle pCloud-Sicherung vom iPhone

**Der UNITY-iPhone-Backupworkflow ist bereits in der PWA vorhanden.** UNITY erstellt eine BASIS- oder inkrementelle ÄNDERUNG-Datei und reicht diese über die iOS-Dateifreigabe an pCloud weiter. Dort wählt der Nutzer den Zielordner selbst aus, kontrolliert die tatsächliche Ablage und bestätigt anschließend die Sicherung in UNITY. Das ist **funktionierender manueller Datentransport**, nicht automatischer Synchronisationsbetrieb. Er bleibt als sichere Rückfallebene erhalten.

Wichtig: `pcloud-direct.js` enthält zwar einen technisch vorgesehenen direkten pCloud-Gatewayclient, aber `UNITY_PCLOUD_GATEWAY` ist derzeit absichtlich leer/deaktiviert. Es wäre falsch, aus dem bestehenden manuellen pCloud-Backup auf bereits bestehende serverseitige OAuth-Synchronisierung oder einen vom Worker nutzbaren Depotzugang zu schließen.

## Verbindliche spätere Zielarchitektur: PC + iPhone + pCloud

| Schicht | iPhone (PWA) | PC-Version (später) | Privater Runner (später) |
|---|---|---|---|
| Bedienung | Kompakt, manuelle Auswahl/Änderung | Recherche, Detailansichten, Archiv/Export | Keine öffentliche Verwaltungsoberfläche |
| Analyse | Gemeinsamer versionierter Entscheidungskern | Derselbe Kern/Regelstand | Derselbe Kern mit prüfbaren EOD-Referenzen |
| Private Daten | IndexedDB, offline nutzbar | Lokale DB mit Export/Import | Eigenes geschütztes persistentes Protokoll |
| Sicherung/Sync | **Bereits manuelles Backup über iOS-Dateifreigabe nach pCloud**, automatische Synchronisation später | Später pCloud Drive Sync als Option | Später über abgesicherte private Schnittstelle, keine direkten öffentlichen Zugangsdaten |
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
