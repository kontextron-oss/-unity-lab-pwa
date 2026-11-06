# UNITY 0.15.3.9 – Bewertungsvorbereitung, verifizierte Management-Guidance und Szenarioverfahren

Stand: 6. November 2026. Die bereits verfügbare (und unverändert gesicherte) Masterliste erhält ein **einheitliches, nach ISIN gebundenes Bewertungssystem**; keinerlei Benutzerpositionen, Depotaufträge, Wechselkurskonten oder pCloud-Daten werden an GitHub übermittelt.

## 1. Quellennachweise, getrennte Methoden

- Konsolidierte Jahreszahlen: geprüfte US-GAAP/SEC-XBRL- oder IFRS-/Emittenten-Berichte. Fünf Kernkennzahlen, aktuelle und frühere Geschäftsjahre und entsprechende datierte Quelleneinträge.
- Weitere SEC-Fakten: `sharesOutstanding` **am Bilanzstichtag**, nicht `sharesDiluted` (verwässerter Jahresdurchschnitt), `capitalExpenditure`, `cashAndEquivalents`, sowie einzeln ausgewiesene kurzfristige und langfristige Schuldenkomponenten.
- **Vollständige Nettoverschuldung** bleibt unbestätigt, solange nicht sämtliche Finanzverbindlichkeiten in der Bilanz abgeglichen sind. Die Komponenten dürfen nicht kommentarlos addiert oder als Total ausgegeben werden.
- `data/issuer-guidance.json` enthält überprüfte FY2026-Managementprognosen von ABB (Q3, 20.10.2026), Vertiv (Q3, 28.10.2026) und Eaton (Q3, 03.11.2026); Quellen stehen je Emittent im Datensatz. GAAP-EPS und *bereinigte* Non-GAAP-Zahlen bleiben getrennt. Unternehmensprognosen sind keine unabhängigen Zukunftsprognosen.
- Prognose-Abruf erfolgt als **redaktionell geprüfter Snapshot**, **nicht** als behaupteter vollautomatischer IR-Ausleser. Bei Alter über 180 Tagen oder Quellenkonflikt verfällt der Freigabestatus.

## 2. Szenariomodell (nach expliziter Prüfung)

Der neue reine Rechner `unityScenarioValuation(s)` verwendet eine **illustrative Equity-Free-Cashflow-Näherung**: den belegten operativen Jahres-Cashflow abzüglich belegter Investitionsausgaben je stichtagsbezogener Aktie. Diese Größe kann von echtem Free Cashflow to Equity abweichen, insbesondere wegen Zinsklassifizierung, Schuldentilgung, Working Capital oder Aktienemissionen.

Für die Jahre 1 bis N werden jeweils ausdrücklich überprüfte drei Wachstums-/Kapitalkostenszenarien berechnet, mit `N` zwischen 3 und 8. Am Ende folgt eine Endwertannahme (Terminal Growth niedriger als Eigenkapitalkosten). Es werden Gegenwartswerte addiert. **Keine verborgenen Standardannahmen.**

Erforderliche Prüfschritte vor einer Berechnung:

1. Zusammengehörige fünf Primärkennzahlen und positiver OCF-Capex, **richtige, belegte Stichtagsaktienzahl**.
2. Aktuelle, ISIN-identische Unternehmens-Guidance aus Originalquelle.
3. Dokumentierter unabhängiger Review der Analysten-Szenarien, mit Wachstum, Diskontsatz, Endwertwachstum und Beschreibung jeweils für drei Fälle (vorsichtig/basis/optimistisch).
4. Vollständiger, perioden-/ISIN-identischer Bilanz- und Verschuldungsreview mit Bruttoschulden, Liquidität und gesonderter Freigabe des OCF-/Zinsklassifizierungsansatzes.
5. Eine explizite Sicherheitsmarge von 15–50 %. Für eine kursbezogene Zone außerdem aktueller Börsenkurs und datumsgleicher FX-Abgleich.

Das Band ist ein **hypothetisches Modellintervall**, **kein wissenschaftlich gesicherter fairer Marktwert**. Die weitere strenge UNITY-5.1-Veto-/Earnings-/Marktregime-Entscheidung bleibt davon unabhängig.

## 3. Offener Status

`data/valuation-assumptions.json` enthält **absichtlich noch keine genehmigten 3–8-Jahres-Wachstums-, Kapital- und Risikohypothesen**. Deshalb stellt die App keine behauptete Fair-Value-Zahl und keine operative Einstiegszone dar. Das Modell ist sofort nach einer begründeten Emittentenprüfung einsetzbar und würde höchstens eine **modellhafte, nicht zum Handel freigegebene Preiszone** ausgeben.

Ungeprüfte Daten/ungünstige Nachrichten werden nicht als negative Unternehmensqualität imputiert. Mangelhafte Daten bleiben als Datenlücke kenntlich. Unter keinen Umständen wird auf Basis des Rechners ein echter oder simulierter Kauf ausgelöst.

## 4. PC/iPhone/Cloud

Alle Ausgaben sind JSON-kompatible, reproduzierbare, quellengebundene Snapshots; sie eignen sich für die später geplante lokale PC-Version und private pCloud-Austauschschicht. Der bestehende manuelle verschlüsselte Austausch bleibt unverändert. Es wird **kein** privater Aktienbestand veröffentlicht.
