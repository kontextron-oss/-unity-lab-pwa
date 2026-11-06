# UNITY LAB 0.15.3.6 — Standardisierte Datenprüfung der gesamten Masterliste

Stand: 06.11.2026. Die Entwicklung ist ein eng begrenzter Ausbau der bereits vorhandenen `readiness-audit.js`-Diagnose. **Es ist keine neue Kauf-Engine und kein erneuter Import aller Aktiendaten.**

## Ein Datenschema für jede Aktie

`unityReadinessStandardDataset(list)` gibt einen JSON-serialisierbaren Snapshot mit `schemaVersion: 1`, `kind`, `total`, `counts` und `records` zurück. Pro Aktie enthält er:

- **Instrumentenidentität:** stabile lokale ID, ISIN, Ticker, Name, Börsenplatz, Kurswährung.
- **Datenprüfung:** `dataStatus` = `ready`, `incomplete`, `stale`, `conflict` oder `source-failed`; `technicalReady`, `sourceComplete`.
- **Einheitliche Nachweisfelder:** `quote`, `history`, `fx`, `filing`, `earnings`, `valuation`, `guidance`, `thesis`, `risks`, jeweils `status`, `label`, `detail`, `source`, `stamp`.
- **Getrennte Ursachen:** `missingKeys` enthält die nicht belegten Daten, `adverseSignals` die unabhängig festgestellten tatsächlich ungünstigen Bedingungen.
- **Sicherheit:** `tradeApproved:false` für jeden Snapshot. Eine Quellencheckliste kann niemals selbst eine Kauf- oder Testorder freigeben.

Alle aktiven Aktien werden nach demselben Schema geprüft; Kryptowährungen bleiben ihrem separaten Modell zugeordnet. Neu aufgenommene Aktien mit fehlender Quellenanbindung erscheinen als **unvollständig**, nicht als negatives Signal. Die vorhandene App zeigt bereits eine zusammengefasste Datenfreigabe und Einzeldetails; hinzu kommt eine einklappbare Übersicht für alle Aktien der Masterliste.

## Unverändert

Die vorhandene deterministische UNITY-Entscheidungs-Engine, Simulationsbuchungen, lokale IndexedDB, pCloud-Sicherungen und verschlüsselte Austauschdateien bleiben unverändert. Der neue Datensatz ist für die spätere PC-Version und eine ausdrücklich genehmigte private Synchronisation geeignet, **aber noch keine aktive PC- oder Cloud-Verbindung**.

## Prüfung

Automatisierte Szenarien müssen dokumentieren: vier europäische Pilotaktien, eine fünfte beliebig hinzugefügte Aktie, ISIN-Konflikt, fehlende Quelle, getrennte Negativsignale, JSON-Serialisierbarkeit, Ausblendung der Kryptowährungen, keine Handelsfreigabe sowie bestehende UI-/Versionskonventionen.

## Weiterhin offen

Vollständige strukturierte Fundamentaldaten, Ergebnis-/Guidance-Kalender und Kapitalflussbelege für sämtliche Unternehmen. Ein einheitliches Datenformat stellt fehlende Quellen **nicht** selbst her. Im nächsten Arbeitsschritt sind Quelladapter und Mappings nach Unternehmenskennung und Branche zu verbessern, anschließend ist die bestehende UNITY-Entscheidungslogik mit den gewonnenen Daten zu prüfen.
