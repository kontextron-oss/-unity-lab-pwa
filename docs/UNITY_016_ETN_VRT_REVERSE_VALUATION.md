# UNITY 0.16.0 – Eaton und Vertiv: Reverse-DCF und FY2026 GAAP-KGV

**Stand:** 7. November 2026; Schlusskurs am 6. November 2026 (NYSE, USD). Nur Forschungs- und Qualitätskontrollzwecke; keinerlei Handelsfreigabe.

| Zahl | Eaton ETN | Vertiv VRT |
|---|---:|---:|
| ISIN | IE00B8KQN827 | US92537N1081 |
| Schlusskurs 06.11.2026 USD | 341,72 | 182,82 |
| US-GAAP FY2025 OCF−Capex Mio. USD | 3.553,0 | 1.893,8 |
| Aktien FY2025 am Bilanzstichtag Mio. | 387,9 | 382,554 |
| Historische FCF-Rendite bei Referenzkurs | 2,68 % | 2,71 % |
| Management-GAAP-EPS-Prognose FY2026 USD | 10,39–10,49 | 6,29 (Mittelpunkt) |
| Forward-GAAP-KGV FY2026 | 32,58–32,89 | 29,07 |
| Kursimplizites jährliches FCF-Wachstum bei 8 % Diskontsatz | 21,12 % | 20,86 % |
| Bei 10 % | 29,57 % | 29,29 % |
| Bei 12 % | 36,88 % | 36,58 % |

**Quellen:** Die 2025er Abschlusszahlen stehen einschließlich ursprünglicher Konzern-SEC-XBRL-URLs in `data/sec-fundamentals.json`. Managementprognosen für 2026 (3. November, Eaton, und 28. Oktober, Vertiv) stehen einschließlich IR-Originallink in `data/issuer-guidance.json`. Kursquellen: https://finance.yahoo.com/quote/ETN/history/ und https://stockanalysis.com/stocks/vrt/history/ (je 06.11.2026).

**Berechnungsannahmen:** Fünf zukünftige Cashflow-Perioden, 2 % Endwertwachstum, Eigenkapitalkosten nur als frei gewählte und **nicht unabhängig bestätigte** Sensitivitätsfälle 8/10/12 %. Das Modell nimmt den FY2025-Cashflow nach Investitionen als hypothetische Start-Runrate; er ist **keine** Prognose des FY2026 Cashflows und berücksichtigt Veränderungen im Jahr 2026 nicht. Insbesondere Vertivs FY2026-Prognose von *adjusted* FCF 2,6–2,8 Mrd. USD ist keine vergleichbare US-GAAP-OCF-minus-Capex-Zahl und wird nicht in die Basis eingefügt. Eaton hat 2026 wesentliche Übernahmen und höhere Finanzierungslasten. Die Reverse-DCF-Zahlen beschreiben **im aktuellen Kurs enthaltene Anforderungen**, nicht den fairen Wert.

**Entscheidungsregel:** Datenlücken, fehlendes aktuelles Fremdkapital-Risiko, nicht unabhängig geprüfte Mehrjahresprognosen, Earnings-Kalender und fehlende UNITY-5.1-Vetos bleiben Sperrgründe. `tradeApproved:false`, `entryZone:null`. Eine modellhafte Renditeannahme ist keine operative Kaufzone, auch nicht für Testkäufe. Der Rechner ist für jede Aktie in der vollständigen UNITY-Masterliste einheitlich; ohne Daten wird neutral blockiert. PC und pCloud erhalten keine neuen Datenabhängigkeiten.
