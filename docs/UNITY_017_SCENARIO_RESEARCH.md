# UNITY 0.17 – Bewertungs-Sensitivität für Eaton und Vertiv

Stand 07.11.2026. **Entwicklungsentwurf, keine freigegebene Unternehmensbewertung oder Kaufzone.** Keine Änderung an realen Orders, Testdepot oder archivierten Nutzerentscheidungen.

## Tatsächliche und hypothetische Eingaben streng trennen

Die SEC-Jahresdaten FY2025 liefern OCF, Investitionsausgaben und Stichtags-Aktienzahl. Hieraus berechnet UNITY für den reinen Modellvergleich `(OCF – CapEx) / Stichtagsaktien`. Das ist **kein vollständig berechneter FCFE**, weil unter anderem Nettokreditaufnahme, künftige Finanzierungsstruktur und unternehmensspezifische Anpassungen im Modell nicht vollständig abgebildet werden.

Die **unauditierten 10-Q-Quartalsbilanzen per 30.09.2026** liefern gesondert Liquiditäts- und Finanzschuldenstand sowie operative Mittelzuflüsse und CapEx der ersten neun Monate. Diese 9-Monatszahlen werden nicht auf zwölf Monate hochgerechnet und **nicht** mit FY2025 als ein gemeinsamer Cashflow-Zeitraum vermischt.

Die drei Szenarien dienen allein als **Sensitivity / Rechentest**, nicht als Prognose:

| Modell | FCF-Proxy-Wachstum pro Jahr (5 Jahre) | Eigenkapital-Abzinsung | Endwachstum |
| --- | ---: | ---: | ---: |
| Vorsichtig | −5 % | 12 % | 1 % |
| Mittlere Sensitivität | +5 % | 10 % | 2 % |
| Hohes Wachstum | +15 % | 8 % | 3 % |

**Alle neun Parameter sind ausdrücklich hypothetisch.** Weder diese mehrjährigen Raten noch die Kapitalkosten wurden als spezifische Emittentenprognose unabhängig bestätigt. Die Werte dürfen **nicht** als professionelle Fair-Value-Spanne, Kursziel, Kaufbereich, günstige Bewertung oder wahrscheinliche Zukunftsentwicklung bezeichnet werden. Sie fließen nicht in den Investment-Score oder die Orderautomatik.

## Rechenbeispiele aus SEC-Jahreswerten FY2025

| Kennzahl | Eaton (ETN) | Vertiv (VRT) |
| --- | ---: | ---: |
| OCF minus CapEx FY2025 | 3.553 Mio. USD | 1.893,8 Mio. USD |
| Stichtagsaktien FY2025 | 387,9 Mio. | 382,55368 Mio. |
| FY2025 Cashflow-Proxy je Aktie | 9,16 USD | 4,95 USD |
| Modellbarwert vorsichtig | 65,64 USD | 35,47 USD |
| Modellbarwert mittlere Sensitivität | 132,47 USD | 71,59 USD |
| Modellbarwert hohes Wachstum | 313,80 USD | 169,60 USD |
| Ausgewiesene Finanzschulden Q3 2026 (Bilanzkomponenten) | 20.106 Mio. USD | 2.928,5 Mio. USD |
| Cash Q3 2026 | 528 Mio. USD | 3.512,9 Mio. USD |

**Die drei Modellbarwerte sind keine fairen Aktienwerte.** Das Modell startet beim Cashflow 2025 und bildet weder Übernahmen noch neue Aktienzahl, Verschuldung, Aktienrückkäufe oder künftigen Zahlungsstrom verlässlich ab. Das Szenario soll sichtbar machen, wie stark ein Barwert auf Annahmen reagiert.

**Quellen:**
- [Eaton SEC 10-Q, Q3 2026](https://www.sec.gov/Archives/edgar/data/1551182/000155118226000040/etn-20260930.htm)
- [Vertiv SEC 10-Q, Q3 2026](https://www.sec.gov/Archives/edgar/data/1674101/000162828026067893/vrt-20260930.htm)
- [Eaton SEC XBRL CompanyFacts, FY2025](https://data.sec.gov/api/xbrl/companyfacts/CIK0001551182.json)
- [Vertiv SEC XBRL CompanyFacts, FY2025](https://data.sec.gov/api/xbrl/companyfacts/CIK0001674101.json)

## Vor einer echten UNITY-5.1-Bewertung noch erforderlich

1. Finanzierungs- und Akquisitionseffekte sauber auf den **normalisierten** zukünftigen Cashflow abbilden. Für Eaton wegen der 2026 gestiegenen Verschuldung besonders wichtig.
2. CapEx, Working Capital, künftige Aktienzahl, Verschuldung, Liquidität, Zinslast und Risikotragfähigkeit fortschreiben; Quellen und Stichtage dokumentieren. 2025 und 2026 nicht ohne Überleitungsrechnung vermischen.
3. Wachstums-, Kapitalkosten- und Endwertannahmen der drei echten Szenarien als *unabhängige Analystenhypothesen* begründen, datieren und extern plausibilisieren. Keine Vergabe einer unbelegten automatischen Prüfplakette.
4. DCF und konservative Multiplikatoren-/Peer-Bewertung mit aktuellem datiertem Börsenkurs und Währung vergleichen. Sicherheitsmarge, Chance/Risiko, Earnings-Termin und harte Vetos **separat** nach UNITY 5.1 abprüfen.
5. Prognosezeitpunkt, Alternativen, Falsifikationskriterium und spätere Ist-Ergebnisse im Decision Ledger dokumentieren und Modellqualität nachprüfen.

**Implementiert:** `unityPilotScenarioSensitivity` mit drei getrennten, im Code offengelegten Rechenparametern, Quellen- und Periodenprüfungen, Ausgabe nur als `sensitivity-only`, `fairValue=null`, `entryZone=null`, `tradeApproved=false`. Keine erfundenen offiziellen Annahmen in `data/valuation-assumptions.json`.

**Tests:** Die Szenarien werden in `tests/pilot-scenario-sensitivity.cjs` auf mathematische Ergebnisse, Quelle/ISIN, Stichtage, fehlende Angaben, veraltete Kursreferenzen, Quartals-/Jahresabgrenzung und Nichtausführbarkeit geprüft. Workflow `.github/workflows/unity-017-valuation.yml` prüft im GitHub-PR die bestehenden und neuen Testmodule. Eine **erfolgreiche GitHub-CI-Ausführung oder iPhone-Abnahme ist noch nicht bestätigt**.
