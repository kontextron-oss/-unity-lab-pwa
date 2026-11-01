# UNITY LAB – Projektstand 1.1

**Stand:** 1. November 2026  
**Repository:** kontextron-oss/-unity-lab-pwa  
**Veröffentlichungsstand:** 0.10.3

## Aktuell umgesetzt
- Startseite mit Aktienübersicht, technischer Einordnung und direktem Übergang zur UNITY-Analyse.
- Simulationsdepot mit datierten Käufen, Verkäufen, Teilverkäufen, Storno und unveränderlicher Historie.
- Gebühren pro Kauf oder Verkauf in EUR. Kaufgebühren erhöhen den Einstand; Verkaufsgebühren mindern den Nettoerlös und den realisierten Erfolg.
- Standardwert von 1,00 EUR pro Simulation, frei anpassbar für den genutzten Broker.
- Forschungsbereich aus der sichtbaren Navigation entfernt. Die Analyse zeigt automatisch verfügbare Kurs- und Berichtsquellen sowie offene Datenprüfungen.
- Fehlerkorrektur für die Score-Formatierung in analysis.js.
- Service Worker Cache 0.10.3 enthält App-Module und die automatischen Markt-, Fundamentaldaten-, FX- und Intraday-Dateien für den Offline-Start.
- Cache-Bereinigung ist auf UNITY-Lab-Caches begrenzt.

## Noch offen
- Vollständig geprüfte aktuelle Fundamentaldaten, Earnings und verifizierte Handelskurse für belastbare operative Kauf- oder Verkaufssignale.
- Automatische qualitative Unternehmensanalyse mit Quellenprüfung.
- Spread, Steuern und tatsächliche Fremdwährungskosten als getrennte Bestandteile der Simulation.
- Auswertung der archivierten Entscheidungen gegen spätere Kursverläufe.
- pCloud-Synchronisation.

## Verbindlicher Bedienablauf
1. Aktie auswählen.
2. UNITY-Analyse und Datenlage ansehen.
3. Bei eigener Entscheidung einen simulierten Kauf oder Verkauf erfassen.
4. Stückzahl und Gebühr prüfen; die App berechnet Einstand oder Nettoerlös.
5. Ergebnis und Entscheidung später im Protokoll nachverfolgen.

Alle Transaktionen bleiben Simulationen. Die App sendet keine Orders an Broker und ist kein verbundenes Echtgelddepot.
