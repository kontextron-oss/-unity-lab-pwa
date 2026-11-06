# UNITY LAB – Kritische Bewertung und Zielarchitektur für autonome Testentscheidungen
Stand: 06.11.2026. Codegrundlage: `main`, App-Version 0.14.2.

## Kurzurteil
- Konzeptpotenzial: 8,5/10; gegenwärtiges Forschungs-/App-Projekt: ca. **5,5/10**; als nachweislich verlässlicher autonomer Trading-Autopilot: ca. **3/10**.
- Bewertung ist eine qualitative Projektprüfung, kein unabhängig auditierter Leistungs- oder Renditenachweis.
- Automatisierung an sich ist kein Alleinstellungsmerkmal. Differenzierung denkbar durch transparente europäische Fundamentaldaten, bewertungsorientierten Einstieg, getrennte Risiko-/Event-Vetos, technischen Ausführungszeitpunkt und vorab festgelegte Erfolgskontrolle.
- Keine Prognose garantiert einen „optimalen“ Einstiegs- oder Verkaufskurs. Handelssimulationen müssen mit dem Informationsstand zum damaligen Zeitpunkt arbeiten.

## Verifizierter IST-Zustand
- Laufender Code: `home.js`, `decision-policy.js`, `dataquality.js`, `depot.js`; GitHub Actions testen JavaScript und Veröffentlichung.
- Kauf- und Verkaufssimulation ist an offene/aktualisierte PWA gekoppelt; keine autonome Hintergrundausführung, keine Broker-Schnittstelle.
- Der Kauf kann als technischer EOD-Test (u.a. SMA50-Zone) oder als streng geprüfte UNITY-Freigabe angelegt werden. Kaufanteile im Testdepot: 2/5/10/15/20/25/50 % des freien Simulationskapitals.
- Automatische Testtransaktionen, aktive Aufträge und Stoppmöglichkeiten werden angezeigt. Buchungen haben Kennzeichnungen und begründete Entscheidungs-Snapshots.
- Technischer Autoverkauf verwendet letzten validierten Schlusskurs statt fälschlich eines Kaufsignals; beide Ausführungen sind einmalige simulierte Transaktionen, nicht Echtzeit-Orderausführungen.
- `data/fundamentals.json` vom 05.11.2026 enthält 4 Emittenten-Piloten: **Schneider Electric** `metrics-complete` mit fünf strukturierten Kennzahlen; **ABB, Siemens Energy, Infineon** jeweils `issuer-release-only`, `metrics={}`, `latestFiling=null`. Emittentenmeldungen mit Teilzahlen sind keine vollständig strukturierte Datenbasis.
- `data/issuer-calendar.json` enthält 9 Emittenten, nicht flächendeckend die ganze Watchlist.
- Die strenge Freigabe `unityDeepDecision().investmentReady` erfordert u.a. aktuelle technisch valide Daten, bestätigte Berichte, Bewertungs- und Qualitäts-Scores, Chance/Risiko >=2, Score >=70, Sicherheitsmarge >=10 %, Bilanzprüfung, Guidance, bestätigte Earnings mehr als 7 Tage entfernt und dokumentierte Quelle/These/Risiken. Die aktuell fehlenden Felder begrenzen deren automatische Durchlässigkeit; Quote, Datenlücke und Veto müssen getrennt gezählt werden.
- Offene technische Risiken: aufeinanderfolgende separate Schreibvorgänge für Transaktion und Orderstatus (nicht atomar), Schlusskurs-Fill statt ausführbarer Marktquote, unzureichend belegte Slippage-/Gebühren-/Steuer-/Corporate-Action-Simulation, fehlende unabhängige Performanceprüfung.
- iOS-PWA läuft nicht als garantierter kontinuierlicher Hintergrund-Handelsprozess. **Kein** Echtgeldhandel, kein Broker und keine aktive LLM/ChatGPT-Entscheidungsschnittstelle im geprüften Code.

## Nächstes Entwicklungsziel: UNITY 0.15 – Autonomous Paper Engine
1. **Datenqualität:** pro Aktie einheitliche Datenlage `green|incomplete|stale|conflict|source-failed` plus Quellen-/Zeitstempel, Kurs, Währung, Handelsplatz, Bilanz, Prognosen, Earnings, Corporate Actions.
2. **Deterministische Entscheidungen:** vier getrennte Ausgänge `buy|sell|hold|blocked` mit Quellenstand, Bewertungsabschlag, Risiko, Entscheidungsversion und Konfliktgründen; `blocked` unterscheidet `missing-data` von tatsächlichen Negativsignalen.
3. **Verlässlicher Scheduler:** autarker privater Worker bzw. ständig aktiver PC-Prozess für tägliche Börsentags-Ereignisse, auch bei geschlossener iPhone-PWA; kein Client-only-Ersatz. Keine sensiblen Depotdaten ins öffentliche GitHub-Repository.
4. **Simulation:** modellierte nächste ausführbare Marktzeit statt rückwirkender Fill am Schlusskurs; Kosten, Slippage, Spread, FX, Gebühren, Steuern, Kapitalmaßnahmen, Liquidität und Feiertage berücksichtigen; Simulation klar beschriften.
5. **Order- und Depotintegrität:** persistente eindeutige Order-/Fill-IDs, atomare Buchung + Status, Retry/Idempotenz, Storno, Reconciliation, Stop/Kill-Switch, Allokations-/Sektorlimits, tägliche Ordergrenze.
6. **Decision Ledger:** unveränderliche Entscheidungs-Snapshots, Signalzeit vs. Ausführungszeit, Trigger/These/Widerlegung, Datenqualität, verbleibende Datenlücken, 5/20 Handelstage/3 Monate Nachprüfung.
7. **Messbarer Backtest:** verifizierte Historie „as of“ zum Analysezeitpunkt, keine Zukunftsdaten/Look-ahead, Walk-forward und Out-of-sample, realistische Kosten; Vergleich gegen Buy-and-Hold, STOXX Europe 600, globalen ETF und Bargeldverzinsung; Rendite, Drawdown, Sharpe, Trefferquote, durchschnittliche Haltedauer, Turnover und versäumte Einstiege.
8. **iPhone-Oberfläche:** Top der Liste `Kaufkandidat|Warten/Daten fehlen|Verkaufskandidat`; Übersicht `frei|investiert|gebunden|realisiert|vorläufig`, aktive/gecancelte/erledigte Orders, Simulation AN/AUS und Alarmierung.
9. **Modi:** A `Beobachten`, B `Vorschlag zur manuellen Bestätigung`, C `Autonom im Testdepot`. Für reale Brokeranbindung ausschließlich gesondertes, neues und abgesichertes Projekt nach erfolgreichem Paper-Trading-Track-Record.
10. **Akzeptanz vor Aktivierung:** Tests für Null-Daten, Kurslücken, falsche Währung, Ankündigung vor Earnings, aufgegebene oder doppelt verarbeitete Jobs, identische IDs, Crash zwischen Buchung und Status, rückwirkende historische Fills und Portfolio-Reconciliation.

## KI-Integration: optionaler separater Auditor
- Die deterministische UNITY-Engine bleibt alleiniger Entscheider für `buy/sell/hold/blocked`.
- KI als *zweite Meinung*: Quellen dokumentieren, neue Earnings/Guidance/Nachrichten zusammenfassen, Bull/Bear-These gegeneinander prüfen, Widersprüche/Datenlücken und potenzielle Fehleinschätzungen markieren.
- KI-Antwort nur strukturiert mit Quellen, Standzeit, Konflikt-/Datenstatus, Unsicherheit und Priorität; keine KI-freigegebene Order, keine erfundenen Live-Kurse.
- Nur neue bzw. geänderte Sachverhalte analysieren, dieselben Daten für Morning Report und App benutzen, Doppelarbeit vermeiden.
- Browser-/iPhone-PWA darf keinen OpenAI-API-Key enthalten. Falls benötigt: privater, kontrollierter Backend-Proxy, separates Budget, keine unkontrollierte Übertragung von Depot- oder Kontodaten. ChatGPT-Abonnement nicht mit API-Nutzung verwechseln.

## Konkurrenzvergleich (Stand November 2026)
- QuantConnect/LEAN: professionelles Backtesting und brokerverbundenes Live-Trading.
- Composer: KI-gestützte Strategieerstellung, Backtesting und automatischer Handel.
- Danelfin: KI-Aktienrangfolge aus technischen, fundamentalen und Sentiment-Daten; proprietärer 3-Monats-Score.
- TrendSpider: Strategietester und Bots mit Broker-/Webhook-Automation.
- Interactive Brokers: im Oktober 2026 angekündigtes `Autonomous Trading` für berechtigte Kunden.
- Daraus folgt: Ein einzigartiges Angebot müsste über das Vorhandensein einer Automatik hinaus empirisch nachweisbaren Mehrwert bieten.

## Status
Dieses Dokument ist eine Entwicklungs-/Prüfgrundlage. **Keine produktive Hintergrundsimulation, kein neues KI-Modul und keine Broker-Anbindung wurden hierdurch implementiert.** Bestehende App 0.14.2 bleibt unverändert; weitere Versionen in separatem Branch plus automatisierten Tests entwickeln.
