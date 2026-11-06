# UNITY LAB – Verbindlicher Arbeitsplan: von 0.14.2 zur autonomen Testsimulation
Stand: **06.11.2026** · Ausgangsbasis **UNITY LAB 0.14.2**, Branch `main`.

## 1. Ziel und Abgrenzung
UNITY soll auf nachvollziehbaren, zeitgestempelten Kurs-, Unternehmens- und Ereignisdaten **eigenständig Entscheidungen** (`KAUFEN`, `HALTEN`, `VERKAUFEN`, `BLOCKIERT`) treffen, bei einer freigegebenen Strategie **fiktive** Aufträge zuverlässig ausführen, Kapitalbedarf/Bestände dokumentieren und die Entscheidungen gegen feste Benchmarks nachprüfen. Nutzer kann automatische Simulation ein-/ausschalten, einzelne Aufträge stoppen und Budget/Positionsgrenzen bestimmen.

**Nicht vorgesehen:** Echtgeldhandel, Broker-Zugriff, Geheimnisse im öffentlichen Repository, automatischer Live-Orderversand oder das Versprechen, exakt am Kursminimum bzw. Kursmaximum zu handeln. Auch die KI darf keine alleinige Handelsfreigabe erteilen.

## 2. Kritischer Stand vor Beginn
- Die qualitative Gesamtbewertung der gegenwärtig nutzbaren App beträgt **5,5/10**; Modell-/Konzeptpotenzial **8,5/10**; als **nachgewiesener autonomer Trading-Autopilot ca. 3/10**. Dies sind Projektbewertungen, keine nachgewiesenen Renditezahlen.
- **Funktioniert:** lokale PWA, Watchlist und Analysen, modelliertes Depot, technische/strenge automatisierte Testaufträge beim App-Öffnen bzw. Aktualisieren, einstellbare Einsatzquoten ab 2 %, Storno und Kennzeichnung, vorläufige Portfoliobewertung.
- **Nicht belegt:** unabhängiger 24/7-Runner, vollwertige Datenversorgung für jede Aktie, unveränderliche historische `as-of`-Datenbasis, realistische simulierte Ausführung, umfassendes Backtesting, nachweisbare fortlaufende Verbesserung.
- **Konkrete Datenlücke** aus `data/fundamentals.json` vom 05.11.2026: Schneider Electric hat fünf strukturierte Pilotenkennzahlen; ABB, Siemens Energy und Infineon stehen `issuer-release-only` ohne vollständige strukturierte `metrics`. Die Ereignisdatei deckt neun Emittenten ab. Dies ist **keine negative Aktienbewertung**.
- Bereits per GitHub Actions zeitgesteuert: Markt-Snapshots, Fundamentaldaten-Pilot, FX, Research, Emittentenkalender. **Zeitgesteuerter Datenabruf ≠ autonomer privater Depot-Entscheider.**
- Vorliegende Grundlagen: [Kritische Analyse](UNITY_AUTOMATION_KRITISCHE_BEWERTUNG_2026-11-06.md), [0.14.2-Übergabe](UNITY_LAB_STAND_2026-11-06.md), bereits offener [Datenqualitäts-Issue #21](https://github.com/kontextron-oss/-unity-lab-pwa/issues/21).

## 3. Feste Umsetzungskriterien für JEDEN Schritt
1. Eine Aufgabe vollständig abschließen, **dann** die nächste. Höchstens ein funktionaler Schwerpunkt pro PR, keine gleichzeitigen großen UI-Umbauten.
2. Immer vom neuesten `main` arbeiten, kurzer Feature-Branch, automatisierte Tests, PR-Review, erst dann Merge. GitHub Pages muss erfolgreich veröffentlichen.
3. Lokale Nutzerdaten/Transaktionen bleiben erhalten; keine stille Migration, Löschung oder Änderung. 0.14.2 bleibt anfangs Rückfallreferenz, bestehende Datenmodelle rückwärtskompatibel.
4. `BLOCKIERT: Daten fehlen` ist etwas anderes als `NEIN: schlechtes Signal`. Harte Risikovetos niemals durch einen hohen Gesamtscore oder eine KI-Antwort aushebeln.
5. Kein Kurs ohne Börsenplatz, Währung, Quelle und Zeitstempel. Alte oder experimentelle Preise werden nie als aktuelle ausführbare Kurse ausgegeben.
6. Jeder Funktionsschritt endet mit definiertem Testbeleg, dokumentiertem neuen Versionsstand und klarem „abgenommen/offen“. Keine fiktiven Erfolge als echte Käufe oder als nachgewiesene Performance deklarieren.

## 4. Reihenfolge der Arbeitspakete

### [ ] Schritt 1 — 0.15.0: Daten- und Freigabe-Diagnose (JETZT STARTEN)
**Problem:** Unvollständige Unternehmens-, Kurs-/FX- und Earnings-Daten verhindern oft eine strenge Entscheidung, ohne dass die Ursache in der Übersicht klar ersichtlich ist.

**Implementierung:**
- Pro Aktie standardisierter `readiness`-Datensatz: ISIN/Symbol, Börsenplatz, Währung, Kurs-/FX-Stand, mindestens benötigte Historie, Quelle, Bilanzperiode/Quelle, Bewertung, bestätigter nächster Earnings-Termin, Risikoveto.
- Anzeige `datenbereit` / `unvollständig` / `veraltet` / `Konflikt` und **konkrete fehlende Felder**; keine künstliche Score-Abwertung bei fehlenden Feldern, stattdessen geringere Datenkonfidenz.
- Getrennte Zähler: Anzahl Aktien **technisch auswertbar**, **streng freigabefähig**, **wegen Datenmangel blockiert**, **wegen tatsächlicher Signal-/Risikokriterien abgelehnt**.
- Beginnen mit vier konkret prüfbaren europäischen Piloten: ABB, Schneider Electric, Siemens Energy, Infineon; anschließend schrittweise auf vollständige Masterliste ausrollen. Bestandsliste nie still verkürzen.
- Wenn automatische Quelldaten fehlen, Quellen-/Mapping-Problem benennen; nicht bloß Freigabehürden abschalten. Institutionelle Kapitalflüsse sind nachrangig gegenüber Bilanz-/Earnings-Grunddaten.

**Fertig, wenn:** Jede Pilotaktie ihre tatsächlichen fehlenden Felder und Quelle anzeigt; Test simuliert absichtlich fehlenden Kurs, Earnings-/FX-Daten und einen ungünstigen Bewertungsfall, und zeigt jeweils korrekt **Datenmangel ≠ negatives Signal**. Keine Regression der Depotwerte oder Kauf/Verkaufsbuttons.

### [ ] Schritt 2 — 0.15.1: Eine nachvollziehbare Entscheidungs-Engine
**Implementierung:**
- Einheitliches Ausgabeschema je Aktie/Signal: `action`, `dataStatus`, `mode`, `scoreBand`, `confidence`, `veto`, `signalAt`, `priceRef`, `trigger`, `invalidation`, `capitalPct`, `why`.
- Sauber getrennte Modi: `Technische Voranalyse` (nur fiktiver Klein-Testkauf) versus `Strenge UNITY-Anlagefreigabe`; kein technisches Grün als fundamentale Empfehlung verkaufen.
- Einstiegs-/Ausstiegsbedingungen klar, Kapitaleinsatz standardmäßig 2 % und einstellbar; keine neue Position beim bestätigten, unmittelbar bevorstehenden binären Event.
- Von allen berechneten Fällen automatisch eine nachvollziehbare Entscheidung ins Ledger schreiben; kein Wiederverwenden eines alten Signals als neue Freigabe.

**Fertig, wenn:** Mit identischem Daten-Snapshot kommt deterministisch dieselbe Entscheidung heraus, inklusive reproduzierbarer Gründe; harte Vetos bleiben unübersteuerbar. Prüffälle `BUY`, `SELL`, `HOLD`, `BLOCKED` sind bestanden.

### [ ] Schritt 3 — 0.15.2: Zuverlässige Order- und Depotbuchung
**Implementierung:**
- Fiktive Order-State-Machine: `geplant → aktiv → ausgelöst → ausgeführt` oder `gestoppt/abgelaufen/abgewiesen`.
- **Idempotente, atomare** Speicherung von Orderzustand und Transaktion; eindeutige Order-IDs und Ausführungs-IDs. Wiederholter Prozessstart darf keine Doppelbuchung verursachen.
- Simulierter Fill bei **nächster beobachtbarer ausführbarer Gelegenheit**, nicht rückwirkend zum Schlusskurs der schon vergangenen Sitzung; konfigurierbarer Spread, Slippage, Gebühren und FX-Stempel, nicht als echte Marktausführung etikettieren.
- Eintrags-/Kapitallimits, max. eine neue Order je Signal, Kill-Switch, Storno, Teilverkäufe, Plausibilitätsprüfung bei Split/Dividende/Feiertag; Sicherheitsreserve und Kapitalabgleich.

**Fertig, wenn:** Neustart/Fehler zwischen beiden DB-Schreibvorgängen zu **keiner** doppelten oder verlorenen Buchung führt; Buchungssumme = Testkapital + Positionen stimmt nach Kauf, Verkauf und Storno; schlechte/fehlende Kurse lösen keine Ausführung aus.

### Verbindliche Zielarchitektur – iPhone, PC und pCloud (06.11.2026)
- **Ein System, zwei Oberflächen:** iPhone-PWA für schnelle Kontrolle und spätere native/portable **PC-Version** für umfangreiche Analysen, Massendaten und Verwaltung; beide verwenden dasselbe versionierte Daten- und Entscheidungsmodell. Die PC-Version ist ausdrücklich für eine spätere Entwicklungsstufe vorgesehen, nicht Voraussetzung für diese Phase.
- **pCloud-Sicherung bereits vorhanden (iPhone, manuell):** Die bestehende UNITY-PWA kann lokale Daten als Voll-/Änderungssicherung vorbereiten und über die **iOS-Dateifreigabe/Teilen-Funktion manuell nach pCloud ablegen**. Dies ist eine bereits nutzbare Sicherungsstrecke, nicht erst ein zukünftiges Vorhaben. Der Zielordner wird derzeit vom Nutzer gewählt, die Ablage kontrolliert und die Sicherung anschließend bestätigt. **Noch nicht vorhanden:** direkte automatische Gateway-/OAuth-Verbindung, bidirektionale pCloud-Synchronisierung, privater Hintergrundrunner-Zugriff auf Depotdaten und spätere PC-Abgleichsschicht. pCloud bleibt ergänzend und keine Voraussetzung für den lokalen Offline-Betrieb; keinerlei private Daten oder Schlüssel ins öffentliche GitHub.
- **Nicht-destruktive, nachvollziehbare Synchronisation:** stabile IDs, Änderungsrevisionen, schemaVersion, Zusammenführungs-/Konfliktregeln, keine stillen Überschreibungen und keine doppelte Testbuchung. Versionierte Backups; Import/Austausch von PC-Dateien später. Die PWA bleibt local-first.
- **Plattformneutraler Kern:** Entscheidungskern, Sicherheitsregeln, Simulation, Simulationstransaktionen und Protokollierung werden von iPhone-, PC- und pCloud-Adaptern getrennt. Datenhoheit und Ausführungshoheit sind klar zuzuordnen, damit ein lokaler Auftrag nicht gleichzeitig von iPhone und PC/Worker ausgeführt wird.
- **Aktuelle Phase:** Die **manuelle iPhone→pCloud-Sicherung ist bereits eingerichtet** (BASIS/ÄNDERUNGEN über die iOS-Freigabe). Der unabhängige Runner hat weiterhin **keinen** Zugriff auf persönliche iPhone-IndexedDB oder pCloud, die direkte pCloud-Gateway-/OAuth-Anbindung ist im Code noch abgeschaltet, automatischer bidirektionaler Abgleich und PC-App fehlen. Nicht als abgeschlossene Synchronisation ausgeben.

### [ ] Schritt 4 — 0.15.3: Autonomer Hintergrundprozess für Testsimulation
**Implementierung:**
- Technische Laufzeitentscheidung dokumentieren: privater kleiner Host/Worker (für zuverlässige Ausführung auch bei ausgeschaltetem PC) versus stets laufender lokaler PC-Prozess; iOS-PWA selbst ist **kein** verlässlicher Hintergrund-Runner.
- Bestehende GitHub-Actions-Pipelines weiter für **öffentliche Quelldaten**, private Strategie- und Depotbuchungen dagegen ausschließlich privat, mit gesicherter Authentifizierung; keine persönlichen Transaktionen im öffentlichen GitHub.
- Geplanter Börsentagslauf, Datenstempel, Idempotenz, Fehler-/Ausfallprotokoll, Wiederanlauf, Prozessstatus `letzter erfolgreicher Lauf`, manueller Sofort-Stopp; iPhone nur Bedienung/Status.
- Erst Testlauf mit **nicht-persönlichem Musterdepot**, danach private Authentifizierung und lokales Depot sicher anbinden. Kein stiller Export privater Bestände.

**Fertig, wenn:** In einem mehrtägigen Test trotz geschlossener iPhone-PWA ein zeitgerechter Probelauf dokumentiert wird und eine simulierte Order genau einmal bucht; Ausfälle und Stopps sind sichtbar. Andernfalls Runner nicht produktiv nennen.

### [ ] Schritt 5 — 0.16: Rückblickende Leistungsprüfung und Vergleich
**Implementierung:**
- Historische Daten **point-in-time** (`was war damals wirklich schon bekannt`) sammeln; inklusive Delistings/Splits und unveränderlicher Quellenstände.
- Backtest mit Zeitstempeln, Spreads, Slippage, FX und Cashbindung; anschließende **Out-of-sample/Walk-forward**-Prüfung, keine Optimierung auf die Testperiode.
- Strategien vergleichen: UNITY streng, UNITY technisch, Buy-and-Hold, breiter europäischer/globaler Aktienindex und Cash. Rendite, Drawdown, Volatilität, Sharpe/Sortino soweit sinnvoll, Trefferquote, Opportunitätskosten und Quote verpasster Einstiege.
- Vorher festgelegte Hypothesen; Auswertung nach 5/20 Handelstagen und 3 Monaten, mit Trennung von Qualität der Entscheidung und Zufall.

**Fertig, wenn:** Wiederholbar durchgeführte Auswertung mit Quellen, Stichprobe, Zeitraum, Berechnung und Vergleich; **keine** behauptete Überrendite ohne belastbaren Nachweis. Für mangelhafte historische Fundamentals gilt erst Forward-Test, nicht erfundener Backtest.

### [ ] Schritt 6 — 0.17: Lern-/Feedbacksystem mit menschlich prüfbaren Regeländerungen
**Implementierung:**
- Decision Ledger verknüpft jede Hypothese und jeden fiktiven Fill mit Erfolg/Fehler und Risiko.
- Verschlechterte/gute Kriterien statistisch auf ausreichend großer Stichprobe prüfen; vorgeschlagene Änderungen getrennt simulieren und erst nach Out-of-sample-Nachweis kontrolliert freigeben.
- Unwichtige Zwischensignale nach vorher festgelegten Regeln verdichten/archivieren, aber Entscheidungen und Audit-Trail nicht löschen.
- Keine sich selbst verändernden Risikovetos und kein „KI lernt aus drei guten Trades“.

**Fertig, wenn:** Jede vorgeschlagene Strategieveränderung mit Vorher-/Nachher-Test, Datenbasis und Risiko dokumentiert ist; alte Regeln und Simulationen bleiben reproduzierbar.

### [ ] Schritt 7 — 0.18 OPTIONAL: KI-Gegenprüfer statt doppelter Analyst
**Implementierung:**
- Nur Änderungen in Geschäftsberichten, Prognosen und bestätigten Ereignissen untersuchen; Morning Report und UNITY verwenden dieselben belegten Quelldaten, doppelte Berechnungen vermeiden.
- KI erstellt belegten **Gegencheck** zu These, Bewertungsannahmen, Quellenlücken, Risiken, neuen Meldungen und markiert Widersprüche. Strukturierter Output + Unsicherheit + Quellen- und Stichtag.
- Kosten/Budget, Cache, Datenschutz, privater API-Proxy. **Kein OpenAI-Schlüssel im Client**, kein automatisches KI-„BUY“/„SELL“.
- Kosten-Nutzen-Pilot mit festem Beispielsatz: Findet die KI nachweisbar zusätzliche entscheidungsrelevante Fakten gegenüber dem bestehenden Monitor?

**Fertig, wenn:** Pilot erkennbaren Zusatznutzen zeigt, überprüfbare Quellen liefert und keine Halluzination zu simulierten Käufen führen kann; andernfalls KI-Modul **nicht** einbauen.

## 5. Kontrollpunkte und Prioritäten
- **Jetzt in Arbeit zu nehmen:** Schritt 1, Daten- und Freigabe-Diagnose. Schnellster direkter Nutzen: Warum greift die Automatik bei einer konkreten Aktie nicht?
- **Erster funktionaler Meilenstein:** Schritte 1–3: korrekte datenbasierte Entscheidung + verlässlicher fiktiver Ordervollzug bei laufender App.
- **Autonomer Meilenstein:** Schritt 4: Ausführung ohne geöffnete PWA; erfordert separate, sichere Laufzeit und ist kein bloßes UI-Feature.
- **Investment-Qualitätsmeilenstein:** Schritte 5–6: messbarer Nutzen und validierte Regelverbesserung.
- **Erst danach:** Schritt 7 KI, falls Quelle/Kosten/Mehrwert stimmen. Zusätzliche Kapitalflussquellen gemäß Issue #21 ergänzen, sobald Basisdaten belastbar sind.

**GitHub-Umsetzung:** [Master-Tracker #40](https://github.com/kontextron-oss/-unity-lab-pwa/issues/40) · [Schritt 1 / 0.15.0: Datenfreigabe #42](https://github.com/kontextron-oss/-unity-lab-pwa/issues/42).

## 6. Fortschrittsprotokoll
| Datum | Schritt | Status | Beleg | Nächste Aktion |
|---|---|---|---|---|
| 06.11.2026 | 0: Prüfung und Planung | **abgeschlossen** | Kritische Analyse, 0.14.2, dieser Arbeitsplan | Schritt 1 umsetzen |
| 06.11.2026 | 1: Daten- und Freigabe-Diagnose · **0.15.0** | **Code und CI abgeschlossen; iPhone-Praxistest offen** | [PR #43](https://github.com/kontextron-oss/-unity-lab-pwa/pull/43), [Issue #42](https://github.com/kontextron-oss/-unity-lab-pwa/issues/42), GitHub Actions und Pages erfolgreich | Auf dem iPhone 0.15.0 laden, Datenstatus der vier Piloten prüfen |
| 06.11.2026 | 2: Deterministische Entscheidungs-Engine · **0.15.1** | **Code und CI abgeschlossen; iPhone-Praxistest offen** | [PR #45](https://github.com/kontextron-oss/-unity-lab-pwa/pull/45), GitHub-Actions-Validierung bestanden | Auf iPhone Entscheidungsanzeige und automatisches Protokoll prüfen; danach Schritt 3 |
| 06.11.2026 | 3: Simulations-Auftragsverwaltung · **0.15.2** | **Code und CI abgeschlossen; iPhone-Praxistest offen** | [PR #49](https://github.com/kontextron-oss/-unity-lab-pwa/pull/49), ausführliche Simulations- und Fehlerfalltests | In Safari: Auslösung bei Tag D, keine sofortige Buchung, modellierter Kauf bei späterem Tageskurs D+n und Kontostand prüfen |
| 06.11.2026 | 4: Hintergrundprozess · **0.15.3.4 Apple Passwörter/Face ID-Autofill** | **Teilweise umgesetzt; verschlüsselter manueller iPhone↔PC-Austausch, kein persönlicher Cloud-Runner** | [PR #50](https://github.com/kontextron-oss/-unity-lab-pwa/pull/50), [PR #51](https://github.com/kontextron-oss/-unity-lab-pwa/pull/51), [PR #52](https://github.com/kontextron-oss/-unity-lab-pwa/pull/52), [PR #53](https://github.com/kontextron-oss/-unity-lab-pwa/pull/53), [PR #54](https://github.com/kontextron-oss/-unity-lab-pwa/pull/54), 57 CI-Prüfschritte | iPhone-Autofill-Praxistest, danach privaten Host/PC-Dienst, sicheren Zugriff, Sync-Konfliktlösung und mehrtägigen unabhängigen Test ergänzen |
| – | 5–7 | **offen** | – | Erst nach Abnahme der vorherigen Schritte |

**Bedienungs-Update 06.11.2026:** UNITY **0.15.0.1** ergänzt in der Aktienübersicht eine sichtbare Schaltfläche **„Eigene Reihenfolge“**. Damit können Aktien bewusst per Ziehgriff oder Pfeilen sortiert werden; die Sortierauswahl bleibt als lokale Einstellung beim Neustart bestehen. Vorhandenes Hinzufügen, Archivieren/Wiederherstellen und Zurücksetzen einzelner Testdepotpositionen bleibt unverändert. [PR #44](https://github.com/kontextron-oss/-unity-lab-pwa/pull/44), CI und GitHub Pages erfolgreich. Dies ist eine kleine Bedienkorrektur, **kein** Beginn oder Abschluss der Entscheidungs-Engine 0.15.1. iPhone-Praxistest noch offen.

## 7. Wiederaufnahme in ChatGPT Work
Arbeiten im GitHub-Repository `kontextron-oss/-unity-lab-pwa`; neueste `main` als Quelle der Wahrheit, insbesondere dieser Plan und die kritische Analyse. Keine erneute Grundsatzbestätigung notwendig; bestehende UI und lokale Testdaten unbeschädigt lassen. Je Sitzung genau den ersten offenen Teilpunkt mit Code, Tests, PR und aktualisierter Fortschrittszeile umsetzen. Ein Bericht über erfolgreiche Tests ersetzt nicht den praktischen iPhone-Test.

### Umsetzungsnotiz 06.11.2026 – Version 0.15.0
Die schreibfreie Diagnose `readiness-audit.js` wurde mit Tests in `main` übernommen. Sie zeigt die Datenstatus-Zahlen über die Aktien-Masterliste, eine aufklappbare Pilotübersicht (ABB, Schneider Electric, Siemens Energy, Infineon) und je Aktie konkrete Lücken nach Kurs, Historie, FX, Berichten, Earnings, Bewertungsangaben, Guidance, These und Risiken. Technische Negativsignale (Trend/RSI), kritische Sicherheitsmargen, Chance/Risiko unter 2:1 und nahe Earnings werden ausdrücklich **getrennt** von fehlenden Daten ausgewiesen. Die Diagnose gibt selbst **keine Orders frei** und schreibt keine Depotdaten. **Praktischer iPhone-Test ist noch ausstehend.**

### Umsetzungsnotiz 06.11.2026 – Version 0.15.1
- Neuer schreibfreier Entscheidungskern `decision-engine.js`: deterministische Ergebnisstruktur mit `action` BUY/HOLD/SELL/BLOCKED, Modus, Quellenstand, Scoreband, Konfidenz, Vetos, Quelle/Börsenplatz/Kurs/Währung, Trigger, Invalidierung, Kapitaleinsatz und Begründung.
- Stufenhierarchie: **frischer plausibler Kurs und EUR-FX** vor simulierten Aktionen; Near-Earnings- und Chance-Risiko-/Sicherheitsmargen-Veto vor neuen Käufen; vollständige fundamentale Freigabe nur aus `unityDeepDecision().investmentReady`, Technikmodus separat und deutlich als Test gekennzeichnet.
- Eine bestehende Position erhält **keine Verkaufsentscheidung allein deshalb, weil heute ein neuer Einstieg unattraktiv ist**. Verkaufsgründe sind ein gültiger technischer Schutzschwellenbruch oder eine belegte relevante fundamentale Verschlechterung.
- Bestehende automatische Kauf-/Verkaufssimulation verarbeitet nur noch **vom zentralen Kern freigegebene** BUY-/SELL-Aktionen. Keine Echtgeldausführung, keine eigenständige Hintergrundautomatik.
- Entscheidungs-Snapshots werden beim Aufruf einer Aktie bzw. Ausführen einer automatischen Simulation **lokal** und mit deduplizierten eindeutigen Schlüsseln in `analyses` protokolliert. Frühere Einträge bleiben unverändert; Protokoll ist kein empirischer Lernerfolg.
- In Aktien-Detail und vollständiger UNITY-Analyse erscheint eine eindeutige Hauptentscheidung. Technischer Testmodus und vertiefte Kennzahlen werden separat angezeigt.
- Neue Tests für vier Aktionen, fehlende Kurse/FX, Ereignisrisiko, harte Vetos, Bestand und Quellenbelege. **Alle automatisierten Prüfungen auf dem Entwicklungs-PR erfolgreich**; endgültiger iPhone-Praxistest noch offen.
- **Schritt 3 bleibt offen:** getrennte Schreiboperationen von Simulationsorder und Transaktionsbuchung sind noch nicht atomar; auch Schlusskurs-Fills, Slippage und Gebühren werden erst in 0.15.2 realistisch modelliert.

### Bedienung und Kapitalgrenze – Version 0.15.1.2 (06.11.2026)
- [PR #47](https://github.com/kontextron-oss/-unity-lab-pwa/pull/47) vereinheitlicht neue automatische Testkäufe auf **festen Eurobetrag je Aktie**, statt Prozent des jeweils freien Kapitals. Der neue Auftragsbetrag kann ohne Abbruch jederzeit geändert werden.
- Zusätzlich **Gesamtbudget für automatische Testkäufe** in EUR. Dieses umfasst das kumulierte Brutto-Kaufvolumen der nicht archivierten automatischen Käufe einschließlich Gebühren. Automatische Verkäufe erhöhen das Ausgabenbudget ausdrücklich **nicht**. Angezeigt werden eingestelltes Limit, bisherige automatische Käufe und Restbudget.
- Kein fiktiver Kauf darf das globale Budget oder das tatsächlich freie Testkapital überschreiten. Ein festes Volumen wird **nicht still teilgebucht**: Wenn der Rest nicht reicht, bleibt der Auftrag aktiv und wartet, bis der Nutzer Budget oder Betrag bewusst anpasst.
- **Historischer Zustand 0.15.1.2, ersetzt durch 0.15.1.3:** Bereits laufende Prozentaufträge blieben damals unverändert und konnten manuell umgestellt werden. Diese parallele Prozentlogik ist inzwischen entfernt.
- Sichtbare Rückmeldung „Speichere …“, **„✓ Betrag/Budget gespeichert“ mit Zeitstempel**, „bereits gespeichert“ oder Fehlermeldung. Bei zehn vorgemerkten EUR-Testkäufen prüft der automatisierte Test, dass das Budget von 300 €, 500 € bzw. 550 € niemals durch unbeabsichtigte Kaufbuchungen überschritten wird. Wenn 50 € verbleiben und ein Betrag 100 € lautet, wird keine unerwartete Teilposition angelegt.
- **Einordnung:** Das ist eine Zwischenverbesserung des Bedien- und Budgetmodells. Schritt 3 (atomare, crash-sichere Order-/Fill-Verbuchung, realistische Ausführung/Spread/Gebühren) und Schritt 4 (unabhängiger Hintergrundprozess) bleiben ausdrücklich **offen**. iPhone-Praxistest noch ausstehend.

### Einheitliche Euro-Testaufträge – Version 0.15.1.3 (06.11.2026)
- [PR #48](https://github.com/kontextron-oss/-unity-lab-pwa/pull/48) entfernt die laufende **Prozent-Ausführung**: Automatische Kaufaufträge verwenden jetzt ausschließlich feste Eurobeträge. Kein Prozent-Auswahlfeld und kein technischer Prozent-Fallback.
- **Einmalige automatische Umstellung** noch aktiver, nicht ausgeführter Prozent-Testaufträge beim ersten App-Start auf 0.15.1.3, vor der Darstellung und der Simulationsprüfung. Umrechnung je Aktie = alter Prozentsatz × **frei verfügbares Testkapital zum Umstellungszeitpunkt**, kaufmännisch auf Cent gerundet; alle Aufträge nutzen dieselbe Kapitalbasis, keine Reihenfolgeeffekte.
- Beispiel: 5 % und 1.000 € freies Testkapital ergeben einen **festen Kaufauftrag über 50 €**. Dabei bleiben Order-ID, Aktivierungsdatum und Prüfmodus erhalten. Alte Prozentwerte werden nur im technischen Migrationsprotokoll zur Nachvollziehbarkeit archiviert, nicht weiter für Kaufentscheidungen verwendet.
- **Gemeinsames Budget automatisch ergänzt, falls bisher keines vorliegt:** bereits ausgegebener Betrag für automatische Testkäufe plus der kleinere Wert aus verfügbarem freien Kapital und Summe aller offenen festen Testaufträge. So entsteht keine zusätzliche automatische Kaufmacht über das verfügbare Testkapital hinaus.
- Ist beim Umstellungszeitpunkt kein freies Testkapital vorhanden oder ergibt die Rechnung weniger als 1 €, bleibt der Auftrag gespeichert, aber ohne ausführbaren Eurobetrag. Dann ist der Eurobetrag manuell festzulegen; es wird keine fiktive Mindestkaufsumme erfunden.
- Die Änderungen an bestehenden aktiven Aufträgen und das Migrationsprotokoll werden **in einer einzigen lokalen IndexedDB-Transaktion** gespeichert. Wiederholte App-Starts oder Datenimporte dürfen die Eurobeträge nicht erneut verändern. Bisherige Test-Transaktionen, Verkäufe und geschlossene historische Auftragsdatensätze werden nicht umgeschrieben.
- GitHub-Actions-Prüfung: 50 Tests erfolgreich einschließlich zehnmaliger Umrechnung und idempotentem Wiederholungsversuch. Die bisherige globale Kapitalgrenze und der Ausschluss stiller Teilbuchungen bleiben erhalten.
- **Offen:** iPhone-Praxistest; 0.15.2 für atomare **Order-/Fill-Buchung** (nicht mit der jetzt atomaren Datenmigration verwechseln), bessere Ausführungsannahmen und 0.15.3 für Hintergrundbetrieb.

### Technischer Stand 0.15.2: atomare Simulationsorders (06.11.2026)
- Implementiert mit [PR #49](https://github.com/kontextron-oss/-unity-lab-pwa/pull/49), Modul `paper-order-engine.js`. **Zweistufiger Testauftrag:** Ein bestätigtes Signal anhand des publizierten Tagesschlusskurses D wird zunächst lokal als *ausgelöst* gespeichert. Eine modellierte Ausführung kommt erst mit einem **späteren tatsächlich beobachteten Tages-Schlusskurs D+n** infrage; niemals rückwirkend zum bereits bekannten Signal-Schlusskurs D. Das ist **kein** tatsächlicher Börsenfill und bei nicht geöffneter App nicht notwendigerweise der unmittelbar nächste Handelstag.
- **Modellierte Ausführungskosten:** Ein-/Ausstiegskurs = später beobachteter Schlusskurs ± halber angenommener Spread ± Slippage. Vorgaben 10 Bp Spread (gesamt), 15 Bp Slippage und 1 € fiktive Gebühr je Order; Parameter in der Testdepot-Ansicht anpassbar. **Bei einem Kauf umfasst der feste Eurobetrag auch die Gebühr**; die Stückzahl ist entsprechend kleiner. Beim Verkauf reduzieren Modellgebühren den Erlös.
- **Ausführung nur mit verifizierbarer Kursreferenz**, passender Währung/Börsenplatz, gültigem FX, frischer Kursreihe und zuvor gespeichertem Signal. Wird ein Kauf auf dem späteren Kurs teurer als die beim Signal festgelegte Grenze, verfällt das Signal und es wird kein teurerer Kauf erzwungen. Beim geänderten Eurobetrag wird das alte Signal zurückgesetzt.
- **Atomar und idempotent:** Orderstatus, Trade und Audit-Eintrag werden in derselben IndexedDB-Schreibtransaktion gespeichert. Es gibt eine eindeutige Ausführungs-ID pro Ordergeneration und eine nochmalige Doppelbuchungsprüfung innerhalb des Transaktionslocks. Budget, freie Testmittel, alle Buchungen und vorhandener Verkaufbestand werden unter dem gleichen Schreiblock geprüft. Kein stiller Teilkauf und keine Überschreitung des Gesamt-Eurobudgets.
- **Automatisierter Fehlertest:** Ausfälle beim Schreiben in den Transaktionsstore, nach dessen Schreibanforderung beim anschließenden Orderstatus und im nachfolgenden Audit werden im Test simuliert. Der gesamte Vorgang wird dann zurückgerollt; erneutes Ausführen kann anschließend genau einmal buchen. Zehn parallel vorgemerkte Kaufaufträge und eine Verkaufsschwelle werden über verschiedene Kurstage/Budgetlimits getestet. Alle GitHub-CI-Prüfungen bestanden.
- **Einschränkungen:** Ein tatsächlicher nächster Börsen-Open/Limit-Fill ist mangels solcher ausführbarer Echtzeitdaten noch nicht nachweisbar. Die Modellkosten sind Annahmen. Die PWA führt weiterhin nur während verfügbarer App-Laufzeit aus; kein eigener Server- oder PC-Hintergrundrunner. Es erfolgen keine Echtgeldkäufe. **iPhone-Praxistest ist noch ausstehend**; 0.15.3 wird erst nach praktischer Kontrolle begonnen.

### 0.15.3 – unabhängiger Laufzeitkern (Grundgerüst, NICHT abgeschlossen)
- [PR #50](https://github.com/kontextron-oss/-unity-lab-pwa/pull/50) führt eine portable Node.js-Implementierung `worker/core.cjs` ein. Sie besitzt keine DOM-/Safari-Abhängigkeit und kann prinzipiell in einem späteren privaten Server oder einer PC-Version ausgeführt werden.
- `.github/workflows/unity-worker-demo.yml` enthält einen zeitgesteuerten und manuell startbaren **rein synthetischen** Testlauf (GitHub-Zeitplanung ist Best Effort, bisher noch nicht durch einen echten geplanten Mehrtagelauf nachgewiesen). `worker/demo-fixture.cjs` und `worker/run-demo.cjs` verarbeiten ausschließlich eine **erfundene** Aktie, ein fiktives Startkapital, einen gespeicherten Auslöser, einen erst späteren modellierten Testkauf und einen idempotenten Wiederholungsversuch. Keine Depotdaten, keine pCloud-Zugangsdaten, keine Brokerkonten oder persönlichen Anlagen verlassen das iPhone.
- `tests/worker-demo.cjs` prüft Stop, EUR-Budget, fehlende/alte Daten, unverwechselbare Aktie, Ablehnung von Kryptopapieren, zeitlich korrekten Auslöser, nachfolgende Modellbuchung und Wiederholungsverbot. Alle 52 PR-CI-Schritte bestanden. Zeitgesteuerte Statusartefakte tragen die Kennzeichnung **SYNTHETIC-DEMONSTRATION-ONLY** und können öffentlich sein.
- **Verbindliche Zukunftsfähigkeit:** siehe Architekturvorgabe im Schritt 4 oben und [Worker-README](../worker/README.md). PC-Version und privater pCloud-Datendrehpunkt bleiben Teil des UNITY-Ziels; Local-First, versionierte Datenschemata und stable IDs, explizite Konfliktlösung, keine stillen Überschreibungen, keine doppelte Transaktionshoheit, keine geheimen Daten auf öffentlichem GitHub.
- **Noch offen:** sichere private persistent laufende Runtime, verschlüsselter/passender Speicher und Authentifizierung, PWA-/PC-Datenadapter, Sync-/Konfliktprotokoll, private Status-/Pause-Steuerung, vertrauenswürdige ausreichende Kursquellen und tatsächlicher mehrtägiger Test mit geschlossener PWA. Ohne diese Nachweise ist der Hintergrundhandel mit dem **eigenen Testdepot weiterhin NICHT eingerichtet**. Die iPhone-PWA bleibt bei **0.15.2**.

### 0.15.3.1 – dauerhafter PC-Demo-Zustand (06.11.2026)
- [PR #51](https://github.com/kontextron-oss/-unity-lab-pwa/pull/51): `worker/local-runner.cjs` ergänzt den synthetischen plattformneutralen Kern um einen **eigenständigen lokalen Node.js-Prozess**, der mit `init`, `resume`, `pause`, `status`, `tick` und `serve` verwaltet werden kann. Er speichert ausschließlich **synthetische Beispielaufträge** in einem Ordner außerhalb des öffentlichen GitHub-Repositorys und startet standardmäßig pausiert.
- **Privater Speicherprototyp:** exklusive Dateisperre gegen parallele Schreibprozesse, sichere Behandlung verwaister Locks, gemeinsame JSON-Checkpoint-Datei für Ereignisse, Status und Demotransaktionen; Schreiben über temporäre Datei, `fsync` und Umbenennen sowie separat erhaltene Vorgängerversion. SHA-256-Prüfsumme plus Revision und Vorgängerreferenz. Bei beschädigtem Checkpoint **Abbruch ohne stillen Rücksprung**.
- **Mehrprozess-Regressionsprüfung:** wiederholter Start in getrennten Node-Prozessen, Tag-D-Signal, spätere Tag-D+n-Modellbuchung genau einmal, kein doppelter Kauf nach Neustart, Pause und blockierte konkurrierende Schreibsperre, Wiederanlauf nach einem verwaisten Lock, Erkennen von beschädigten Daten. **53 CI-Schritte erfolgreich.**
- **Ausdrücklich nicht implementiert:** persönlicher iPhone-Testdepot-Zugriff, pCloud-OAuth oder automatischer pCloud-Abgleich, echte PC-Oberfläche, verschlüsselte persönliche Depotdaten, vollständig private persistente Serverumgebung und autoritativer Statusaustausch. Ein bei Bedarf laufender PC-Prozess ist kein Garantieversprechen für Betrieb bei ausgeschaltetem PC. Die **bereits funktionierende manuelle pCloud-Sicherung auf dem iPhone bleibt unangetastet**; kein persönlicher Datensatz wurde zu GitHub übertragen.
- **Aktuelle iPhone-PWA bleibt Version 0.15.2.** Schritt 4 ist weiterhin OFFEN, bis die private Laufzeit mit authentifizierter Synchronisation und einem dokumentierten echten Mehrtagestest ohne geöffnete iPhone-App sicher betrieben werden kann.

### 0.15.3.2 – konkret nutzbarer manueller Austausch (06.11.2026)
- [PR #52](https://github.com/kontextron-oss/-unity-lab-pwa/pull/52) implementiert `exchange-protocol.js` als einheitliche lesbare Austauschstruktur für Safari-iPhone und späteren Node-/PC-Worker. Enthalten: aktive automatische Aktien-Testaufträge, zugehörige eindeutige Aktie/ISIN/Börsenplatz/Währung, abgeschlossene automatische Testbuchungen und EUR-Budgetgrenze/verbrauchtes Budget. Keine PWA-Gesamtarchive, kein Zugangsschlüssel und keine automatische Krypto-Kauforder.
- **In der iPhone-App 0.15.3.2:** Im Tab „Datensicherung“ zusätzlich „03 · Austausch für PC / Hintergrundprozess (nur Prüfung)“. Ein Knopfdruck bereitet nach bewusster Entscheidung eine lokale Datei vor; ein zweiter öffnet die iOS-Dateifreigabe für das **manuelle** Teilen in den geschützten pCloud-Ordner `UNITY-LAB/03-AUSTAUSCH/`. Eigenständige Prüffunktion liest eine zuvor ausgewählte Austauschdatei, kontrolliert Felder/Prüfsumme und zeigt Unterschiede als Konflikte, ohne lokale Daten zu verändern.
- Die Austauschdaten sind **nicht verschlüsselt**. Die SHA-256-Prüfsumme prüft Konsistenz/zufällige Änderungen, nicht die Identität eines böswilligen Absenders. Die Datei darf nur in privaten Speichern verwendet werden. Bestehende pCloud-BASIS-/ÄNDERUNGSSICHERUNG bleibt unverändert.
- **Auf dem späteren PC bereits prüfbar:** `node worker/inspect-exchange.cjs <lokale-Datei.json> [<zweite-Datei.json>]`; nur Validierung und Vergleich, keine Buchung oder Datenübernahme. Format fordert `authority:local-iphone`, `purpose:review-only`, `executionPermission:false`, stabile IDs, eine Revisionsnummer und definierte Feldlisten. Abweichende gleiche IDs bleiben Konflikte statt still überschrieben zu werden. Beschädigte und fremde Datentypen führen zur Ablehnung.
- **Automatisierte Tests:** 55 GitHub-CI-Schritte einschließlich Browser-Export, expliziter iOS-Dateifreigabe, Hash-/Schema-Tests, Konflikt-/Manipulationsprüfung und Bestätigung, dass importierte Testpakete keine einzige Depotbuchung oder Order verändern. Die iPhone-Handbedienung ist noch nicht als Praxistest abgenommen.
- **Schritt 4 weiterhin offen:** kein bidirektionaler Cloud-Sync, keine private dauerhafte Host-Anbindung, keine sichere automatische Authentifizierung, keine autoritative Remote-Ausführung für persönliche Testaufträge, keine fertige PC-Oberfläche. Vor deren Freigabe ausdrücklich keine Hintergrundbuchungen mit persönlichen Daten versprechen.

### 0.15.3.3 – geschützter manueller Austausch (06.11.2026)
- [PR #53](https://github.com/kontextron-oss/-unity-lab-pwa/pull/53): Die iPhone-PWA erstellt im Bereich **„03 · Austausch für PC / Hintergrundprozess“** ausschließlich neue mit **AES-256-GCM** verschlüsselte Pakete; pro Datei individuelle Salt/IV und mit PBKDF2-HMAC-SHA256 (310.000 Iterationen) abgeleiteter Schlüssel. Ein separates, mindestens 12 Zeichen langes Austauschpasswort und eine Bestätigung sind bei der Vorbereitung erforderlich. Kein Klartext-JSON-Export neuer Austauschdateien.
- **Interoperabilität:** Browser und PC lesen denselben authentifizierten verschlüsselten Umschlag. Die PC-Funktion `worker/inspect-exchange.cjs` fragt das Passwort am interaktiven Terminal **ohne sichtbare Eingabe** ab; es wird nicht als Kommandozeilenargument übergeben oder in das Depot importiert. Falsches Passwort oder manipulierte Daten werden abgewiesen.
- **Verantwortlicher Umgang:** Passwort wird nicht dauerhaft im iPhone-LocalStorage oder in der Datenbank gespeichert und nicht an GitHub oder pCloud als separates Datum übertragen. Nach dem lokalen Ver-/Entschlüsseln wird das UI-Eingabefeld geleert. Das Passwort ist für spätere Inspektion notwendig; ohne Kenntnis ist die verschlüsselte Austauschdatei nicht wiederherstellbar. Die bereits vorhandene **manuelle pCloud-BASIS-/ÄNDERUNGSSICHERUNG bleibt unverändert und separat**; ältere unverschlüsselte Austauschdateien aus 0.15.3.2 dürfen nur geprüft werden.
- **Keine Ausführungsgewalt:** Pakete tragen weiterhin `executionPermission:false`, `purpose:'review-only'`, `authority:'local-iphone'`. Der Prüfschritt ändert keine Depotbuchung oder offenen Testauftrag. Die neue AES-GCM-Authentifizierung schützt Integrität des verschlüsselten Pakets; die Geheimhaltung hängt zusätzlich von einer ausreichenden Passwortstärke ab.
- **Validierung:** 56 automatisierte CI-Schritte einschließlich AES-GCM und PBKDF2 Browser/Node-Interoperabilität, Zufalls-Salt/IV, Manipulations- und Passworttests, mobile Export-/Share-Sheet-Bedienlogik und unverändert nur lesender Dateiprüfung. **Praktischer iPhone-Test noch offen.**
- **Noch offen:** Nachweisbar sicherer privater Server bzw. dauerhafter PC-Dienst, geschützte authentifizierte Datenkanäle, Freigabe und Rückgabe von Änderungen mit Konfliktauflösung, serverseitige alleinige Auftragsschreibberechtigung, tatsächliche automatische pCloud-Synchronisation, nachvollziehbare Stop-/Statussteuerung über die iPhone-App und mehrtägige Probeläufe mit geschlossenem iPhone. **Schritt 4 ist NICHT abgeschlossen.**

### 0.15.3.4 – Apple Passwörter als Face-ID-vermitteltes AutoFill (06.11.2026)
- [PR #54](https://github.com/kontextron-oss/-unity-lab-pwa/pull/54) ergänzt **in der iPhone-PWA** für beide Austausch-Passwortfelder (`Austauschdatei vorbereiten` und `Entschlüsseln und prüfen`) reguläre Safari-Credential-Felder `autocomplete=username`/`current-password` mit der neutralen Kennung `unity-austausch`. Ein kompakter Hilfe-Abschnitt erklärt das **einmalige eigenständige Speichern** des Austauschpassworts in Apples App **Passwörter** für die Adresse der geöffneten UNITY-Web-App.
- **Face ID wird vom Betriebssystem verwendet**, wenn die vorhandene gespeicherte Website-Anmeldung über Apple Passwörter angeboten/freigegeben wird. UNITY ruft keine Face-ID-Schnittstelle selbst auf und stellt **keine Apple-ID-Anmeldung** her. Ob der Vorschlag im Safari-/PWA-Kontext erscheint, hängt von den Geräte-/Autofill-Einstellungen ab und muss auf dem iPhone geprüft werden. Die PWA kann weder direkt einen Apple-Schlüsselbund-Eintrag erzeugen noch das Ergebnis einer Face-ID-Freigabe sehen.
- **Bedienung:** Die erste manuelle Passwortwiederholung ist weiterhin zur Fehlervermeidung empfohlen, bei einem durch Apple Passwörter ausgefüllten Hauptfeld aber **optional**; eine ausgefüllte, ungleiche Wiederholung wird weiterhin blockiert. Formulare können nicht durch Enter versehentlich abgesendet werden. Passwort-Eingaben werden nach der lokalen Verschlüsselung/Prüfung geleert; kein Passwort wird in GitHub, IndexedDB, pCloud als Extra-Datum oder lokalen UNITY-Einstellungen gespeichert.
- **Sicherheitsstatus unverändert:** AES-256-GCM/Passwortableitung, nur lesender Austausch, die getrennten manuellen pCloud-Sicherungen, das lokale Depot und das fehlende Recht, Hintergrundkäufe auszuführen, bleiben unangetastet. 57 automatisierte Prüfungen inklusive Safari-Formsemantik/AutoFill-Kennzeichnung und einmaligem Hauptpasswort-Einsatz bestanden. **Es fand kein echter iOS-Face-ID-Gerätetest statt.**
- **Roadmap Schritt 4 bleibt offen:** Noch kein automatisch authentifizierter privater pCloud-Sync oder autoritativer Hintergrundprozess. Die reine AutoFill-Verbesserung ist keine Remote-Berechtigung.
