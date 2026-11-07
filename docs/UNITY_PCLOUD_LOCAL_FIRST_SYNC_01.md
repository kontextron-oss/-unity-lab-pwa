# UNITY – Local-First-Synchronisation mit pCloud (Spezifikation 0.1)

Stand 07.11.2026 · **Entwicklungsplanung, keine aktivierte Cloud-Synchronisation.**

## Architekturentscheidung

UNITY läuft auf dem iPhone unverändert mit der lokalen **IndexedDB `unity-lab`, Schema 3**. Eine spätere PC-Version darf eine eigene lokale Datenbank nutzen. **pCloud ist ein privater Datei- und Versionsspeicher, kein laufender SQL-/IndexedDB-Datenbankserver.**

```text
UNITY iPhone / lokale IndexedDB          UNITY PC / lokale Datenbank
              \                                 /
               \      nur geprüfte Änderungen /
                --> private pCloud-Dateien <--
                     + Konflikterkennung
                     + Versionshistorie
                     + separate Backups
```

Die schon etablierte manuelle pCloud-Sicherung (Vollbackup und inkrementelle Sicherung) bleibt bis zur vollständigen Prüfung erhalten und wird **nicht durch einen automatischen Sync ersetzt**.

### Perspektivische private Dateistruktur (noch nicht angelegt)

```text
/UNITY-LAB/
  02-VOLLSICHERUNG/             # bestehende Backup-Rückfallebene nicht verändern
  03-SYNC/
    v1/
      devices/
        <device-uuid>/
          manifests/
          changes/
      conflicts/
      checkpoints/
```

**Wichtig:** Dies ist eine geplante Ordnerstruktur, kein behaupteter bestehender pCloud-Pfad. Die tatsächlichen Ordner- und Zugriffsregeln werden vor Inbetriebnahme mit dem existierenden Nutzerbestand abgestimmt. **Kein öffentliches GitHub-Repository darf Daten aus `03-SYNC` aufnehmen.**

## Neues, bewusst read-only implementiertes Protokoll

Datei: `sync-plan.js` (Node + Browser, bisher nicht in der veröffentlichten PWA eingebunden).

- Der Datenaustausch startet mit vollständigen, nach Datensatz-ID geordneten **SHA-256-Inhaltsmanifesten** für die neun vorhandenen Object Stores: `instruments`, `quotes`, `transactions`, `strategies`, `audit`, `fundamentals`, `histories`, `analyses`, `settings`.
- Für jedes Gerät `deviceId` (UUID), monotoner `sequence` und `parentHash` als Revisionsträger; `createdAt` dient nur der Dokumentation, **nicht** als Kriterium „neuer gewinnt“.
- **Nur Hashes, keine Originalwerte** im Manifest. Die lokal erzeugten Hashes zeigen identische, abweichende und fehlende Einträge, ohne die privaten Depotinformationen in die Quelle oder ein GitHub-Testartefakt zu schreiben. Das Programm ist ein Parser/Rechenkern, enthält keine echte pCloud-Anbindung.
- Bestimmte gerätespezifische `settings`-Einträge (Sicherungs-Checkpoint, Austausch-Export-Metadaten) bleiben ausgeschlossen. Für spätere Nutzersynchronisation müssen sämtliche Einstellungskategorien auf Geheimnisse und Gerätespezifik geprüft werden. Die künftige Übertragung echter Änderungsdaten verlangt **separat verschlüsselte Dateien**, abgestimmte Geräte-Autorisierung und eine Freigabe.
- `plan(local,remote,sha256Fn,optionalCommonBase)` validiert beide Manifeste und liefert einen **Konfliktplan ohne Schreibvorgang**:
  - `same`: identisch;
  - `localOnly`/`remoteOnly`: bisher nur auf einer Seite vorhandene IDs;
  - `localChanged`/`remoteChanged`: mit einem gemeinsamen geprüften Basisstand einseitig bearbeitet;
  - `conflict`: gleicher Schlüssel, unterschiedlicher Inhalt oder gleichzeitig konkurrierend verändert;
  - `deleteReview`: gegenüber gemeinsamem Basisstand verschwundener Eintrag – **niemals still löschen**.
- Der Vergleich nimmt **keine tatsächliche Datenänderung vor**, selbst wenn nur eine Seite ergänzt wurde: `canWrite:false`, `canDelete:false`, `eligibleForAutomaticMerge:false`, `tradeApproved:false`.
- Jedes Manifest hat eine eigene SHA-256-Prüfsumme. Diese erkennt einfache Veränderungen, ist aber **weder Verschlüsselung noch ein Echtheitsnachweis**: pCloud-Zugriffsberechtigungen, Endgeräteidentität und authentifizierte verschlüsselte Dateien müssen gesondert geprüft werden.
- Für Inhalte gilt weiter der bestehende, nicht-destruktive Wiederherstellungspfad in `incremental.js`, inklusive der manuellen Bestätigung und harten Konfliktsperre. Es gibt **keine stillschweigende Wiederherstellung**.

## Umsetzung in Stufen

1. **Jetzt:** Manifest-Erzeugung, strikte Validierung und deterministischer Konfliktplan in GitHub-Entwicklungszweig. Synthetische Regressionen: geräteübergreifende Vergleiche, doppelte IDs, geänderte/fehlende Inhalte, unerlaubte Orders, ungültige Revisionen und manipulierte Hashes. Keine persönlichen Daten übertragen.
2. **Danach:** Gemeinsamer Basisstand und echte Revisionsketten auf iPhone und PC einschließlich datierter Konfliktentscheidungen; getrennte Quarantäne für unsichere und ältere Daten. Löschen nur mit zusätzlicher Nutzerfreigabe; keine Last-Writer-Wins-Logik.
3. **Später:** Verschlüsselte Änderungspakete und nur bestätigte API-/manuelle pCloud-Übertragung mit Upload-Quittung, Checkpoint und Wiederholungsfestigkeit. Der bestehende direkte Client in `pcloud-direct.js` **ist mangels sicherem OAuth-Gateway deaktiviert**; manuelle pCloud-Sicherung bleibt der funktionierende Weg.
4. **Nach PC-Prototyp:** Austausch und Konfliktprüfungen zwischen PC-Datenbank und iPhone-Datenspeicher anhand einer kleinen Testauswahl, danach erst Vollarchiv. Gleichzeitige Bearbeitung muss reproduzierbar sicher abgefangen werden.

**Nicht behaupten:** „pCloud ist nun die Datenbank“, „Synchronisation läuft automatisch“, „iPhone und PC sind bereits synchron“, „Ende-zu-Ende-Verschlüsselung aktiviert“ oder „Konflikte automatisch gelöst“. Das ist noch nicht implementiert und wäre ohne Tests riskant.

Das Projekt benötigt **keinen zusätzlichen Host/Cloudanbieter**. Die sichere Synchronisation ist eine zusätzliche Schicht über der bereits vorhandenen UNITY- und pCloud-Infrastruktur.
