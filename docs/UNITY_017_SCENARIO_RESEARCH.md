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

## Echter rollierender Cashflow: Oktober 2025 bis September 2026

Für eine aktuellere historische Grundlage gibt UNITY ab UNITY 0.17 zusätzlich den **TTM-Cashflow** aus, der für die beiden Pilotunternehmen aus **drei klar datierten Berichtsblöcken** zusammengestellt wird:

`TTM = FY2025 − 9M2025 + 9M2026`

*Beträge in Mio. USD, operativer Cashflow (OCF), Sachinvestitionen (CapEx) und OCF − CapEx.*

| Unternehmen | FY2025 OCF / CapEx | 9M2025 OCF / CapEx | 9M2026 OCF / CapEx | TTM OCF | TTM CapEx | TTM FCF-Proxy |
|---|---:|---:|---:|---:|---:|---:|
| Eaton | 4.472 / 919 | 2.507 / 527 | 2.943 / 721 | 4.908 | 1.113 | **3.795** |
| Vertiv | 2.113,8 / 220 | 1.108,9 / 126,7 | 2.660,6 / 425 | 3.665,5 | 518,3 | **3.147,2** |

Die Vergleichszahlen 9M2025 und 9M2026 stehen jeweils **im selben offiziellen SEC-10-Q** und sind damit dieselbe Art Cashflow-Periode. FY2025 stammt aus den SEC-Finanzberichten. Diese Überleitung ist **keine Hochrechnung**, sondern ersetzt den alten Oktober-Dezember-2025-Anteil durch die gemeldeten Januar-September-2026-Werte.

Die Kennzahlen bleiben historische, nicht normalisierte Istwerte. Die Wirkung von 2026er Übernahmen, Finanzierung, Working Capital und künftigem CapEx ist **nicht unabhängig bereinigt**. Bei Vertiv sind in der CapEx-Zeile nur Sachinvestitionen enthalten; separat ausgewiesene aktivierte Softwareinvestitionen von 4,7 Mio. USD (9M2025) und 5,3 Mio. USD (9M2026) sind nicht hinzuaddiert, um die dargestellte Reihe konsistent mit der 2025er FY-CapEx-Quelle zu halten. Ein vollständig normalisierter künftiger FCFE folgt hieraus nicht.

Der historische TTM-Wert wird **nicht** stillschweigend als Cashflow-Prognose in die drei Sensitivitäten übernommen und gibt weder einen fairen Wert noch eine Kaufzone frei. Die bereits bestehenden hypothetischen Rechenparameter bleiben getrennt. Die neue Funktion heißt `unityPilotTrailingCashFlow` und ist über `unityPilotTrailingCashFlowPanel` mit prüfbaren Berichtsbausteinen sichtbar. Neue Regressionstests: `tests/pilot-ttm-cashflow.cjs`.

[SEC Eaton Q3 2026 mit Vergleichszahlen](https://www.sec.gov/Archives/edgar/data/1551182/000155118226000040/etn-20260930.htm) · [SEC Vertiv Q3 2026 mit Vergleichszahlen](https://www.sec.gov/Archives/edgar/data/1674101/000162828026067893/vrt-20260930.htm).

## Quellengebundene Normalisierungs-Prüfung: noch kein normalisierter FCF

Das neue Modul `unityPilotNormalizationReview` prüft zusätzliche **9M2026/9M2025**-Informationen direkt gegen die identische SEC-10-Q-Quelle; es trennt Cashflow-Gattungen und verhindert rechnerisch unbelegte FCF-„Verbesserungen“.

| Gemeldete Größe (Mio. USD) | Eaton 9M2026 | Eaton 9M2025 | Vertiv 9M2026 | Vertiv 9M2025 | Einordnung |
| --- | ---: | ---: | ---: | ---: | --- |
| Working-Capital-Effekt | −1.050 | −1.313 | +540,5 | −166,7 | Eaton: gesamte Working-Capital-Veränderung; Vertiv: **Trade Working Capital** aus Managementdiskussion, also nicht zwischen Unternehmen direkt vergleichbar |
| Nettozahlung für Unternehmenskäufe | 11.079 | 1.504 | 278,1 | 195,7 | **Investitions-Cashflow**: nicht vom operativen Cashflow abziehen und nicht als „OCF-Sondereffekt“ wieder hinzuaddieren |
| Erhaltene Kreditmittel (nicht Nettoschuldenstand) | 9.871 | 1.058 | nicht in diesem Pilot verglichen | nicht in diesem Pilot verglichen | **Finanzierungs-Cashflow**, keine operative Einnahme |
| Gesondert aktivierte Software | nicht als Vergleich hier erfasst | – | 5,3 | 4,7 | Vertiv: separat von Sachinvestitionen ausgewiesen; zusätzlicher Reinvestitionsaspekt, nicht automatisch in altem FY2025-CapEx-Proxy enthalten |

Die Eaton-Unternehmensmeldung nennt außerdem einen ungefähren **FY2026-Sachinvestitions-Ausblick von 1.150 Mio. USD**. Dies ist keine geprüfte Istzahl und **wird nicht** zur Berechnung von TTM oder Fair Value benutzt.

**Zwingende Konsequenz:** Insbesondere der positive Trade-Working-Capital-Effekt bei Vertiv darf nicht als für alle künftigen Jahre garantiert gelten. Ebenso ist Eatons hohe Akquisitionsausgabe **kein** Beweis, dass derselbe Betrag vom wiederkehrenden FCF abzuziehen sei. Beide Effekte werden als belegte Risiko-/Prüfhinweise angezeigt, nicht als mechanischer Bereinigungssatz.

Fünf Beleglücken werden vor einer tatsächlichen normalisierten Mehrjahresbewertung angezeigt: (1) eigenständiger zukünftiger Cashflow der übernommenen Unternehmen, (2) nachhaltig vs. temporär beeinflusstes Working Capital, (3) Erhaltungs- und Wachstumscapex, (4) zukünftige Zins-/Steuer-/Refinanzierungseffekte, (5) Aktienzahl, Verwässerung und mehrjähriger FCF. Ohne deren eigenständige Verifikation bleibt **`normalizedTTMFcf=null`**, **`fairValue=null`**, **`entryZone=null`** und **`tradeApproved=false`**.

Neue Datei: `data/normalization-evidence.json`; neue Tests: `tests/pilot-normalization-audit.cjs`. SEC-Originalquellen für Zahlen und Definitionen: [Eaton 10-Q](https://www.sec.gov/Archives/edgar/data/1551182/000155118226000040/etn-20260930.htm) und [Vertiv 10-Q](https://www.sec.gov/Archives/edgar/data/1674101/000162828026067893/vrt-20260930.htm).

## Tatsächliche Nettozinslast und hypothetische Zinssensitivität (November 2026)

Die separate Datei `data/financing-stress-evidence.json` erfasst die **historischen SEC-Nettozinsaufwände** für die 9M- und Q3-Zeiträume. Diese Größe ist **nicht** gleich bar gezahlten Zinsen: Sie umfasst auch verrechnete Zinserträge und nicht zwangsläufig die tatsächliche Refinanzierungsrate.

| Istkennzahl (Mio. USD) | Eaton 2026 | Eaton 2025 | Vertiv 2026 | Vertiv 2025 |
| --- | ---: | ---: | ---: | ---: |
| Nettozinsaufwand Q3 | 198 | 67 | 6,4 | 22,8 |
| Nettozinsaufwand 9M | 505 | 171 | 19,4 | 69,4 |

Die 9M-Nettozinslast hat bei **Eaton um 334 Mio. USD zugenommen**, bei **Vertiv um 50 Mio. USD abgenommen**. Gleichzeitig beträgt die **ausgewiesene bilanzielle Finanzschuld** am 30. September 2026 etwa 20.106 Mio. USD (Eaton) bzw. 2.928,5 Mio. USD (Vertiv). Aus dem **Saldo Bilanzschulden minus Cash** ergibt sich bei Vertiv ein negativer Wert (mehr Cash als diese abgegrenzten Schulden). Es handelt sich nicht um eine vollständige, auf Leasing und alle Verbindlichkeiten ausgeweitete Nettoverschuldung.

**Nur als Extremannahme** rechnet `unityPilotFinancingStress` ein sofortiges vollständiges Neuverzinsen sämtlicher bilanziell erfassten Finanzschulden bei **+100 bzw. +200 Basispunkten**. Das soll die mögliche Zinssensitivität transparent machen, nicht die tatsächliche oder erwartete Refinanzierung abbilden.

| Modellstress: Zusatz-Zinslast vor Steuern, USD Mio./Jahr | Eaton | Vertiv |
| --- | ---: | ---: |
| +100 Basispunkte auf gesamte ausgewiesene Finanzschulden | 201,06 | 29,29 |
| +200 Basispunkte auf gesamte ausgewiesene Finanzschulden | 402,12 | 58,57 |

**Nicht enthalten:** Fälligkeitsprofil, bestehende Zinsbindung, Hedgekontrakte, künftige Rückzahlungen und Neuaufnahmen, Zinserträge, Steuerwirkung, Übernahmesynergien und vollständiger Cashflow-Zinsabgleich. Schon deshalb sind die Werte ausdrücklich **keine 2027er Zinsprognose**, sondern lediglich ein kontrafaktisches Stressmodell.

Das US-GAAP-OCF-basierte historische TTM-FCF-Konzept berücksichtigt die bereits verbuchten Finanzierungskosten über Unternehmensgewinn/operativen Cashflow. Die Stressbeiträge werden daher **nicht automatisch noch einmal vom TTM-FCF abgezogen**, um Doppelzählung und falsche scheinpräzise Kursziele zu verhindern.

Belege: [Eaton SEC 10-Q 2026-Q3](https://www.sec.gov/Archives/edgar/data/1551182/000155118226000040/etn-20260930.htm), [Vertiv SEC 10-Q 2026-Q3](https://www.sec.gov/Archives/edgar/data/1674101/000162828026067893/vrt-20260930.htm). Testdatei: `tests/pilot-financing-stress.cjs`.

**Ein wichtiger noch offener Engpass:** Aus dem EBIT, den gemeldeten Zinsen und den Akquisitionsausgaben folgt noch keine belastbare eigenständige Cashflow-Prognose des übernommenen Geschäfts. Diese benötigt eine überprüfbare pro-forma-Überleitung von Umsätzen, operativen Cashflows, erforderlichem CapEx und Finanzierung sowie die Prüfung der zeitlichen Integration.
