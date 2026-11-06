# UNITY LAB – Übergabestand 06.11.2026

## Verbindliche Version
- Version: **0.14.2** (Hauptzweig `main`).
- GitHub-Änderungen: PR [#38](https://github.com/kontextron-oss/-unity-lab-pwa/pull/38) (Automationsoberfläche und Simulation) und PR [#39](https://github.com/kontextron-oss/-unity-lab-pwa/pull/39) (vorläufiger Gesamtdepotwert), beide in `main` übernommen.
- GitHub Actions: JavaScript-Validierung auf `main` für Commit `79504cbadabdb95daef1c3e14bb2d86816c550ed` erfolgreich. GitHub-Pages-Build und -Deployment für denselben Commit erfolgreich.
- Ob die aktualisierte PWA auf dem konkreten iPhone vollständig geladen und im Alltag fehlerfrei ist, muss noch praktisch kontrolliert werden.

## Funktionsumfang
- Kursübersicht, Watchlist, Einzelanalysen und mehrstufige UNITY-Entscheidungslogik.
- Lokales **Simulationsdepot** mit Cash, Käufen, Verkäufen und Positionen.
- Separate stets sichtbare Verwaltung von fiktiven automatischen Kauf- und Verkaufsaufträgen; Aufträge können gestoppt werden.
- Für fiktive Testkäufe kann die Allokation eingestellt werden, unter anderem 2 % des jeweils frei verfügbaren Simulationskapitals.
- Übersicht über aktive Simulationsaufträge, für automatische Testkäufe eingesetzten Betrag, automatische Testverkaufserlöse und verfügbares Simulationskapital; Markierungen an betroffenen Aktien.
- Zwei verschiedene Freigabemodi: technisches EOD-Signal und strengerer, von Fundamentals/Ereignissen abhängiger UNITY-Modus. Fehlende Daten können die strenge Freigabe blockieren.
- **Keine echten Orders**: weder Brokeranbindung noch autonome Hintergrundausführung. Automatische Testausführungen werden nur in geöffneter/aktualisierter PWA anhand verfügbarer Schlusskurse verarbeitet. Die simulierten Preise sind keine garantierten realen Ausführungspreise.
- Die Verkaufssimulation ist nicht mehr fälschlich von einem Kaufrücksetzersignal abhängig.
- Automatische Simulationen dürfen nicht rückwirkend aus einem Schlusskurs ausgeführt werden, dessen Datum am oder vor dem Auftragstag liegt.

## 0.14.2: Vorläufiger Depotstand
- Fehlende Kurs- oder EUR-FX-Daten für eine gehaltene Position führen nicht mehr zu einem leeren Hauptwert.
- Die große Zahl zeigt dann ausdrücklich den **vorläufigen** Gesamtwert: verfügbares Testkapital + Marktwert bewertbarer Positionen + für nicht bewertbare Positionen erfasster Einstand.
- Ursache und Name der nicht bewertbaren Position werden als Warnung angezeigt.
- `depotCapital().total` bleibt bei unvollständiger Bewertung **NaN**; die Näherung wird allein als `displayTotal` angezeigt. Kein Verwechseln mit einem verifizierten aktuellen Gesamtmarktwert.
- Beispiel-Screenshot des Nutzers: 1.142,10 € frei + 3.859,86 € vorläufiger Depotwert = **5.001,96 €**, ausdrücklich nur vorläufig.
- Kein Löschen/Neuinstallieren der iPhone-PWA wegen lokal gespeicherter Nutzerdaten.

## Offene Aufgaben und nächste Prüfungen
1. Auf dem iPhone bestätigen, dass **0.14.2** nach Aktualisierung angezeigt wird; Zahl, Warnung, Positionen und Bedienbarkeit praktisch prüfen.
2. Für jede gehaltene Aktie den konkret fehlenden Kurs oder Wechselkurs identifizieren und die Datenverbindung nachvollziehbar reparieren.
3. Prüfen, warum im strengen Modus echte Datenfelder (strukturierte Fundamentals, Earnings, Guidance, Quelle) fehlen und wie viele Kandidaten deshalb blockiert werden. Nicht blind Veto-Regeln abschwächen.
4. Mit Testfällen prüfen, wie oft technische und strenge Signale jeweils zu einem fiktiven Kauf führen; separate Datenlücken-, Veto- und Chancenstatistik.
5. Simulierte Aufträge und Depotabgleich mit Eingangs-/Ausgangsbuchungen einschließlich Stornierung, app-Neustart und fehlerhaften Daten prüfen. Kritischer möglicher Verbesserungsbedarf: gemeinsame atomare Speicherung von Simulationsbuchung und Auftragsstatus, um Doppelbuchungen bei Fehlern zwischen zwei getrennten Schreibvorgängen zu verhindern.
6. Keine reale Broker-Automatik ohne ausdrücklich ausgewählte Integration, autorisierte Kontoverbindung, Laufzeitüberwachung und zusätzliche Sicherheitsprüfung.

## Weiterarbeit mit ChatGPT Work
Die bereits in GitHub übernommenen Änderungen müssen **nicht erneut in Work bestätigt** werden. Bei einer neuen Work-Sitzung dieses Dokument und den aktuellen Branch `main` als Ausgangspunkt verwenden, nicht alte ZIP-/Codekopien als neuesten Stand behandeln. Keine destruktive Migration und keine stillen Eingriffe in das lokale Testdepot.
