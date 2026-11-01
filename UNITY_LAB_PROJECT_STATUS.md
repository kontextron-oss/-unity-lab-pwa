# UNITY LAB – Projektstand 1.4

**Stand:** 1. November 2026  
**Repository:** kontextron-oss/-unity-lab-pwa  
**Technische Basis:** UNITY 0.12-Lernprotokoll veröffentlicht und geprüft

## Verbindliche Neuausrichtung

UNITY Lab wird als automatische Analyse- und Entscheidungshilfe weiterentwickelt. Der Nutzer soll keine Fundamentaldaten, Thesen, Kapitalflüsse oder Strategiegewichte manuell erfassen müssen.

Die bisherige Vollsperre wird ersetzt: Ein fehlender Datenpunkt darf nicht jede Aktie pauschal auf „kein Signal“ setzen. Stattdessen gelten drei getrennte Entscheidungsebenen:

1. **Technischer Befund** – Trend, Rücksetzer, RSI, gleitende Durchschnitte, Kursdatenqualität.
2. **Kaufkandidat** – Rangfolge nach Bewertungsabschlag, Qualität, Risiko, Timing und Alternativen; mit messbarer Kaufzone oder Bedingung.
3. **Operative Freigabe** – erst bei hinreichend aktuellen Kursen, bestätigten Ereignissen und belegter Fundamentaldatenlage.

Jede Aktie erhält künftig eine verständliche Aussage: Kaufen, Teilkauf, Kauf bei Bedingung, Halten, Reduzieren, Ausschließen oder Datenprüfung. Gibt es keinen Kaufkandidaten, nennt die App die beste Alternative, die konkrete Ursache und den Preis- oder Daten-Trigger für eine Änderung.

## Verfügbare Datenquellen ohne laufende Lizenzkosten

- Bestehender verzögerter Tageskurs-Snapshot für Technik, Rücksetzer und Vergleich.
- Öffentliche Unternehmens- und Investor-Relations-Meldungen für Earnings, Guidance und Ereignisse.
- Strukturierte SEC-Unternehmensdaten für US-Werte.
- ESEF-/Inline-XBRL-Berichte für geeignete europäische Emittenten.
- Öffentlich sichtbare Analystenkonsens- oder Ratingangaben ausschließlich als datierte, sekundäre Einordnung; sie dürfen keine Entscheidung allein bestimmen.

## Umgesetzt: UNITY 0.12-Lernprotokoll

- Jede archivierte Analyse speichert Kursquelle, Zeitstempel, Kandidatenstatus, Kaufbedingung und Index.
- Das Lernprotokoll vergleicht spätere Referenzkurse transparent mit dem Snapshot; die Bewertung wird nicht rückwirkend verändert.
- Datenstand und Quellenlage werden direkt neben dem Kandidatenstatus angezeigt.
- Sicherungen verwenden Schema 3 und enthalten auch die fiktive Kapitalführung; ältere Sicherungen bleiben importierbar.

## Umgesetzt: UNITY 0.11-Kandidatenmodus

- Automatischer technischer Kaufkandidat bei positivem SMA50/SMA200-Trend, RSI zwischen 40 und 68 und definierter Rücksetzerzone.
- Konkrete Kaufzone ±2 % um den SMA50; oberhalb der Zone erscheint „Kauf bei Rücksetzer“ statt eines pauschalen Nein.
- Kandidatenindex aus Trendstruktur und verfügbaren automatischen Berichtskennzahlen; fehlende Fundamentaldaten werden als Datenlage erklärt, nicht als versteckter Negativwert.
- Startseite und Analyseansicht zeigen Kandidaten getrennt von der vollständigen operativen Freigabe.
- Analyse-Snapshots speichern zusätzlich den Kandidatenstatus, die Kaufbedingung und den Index.
- Automatischer Test für Trend, Rücksetzerzone und Datenlückentrennung ist Teil der CI.

## Nächster Entwicklungsabschnitt: UNITY 0.12

1. Veto-Logik in Datenlücke, Warnung und harten Ausschlussgrund aufteilen.
2. Automatische Kandidatenbewertung aus vorhandenen Kurs- und Berichtsquellen einführen.
3. Kaufzonen, Teilkaufzonen, Stop- und Ausstiegstrigger ausgeben.
4. Kandidaten in einer Rangfolge „beste Kapitalverwendung heute“ vergleichen.
5. Quellen, Datum und Datenqualität direkt an jeder Entscheidung zeigen.
6. Empfehlung und spätere Entwicklung als unveränderlichen Snapshot vergleichen.

## Bestehender stabiler Funktionsumfang

- Local-First PWA mit Offline-Cache, Export und lokalem Simulationsdepot.
- Simulierte Käufe, Verkäufe, Teilverkäufe, Storno und Gebühren.
- Kaufgebühren erhöhen den Einstand; Verkaufsgebühren senken Nettoerlös und realisierten Erfolg.
- Forschungseingaben sind aus der sichtbaren Bedienung entfernt.

Alle Transaktionen bleiben Simulationen. UNITY Lab sendet keine Orders an Broker und führt keine Echtgeldgeschäfte aus.
