# UNITY LAB – Primärquellen-Adapter 0.15.3.7 (Teil 1)

Stand 6. November 2026. **Ziel:** Die gleiche automatische Quelle-Prüfstrecke soll zusätzliche reale Unternehmenskennzahlen für die drei bisher eingeschränkt versorgten europäischen Pilotaktien liefern.

## Neu im geplanten, wöchentlich zweimal ausgeführten Berichtsabruf

- **ABB (CH0012221716):** verifizierbarer offizieller Annual-Reporting-Suite-Portalverweis für FY2025, US-GAAP, Stichtag 31.12.2025. Bereits vorhandene primäre Veröffentlichungsfakten bleiben erhalten.
- **Siemens Energy (DE000ENER6Y0):** zusätzlich zur vorhandenen Umsatz-/Ergebnis-/Cashflow-vor-Steuern-Meldung nun separat `orders` (Auftragseingang) und `orderBacklog` (Auftragsbestand) aus der offiziellen FY2025-Mitteilung; offizieller IFRS-Geschäftsbericht 2025 referenziert.
- **Infineon (DE0006231004):** zusätzlich `segmentResult` aus der offiziellen FY2025-Mitteilung, klar getrennt von `netIncome`; offizieller IFRS-Geschäftsbericht 2025 referenziert.

Alle Zahlen haben Quelle, Bezugsjahr und Währung. Der veröffentlichte Datensatz bleibt im bestehenden `data/fundamentals.json`-Format. Die bestehende Detailansicht kann zusätzliche veröffentlichte Kennzahlen automatisch anzeigen, da sie die Beleg-Fakten dynamisch durchläuft.

## Strenge Grenzen

Offizielle Geschäftsberichts-Links werden nur als `annualReport` mit `coreMetricsValidated=false` und `extractionStatus=not-machine-extracted` erfasst. Es ist **noch keine automatische Extraktion von Bilanzsumme, Eigenkapital, Jahresüberschuss und operativem Cashflow aus den PDF-Konzernabschlüssen**. Emittentenmeldungen sind keine vollständigen geprüften Konzernabschlusszahlen und dürfen die strenge UNITY-Orderfreigabe nicht umgehen. Besonders `segmentResult` von Infineon ist *nicht* `netIncome`; `freeCashFlowPreTax` ist *nicht* `operatingCashFlow`.

Die Daten stehen nur für Geschäftsjahr 2025; beim Erscheinen späterer Jahresabschlüsse müssen Quellen versioniert und periodengenau erweitert werden. Weder Kursfeed noch iPhone-/pCloud-Sicherung oder Depottransaktionen werden geändert.

## Abnahme

Offline-Parser-Tests müssen bekannte Zahlen und Einheiten unterscheiden, die Quellen- und Jahreszuordnung prüfen und unprüfbare Core-Metrics weiterhin als nicht verfügbar behandeln. Die GitHub-Workflow-Ausführung muss anschließend das automatisch erzeugte `data/fundamentals.json` aktualisieren. Live-Prüfung der Daten anschließend gesondert.
