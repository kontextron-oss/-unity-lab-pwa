# UNITY 0.16.1 – Vorausschau-Radar und überprüfbare Zukunftshypothesen

**Funktion:** Die App bleibt local-first/offline-fähig und enthält jetzt eine frühe, überprüfbare Erwartungsüberwachung. Sie ist keine Kursvorhersagemaschine und ändert **keine** Kauf-, Order-, Depot- oder pCloud-Daten.

## Architektur – vier voneinander getrennte Ebenen

1. **Frühindikatoren:** Aktuelle Managementprognosen aus `data/issuer-guidance.json`, technisch validierter Datenstand, bestätigte Earnings-Termine aus dem bestehenden IR-Kalender und preisimplizite Wachstumssensitivität aus `reverse-valuation.js`. Fehlende Termine werden nie geschätzt.
2. **Vorab festgelegte Erwartungen:** `data/foresight-checkpoints.json` enthält die am 7. November 2026 erstmals protokollierten FY2026-Prognosewerte mit ursprünglicher Veröffentlichungsquelle und fixiertem Beobachtungszeitpunkt. Diese öffentlichen Vorhersagen stammen von **den Unternehmen**, nicht von einem bereits trainierten UNITY-Modell.
3. **Spätere Ergebnisprüfung:** Wenn ein geprüfter, ISIN-identischer FY2026-SEC-Konzernabschluss vorliegt, vergleicht UNITY den gemeldeten US-GAAP-Wert mit dem vorher dokumentierten Wert. Vorher bleibt er `awaiting-audited-FY2026`. Von der Prognose abweichende Ist-Werte werden als darunter, innerhalb, darüber oder Punktabweichung ausgewiesen.
4. **Lernbasis:** Die Prognosen werden nicht rückwirkend der Entwicklung angepasst. Später können echte Vorhersagegüte und Modellfehler gemessen werden. Ein automatisches selbstlernendes Kursmodell oder eine zuverlässige Trefferquote existieren **noch nicht**.

## Erste, tatsächlich auf Quellen gestützte Checkpoints

| Emittent / ISIN | FY2026 Managementprognose, ursprünglich veröffentlicht | Protokolliert | Spätere Messgröße |
|---|---|---|---|
| Eaton / IE00B8KQN827 | US-GAAP verwässertes EPS **10,39–10,49 USD** (3.11.2026) | 7.11.2026 | FY2026 `us-gaap:EarningsPerShareDiluted` |
| Vertiv / US92537N1081 | Konzernumsatz **14,45–14,85 Mrd. USD** (28.10.2026) | 7.11.2026 | FY2026 `us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax` |
| Vertiv / US92537N1081 | US-GAAP verwässertes EPS **6,29 USD als Mittelpunkt** (28.10.2026) | 7.11.2026 | FY2026 `us-gaap:EarningsPerShareDiluted` |

Primärquellen: [Eaton Ergebnis Q3 2026](https://www.eaton.com/us/en-us/company/news-insights/news-releases/2026/eaton-reports-record-third-quarter-2026-results.html) und [Vertiv Ergebnis Q3 2026](https://investors.vertiv.com/news/news-details/2026/Vertiv-Reports-Strong-Third-Quarter-2026-with-Net-Sales-Growth-of-61-Organic-Orders-Growth-over-100-and-Diluted-EPS-Growth-of-91-Adjusted-Diluted-EPS-Growth-of-78-Raises-Full-Year-2026-Guidance-Across-All-Key-Metrics/default.aspx). Die Ist-Daten kommen ausschließlich über die SEC-Emittentenkennungen mit datierten Quellen und passenden Jahres-/Währungseinheiten.

**Wichtig:** Die Vertiv-Angabe von 6,29 USD ist nur ein **Mittelpunkt**. Deshalb wird später eine prozentuale Punktabweichung gemessen; eine fiktive Prognosespanne wird nicht erzeugt. `adjustedEPS` (Non-GAAP) und die Umsatzwachstumsgröße `organicGrowth` werden nicht mit den GAAP-Istwerten verwechselt.

## Bedienoberfläche

Die neue Übersicht erscheint **innerhalb des bestehenden Kapitalradars** und bei jeder Aktie in der Detailansicht. Es kommt **keine weitere Hauptnavigation** hinzu. Alle Aktien der Masterliste bleiben enthalten; fehlende Guidance wird neutral als Datenlücke gekennzeichnet. Die nächste bestätigte Earnings-Veröffentlichung hat Vorrang, wenn sie aus einem frischen, zugeordneten offiziellen IR-Kalender stammt.

Die reverse DCF-Sensitivität von 0.16.0 ist ein zusätzlicher Hinweis darauf, welche mehrjährigen FCF-Erwartungen der Börsenkurs **unter einer expliziten Rechenannahme** impliziert. Sie wird nicht zur Prognose einer Gewinnwahrscheinlichkeit, zu einem Zielkurs oder zu einer Orderentscheidung erklärt.

## Unveränderte Sicherheit

`tradeApproved:false`, `entryZone:null`. Dieser Monitor prüft künftige Unternehmenszahlen, **nicht** zukünftige Börsenkurse. Keine simulierten oder echten Orders werden ausgelöst. Die strengen UNITY-5.1-Earnings-, Preis-, Risiko- und Bewertungs-Vetos bleiben unverändert. Kein Veröffentlichungsschritt enthält persönliche Depotstände, Passwortdaten oder pCloud-Zugangsdaten.

## Nächste sinnvolle Stufe

Automatischer, nicht-destruktiver Vergleich mehrerer **zeitlich aufeinanderfolgender** offizieller Guidance-Snapshots, darunter Gewinn-/Umsatzrevisionen, Auftragseingang, Backlog und Kapitalinvestitionen – jeweils nur bei gleicher Einheit/Periode/Accounting-Basis. Erst nach genügend nachprüfbaren Prognosen kann eine echte Güte-/Kalibrierungsprüfung für eigene UNITY-Hypothesen eingeführt werden.
