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

## Zielkorrektur: automatische Synchronisation, bestehende WERK-ARCHIV-pCloud-Integration nutzen

Verbindliches Ziel ist **keine dauerhafte manuelle Dateiübertragung**. Die neu eingebauten Funktionen in \`sync-ui.js\` sind ausdrücklich ein isolierter Pilot, um Authentizität, Konfliktverhalten, reversible Importe und Verschlüsselung vor dem eigentlichen Cloudbetrieb zu testen. Sie dürfen nicht als endgültige Bedienlösung vorgestellt werden.

Das **WERK-ARCHIV** hat eine eigenständige pCloud-App-/OAuth-Einrichtung, und die PC-Version wurde in der bisherigen Entwicklung ebenfalls darauf ausgerichtet. Zu unterscheiden sind:
1. Die **pCloud App Key / Client ID** ist eine App-Registrierung und kein persönlicher Zugriffstoken. Es kann sinnvoll sein, dieselbe Registrierung bzw. die bewährte OAuth-Codeflow-Komponente für UNITY zu verwenden, soweit Redirect-URIs und Sicherheitsgrenzen das gestatten.
2. **Ein Benutzerzugriff/Access-Token ist ursprungs- und authentifizierungsbezogen**. Es wird weder aus WERK-ARCHIV exportiert, noch in das öffentliche UNITY-HTML, GitHub, Screenshots oder unverschlüsselte Backup-Dateien kopiert. Falls die bestehende Backend-/OAuth-Verbindung für UNITY nicht berechtigt ist, muss die Berechtigung im regulären pCloud-Dialog für UNITY erteilt werden.
3. **Zwei getrennte Datenräume** im selben pCloud-Konto: WERK-ARCHIV behält seine vorhandene Datenstruktur; UNITY erhält private, versionierte Synchronisationsdateien in einem gesonderten Verzeichnis. Es erfolgt keine Wiederverwendung fremder fileids/folderids; bestehende Backups bleiben unangetastet.
4. Offizielle pCloud-Dokumentation: OAuth 2.0 ([authorize](https://docs.pcloud.com/methods/oauth_2.0/authorize.html)), API-Host nach Kontoregion ([pCloud Developers](https://docs.pcloud.com/)); in Europa \`eapi.pcloud.com\`, in den USA \`api.pcloud.com\`. Der Client-Secret bleibt auf einem geschützten Server/Backend, sofern ein Code-Flow eingesetzt wird.
5. Ein bestehender WERK-ARCHIV-Login bedeutet **nicht automatisch**, dass UNITY bereits über eine authentifizierte Verbindung verfügt. Die konkrete vorhandene Verbindung muss vor einer Aktivierung technisch überprüft werden, ohne geheime Daten in GitHub abzulegen.

### Verhalten der späteren Automatik

- Bei **Appstart**, nach Rückkehr aus dem Offline-Modus sowie während aktiver Nutzung bei Änderungen: Synchronisationsbedarf erkennen und, sofern das Gerät zuvor sicher freigegeben ist, automatisch private pCloud-Manifeste lesen.
- Bei **gleichem Datensatz und bestätigter Revision**: nichts tun. Bei **eindeutig neuem, plausibel validiertem Datensatz**: kontrolliert übernehmen. Bei **Konflikten, unklarer Löschung oder paralleler Bearbeitung**: vollständige Auto-Übernahme stoppen und ein übersichtliches Entscheidungsfeld anbieten. Keine „neuester Zeitstempel gewinnt“-Logik.
- Vor Upload: **lokale Transaktion und Verschlüsselung**, bestätigte Geräte-/Benutzerberechtigung, ein unveränderliches, content-adressiertes Änderungspaket mit `renameifexists=1` und `nopartial=1`, erneute Datei- und SHA-256-Prüfung sowie Upload-Quittung (pCloud selbst garantiert dabei kein CAS). Erst nach tatsächlicher Remote-Bestätigung einen lokalen Checkpoint fortschreiben. Bei Netzfehlern: nicht den Datenstand als synchronisiert markieren, spätere Wiederholung ohne Dubletten.
- iPhone-PWA: Synchronisation grundsätzlich bei aktiver/erneut geöffneter App; **nicht als zuverlässig rund um die Uhr laufender Hintergrundprozess behaupten**. Safari/iOS unterstützt die gängigen Background-Sync-APIs nicht durchgängig; die PC-Version kann je nach gewählter Technik kontinuierlicher arbeiten.
- Die **bestehende manuelle Vollsicherung in pCloud** bleibt als unabhängige Rückfallebene erhalten, auch wenn der spätere Sync automatisch wird.

### Neu im Entwicklungszweig

- \`sync-transfer.js\`: verifizierte, auf **Aktien-Stammdaten und Analysen** begrenzte Änderungs-Pilotpakete. Strenge Vorversion, Hash-/ID-Verifizierung, Konfliktvorschau.
- \`sync-crypto.js\`: eigene Passwortverschlüsselung **AES-256-GCM + PBKDF2-SHA256** für den bewusst ausgelösten Test-Dateiaustausch.
- \`sync-ui.js\`: aufklappbarer RC1-Testbereich „Datensicherung → 04 · Verschlüsselter Änderungsabgleich“ mit pCloud-Share-Dialog und nur manuell freigegebenem **Add-only-Import**. Keine automatischen Änderungen an bestehenden Datensätzen.
- \`sync-policy.js\`: **rein deklarative**, inaktiver Prüf- und Ablaufkern für den späteren Automatikbetrieb. Die Freigabe erfordert: pCloud-OAuth und Konto, autorisiertes Gerät, verfügbare Verschlüsselung, frische Remote-Revision, nachgewiesene Datenintegrität, konfliktfreien Plan und Schutz gegen gleichzeitiges Schreiben. Er enthält **keine** echte pCloud-Verbindung oder automatischen Ausführungen.

**Vollständige Synchronisation aller neun Datenbereiche ist noch nicht implementiert.** Die Erweiterung muss insbesondere Konto-/Budgetdaten, Kauforders, Simulationsbuchungen, große Kursdatenreihen und später das PC-Datenmodell separat und nicht-destruktiv behandeln. Eine Finanz- oder Brokerorder darf nie aus einem Cloud-Import ausgelöst werden.

## Reuse-Check gegen den tatsächlich vorhandenen WERK-ARCHIV-Quellstand

Im privaten GitHub-Repository `kontextron-oss/-werk-archiv-privat` sind folgende **bereits implementierte** Komponenten vorhanden (keine Zugangsdaten übernommen):

- `desktop/core/pcloud-api.js`: `createOAuthRequest`, `parseOAuthCallback`, `listFolder`, `downloadFile` und `uploadFile`. Der Code prüft den OAuth-State, EU-/US-API-Host und den Rücksprungpfad. Bei `uploadfile` verwendet er explizit **`renameifexists=1` und `nopartial=1`**.
- `desktop/main.js`: Windows-/Electron-Anbindung mit `safeStorage.encryptString` und `safeStorage.decryptString` für die lokale, verschlüsselte Speicherung der privaten Sitzung. Das ist ein brauchbares **PC-Sicherheitsmuster**, kein Zugriffstoken für UNITY.
- `mobile/public/pcloud-callback.html` und `mobile/public/pcloud-callback.js`: Vorhandener iPhone-OAuth-Rücksprung; er gibt die Autorisierungsantwort nur an das Fenster **derselben Origin** weiter. Der Handler darf nicht einfach unverändert an eine andere UNITY-Website delegieren.
- Diese Referenzen bestätigen **vorhandenen funktionsbezogenen Programmcode**, jedoch nicht, dass die laufende UNITY-PWA bereits authentifiziert oder ein geteilter Server-Gateway vorhanden wäre.

### Gefährliche Standardannahme über pCloud korrigiert

Die offizielle pCloud-Methode [uploadfile](https://docs.pcloud.com/methods/file/uploadfile.html) überschreibt gleichnamige Dateien **standardmäßig** und führt die frühere Datei lediglich als Revision weiter. Ein für unsere Zwecke geeignetes atomar bedingtes Überschreiben (Compare-and-Swap) ist in dieser Methode **nicht dokumentiert**. Bei `renameifexists=1` wird ein Konflikt stattdessen umbenannt. Daher:

1. **Kein ständig überschriebenes `latest.json`** und kein gemeinsamer Cloud-Datenbankdateipfad.
2. Ausschließlich neue, unveränderliche, eindeutig hash-benannte AES-256-GCM-Pakete in `UNITY-LAB/03-AUSTAUSCH/immutable-v1`; der WERK-ARCHIV-Bereich bleibt eigenständig.
3. `sync-pcloud-log.js` erzeugt einen Dateinamen aus Geräte-ID, Revision und **SHA-256 des verschlüsselten Inhalts**. Der übergebene, bereits authentifizierte Anbieteradapter muss `renameifexists=1` und `nopartial=1` erzwingen. Eine unerwartete Umbenennung ist ein **Fehler**, kein bestätigter Upload.
4. Erst **erneute Ordnerprüfung und Download derselben Datei plus Vergleich der echten SHA-256-Prüfsumme** erlaubt einen lokalen Checkpoint. pCloud liefert eigene Dateimetadaten-Hashes, die **nicht** als SHA-256 interpretiert werden dürfen. Wiederholte Übertragungen derselben Datei werden nur nach Byteprüfung als bereits vorhanden akzeptiert.
5. Später gleichzeitig eintreffende Dateien von iPhone und PC müssen **beide** erhalten bleiben. Beim Einlesen werden Unterschiede anhand der gemeinsamen Revision geprüft; Konflikte lösen niemals eine automatische Löschung oder stille Überschreibung aus.

Wichtiger iPhone-Unterschied: Die offiziellen pCloud-Methoden [getfilelink](https://docs.pcloud.com/methods/streaming/getfilelink.html) und [gettextfile](https://docs.pcloud.com/methods/streaming/gettextfile.html) sind laut Dokumentation nicht für gewöhnliche Webanwendungen freigegeben. Die vorhandene Windows-Version kann ihren API-Zugriff im geschützten Electron-Prozess erledigen. Für die iPhone-PWA müssen wir den **tatsächlich nutzbaren, autorisierten Lese- und Schreibweg** aus WERK-ARCHIV verifizieren, statt die Desktop-Implementierung blind zu kopieren.

### Verbindlicher Stand

`sync-pcloud-log.js` und `sync-policy.js` definieren nun das sichere Append-only-Prinzip. `tests/sync-pcloud-log.cjs` prüft Offline-/Freigabesperren, Kollisionen, idempotente Wiederholungen, Cloud-Quittungen, Hash-/Byte-Nachkontrolle und die Isolation der pCloud-Ordner. **Der produktive pCloud-OAuth-Adapter ist noch nicht mit UNITY verbunden.** Die bisherige manuelle Sicherung und alle veröffentlichten Versionen bleiben unverändert. Die zusätzliche Vercel-Anbindung wurde entfernt; nur GitHub und pCloud werden genutzt.
