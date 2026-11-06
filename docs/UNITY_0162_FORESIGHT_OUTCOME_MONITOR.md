# UNITY 0.16.2 – Prognosekontrolle, automatischer SEC-Ergebnisabgleich, Frühwarn-Prioritäten

**Status:** Das bisherige Vorausschau-Protokoll vom 7. November 2026 bleibt unverändert. Die Prüfung erfolgt anhand einer separaten, automatisch aktualisierten Datenquelle `data/foresight-outcomes.json`.

## Was neu ist

1. **Automatischer SEC-Prüflauf:** Nach dem regulären SEC-XBRL-Fundamentalabruf wird das Prognoseprotokoll auf einen neuen bestätigten FY2026-Konzernabschluss geprüft. Identität (ISIN und SEC-CIK), Zeitraum (2026-12-31), US-GAAP-Konzept, USD-Einheit, Berichtsstichtag und Veröffentlichungszeitpunkt müssen exakt passen. Für 2026 existiert am 7.11.2026 noch kein abgeschlossener FY2026-Konzernabschluss. Alle drei Prognosen müssen daher auf **offen** stehen.
2. **Unveränderliche Ausgangserwartungen:** Für jeden vorab registrierten Prognosepunkt wird ein SHA-256-Fingerabdruck der ursprünglichen Quelle, Prognosespanne, Einheit, Prognose- und Registrierungsdaten gespeichert. Änderung oder Entfernung eines bereits erfassten Punkts wird als Fehler behandelt, nicht still akzeptiert.
3. **Versionierte, nicht-destruktive Ergebnisse:** Spätere geprüfte SEC-Istwerte werden nur einmal als `verified` übernommen. Eine abweichende SEC-Nachmeldung erscheint als `revision-review` mit neuem Kandidaten; der ursprüngliche geprüfte Istwert bleibt unverändert. Bei einem Ausfall der SEC-Quelle wird eine alte Prüfung als `verified-previous-source-unavailable` erkennbar erhalten.
4. **Historische Vergleichsbasis:** Die 2025er Werte bleiben auch dann verfügbar, wenn 2026 zum aktuellsten SEC-Jahr geworden ist, indem das geprüfte `priorMetrics`-Jahr getrennt geprüft wird. 2026er Ergebnisse dürfen nie als 2025er Vergleichsbasis verwendet werden.
5. **Aufgabenpriorität statt Kaufattrappe:** Das bestehende Kapitalradar priorisiert belegte SEC-Widersprüche, bestätigte bevorstehende Earnings (maximal 14 Tage), neue Ergebnisabgleiche und anspruchsvolle unter Modellannahmen enthaltene Kurserwartungen. Fehlende Daten sind als **offen** eingestuft und nicht negativ gepunktet. Jede Position nennt einen messbaren nächsten Prüfauftrag.

## Neue Datenfelder

`foresight-outcomes.json` enthält `status`, `lastCheckedAt`, `forecastFingerprint`, `verified`, gegebenenfalls `observedCandidate` und `counts`. Es werden keine privaten Depot-, Kapital-, Transaktions-, Passwort- oder pCloud-Daten in GitHub veröffentlicht.

## Noch nicht umgesetzt

Die App ist mit dieser Version **noch keine trainierte Prognose-KI**. Sie bewertet zunächst die bereits vor dem Ergebnis festgehaltenen **Unternehmensprognosen**. Echte UNITY-Modellprognosen, statistische Trefferquoten mit Fehlerintervallen und rückwirkungsfreie Kalibrierung folgen erst, wenn eine ausreichende, eigenständige Zeitreihe von vorab dokumentierten Modellvorhersagen vorliegt. Ein fehlender Earnings-Termin wird nicht geschätzt.

## Sicherheit

Weder Ergebnis-Signale noch Prioritäten haben Zugang zu echten oder simulierten Transaktionen. `tradeApproved:false`, `entryZone:null`; die bestehenden UNITY-5.1-Vetoregeln, das lokale Depot, die iPhone-Offline-PWA und die spätere PC/pCloud-Architektur bleiben erhalten.
