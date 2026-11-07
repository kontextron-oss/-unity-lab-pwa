# UNITY 0.16.4 – Eigenes Prognosemodell und erster Lern-Benchmark

**Stand:** 7. November 2026. Diese Stufe ist ein transparenter, überprüfbarer Forschungstest. Die Unternehmensprognosen aus dem IR-Radar sind separat und werden nicht als UNITY-Eigenprognosen ausgegeben.

## 1. Tatsächlich unabhängige, vorab protokollierte Prognose

Für die vier US-GAAP-Kalenderjahresunternehmen **Quanta Services (PWR), GE Vernova (GEV), Vertiv (VRT) und Eaton (ETN)** registriert der SEC-Datenadapter einen **eigenen Umsatz-FY2026-Punktforecast**, bevor das betreffende Geschäftsjahr endet.

Eingaben: ausschließlich gleicher Emittent/CIK/ISIN, bereits veröffentlichter offizieller FY2024- und FY2025-Jahresumsatz, gleiche Währung USD, identisches US-GAAP-Umsatzkonzept. Aktuelle FY2026-Kursdaten, Managementprognosen und spätere FY2026-Ergebnisse sind ausdrücklich **nicht** Eingaben des Modells.

Die erste vorab feststehende, reproduzierbare Formel lautet:

```
historisches_wachstum = umsatz_fy2025 / umsatz_fy2024 - 1
prognose_wachstum = max(-20%, min(+25%, 0.5 * historisches_wachstum))
modell_umsatz_fy2026 = round_nearest_10m(umsatz_fy2025 * (1 + prognose_wachstum))
vergleich_ohne_wachstum = umsatz_fy2025
```

Dies ist eine vorsichtige **Momentum-Abschwächungs-Heuristik** und **kein trainiertes KI-Modell**, kein DCF und keine Aktienkursprognose. Frühindikatoren wie Backlog und Guidance sind noch nicht integriert. Gerade die starke Vertiv-Prognose des Unternehmens kann deutlich von dieser rein historischen Vergleichsrechnung abweichen. Ein Unterschied ist ein Forschungsanlass, kein Verkaufs-/Kaufsignal.

## 2. Nicht-destruktiver Ergebnisvergleich

- Öffentliche JSON-Datei: `data/unity-model-forecasts.json`.
- Automatisch neu erfasste Einträge: eigene ID, Modelversion, exakter ursprünglicher Registrierungszeitpunkt, Quellen-/Berichtsdatum, ISIN/CIK, Inputwerte, Formel, FY2026-Prognosewert und Fingerabdruck (SHA-256).
- Der Anfangszustand enthält **keinen** behaupteten Erfolg. Nach dem Merge schreibt der reguläre SEC-Abruf die vier neuen Prognosen und protokolliert sie **vor** FY2026-Abschluss am 31. Dezember 2026.
- Die Werte werden nicht nachträglich geändert. Eine spätere SEC-Nachmeldung wird als `revision-review` angezeigt und überschreibt den ersten tatsächlich festgehaltenen Istwert nicht.
- Beim späteren geprüften FY2026-SEC-Jahresumsatz: absoluter prozentualer Modellfehler versus Fehler der simplen **Umsatz-unverändert-Benchmark**; das Modell ist erst nützlich, wenn es die einfache Vergleichsregel nachweislich verbessert.
- Für neue Geschäftsjahre wird eine neue Modellprognose **angehängt**, niemals die Vorjahresprognose umgeschrieben. Für andere Fiskalkalender (z. B. September-Abschluss) braucht es eine eigene Periodenprüfung.

**Noch keine valide Prognosegüte:** `modelCalibrated:false`; bis mindestens **20** nachträglich objektiv messbaren Ergebnissen wird keine aggregierte Erfolgsquote veröffentlicht. Eine Beobachtung allein begründet keine statistische Sicherheit. Eine weitergehende unabhängige Walk-forward-Auswertung mit 5/20 Handelstagen ist als nächstes geplant, um die Lerndaten schneller zu vergrößern.

## 3. Anzeige & Trennung von Handel

In der bisherigen **Vorausschau** der Aktiendetailansicht und im Kapitalradar erscheint jeweils ein kompakt aufklappbarer Forschungsbereich: eigener Modellwert, dokumentierter Berechnungszeitpunkt, letzte Jahreszahlen, Nullwachstums-Vergleichswert, später tatsächlicher SEC-Istwert und objektiver Fehler.

Unverändert bleiben volle UNITY-Masterliste, Datenqualität-Gates, 5.1 Veto-Hierarchie, **keine** automatischen Käufe, Depot, Simulationsdepot, verschlüsselte iPhone-Austauschdatei und die spätere PC/pCloud-Architektur. Kein persönlicher Depotauszug wird auf GitHub gespeichert.

## 4. Nächste Schritte nach diesem Stand

1. Herausarbeiten der aus amtlichen Unternehmensquellen ableitbaren Änderungen bei Guidance, Auftragsbestand, Cashflow und Prognosekonsens.
2. Versioniertes kombiniertes Modell entwickeln – aber erst, wenn es in einem historischen **zeitgerechten Walk-forward-Test** messbar besser als die schlichte Vergleichsmethode ist.
3. Separates 5-/20-Handelstage-Preisentscheidungsprotokoll mit Referenzkurs, Börsenplatz, Kosten/Spreads, neutraler Benchmark, unverändertem Signal und späteren Prüfungen.
4. Keine Live-Handelsfreigabe ohne verifizierten aktuellen Earnings-Termin, Marktregime, Risikokriterien und geprüfte Bewertung; Modellscore niemals alleinige Entscheidung.
