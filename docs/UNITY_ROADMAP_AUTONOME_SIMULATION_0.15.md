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
| – | 2: Deterministische Entscheidungs-Engine · 0.15.1 | **offen** | – | Nach iPhone-Kontrolle Schritt 2 beginnen |
| – | 3–7 | **offen** | – | Erst nach Abnahme der vorherigen Schritte |

## 7. Wiederaufnahme in ChatGPT Work
Arbeiten im GitHub-Repository `kontextron-oss/-unity-lab-pwa`; neueste `main` als Quelle der Wahrheit, insbesondere dieser Plan und die kritische Analyse. Keine erneute Grundsatzbestätigung notwendig; bestehende UI und lokale Testdaten unbeschädigt lassen. Je Sitzung genau den ersten offenen Teilpunkt mit Code, Tests, PR und aktualisierter Fortschrittszeile umsetzen. Ein Bericht über erfolgreiche Tests ersetzt nicht den praktischen iPhone-Test.

### Umsetzungsnotiz 06.11.2026 – Version 0.15.0
Die schreibfreie Diagnose `readiness-audit.js` wurde mit Tests in `main` übernommen. Sie zeigt die Datenstatus-Zahlen über die Aktien-Masterliste, eine aufklappbare Pilotübersicht (ABB, Schneider Electric, Siemens Energy, Infineon) und je Aktie konkrete Lücken nach Kurs, Historie, FX, Berichten, Earnings, Bewertungsangaben, Guidance, These und Risiken. Technische Negativsignale (Trend/RSI), kritische Sicherheitsmargen, Chance/Risiko unter 2:1 und nahe Earnings werden ausdrücklich **getrennt** von fehlenden Daten ausgewiesen. Die Diagnose gibt selbst **keine Orders frei** und schreibt keine Depotdaten. **Praktischer iPhone-Test ist noch ausstehend.**
