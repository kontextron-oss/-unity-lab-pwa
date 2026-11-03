## UNITY LAB 0.13.53 – Automatischer Entscheidungsmoderator

Die App zeigt nun im **Kapitalradar** eine transparente Priorisierung
aller aktiven Aktien. Höchstens vier Titel erscheinen als Favoriten für
die nächste **vertiefte Prüfung**; die komplette Masterliste bleibt
ausklappbar. Jede UNITY-Tiefenanalyse erhält die identische Prüfung.

Die drei Analyseebenen werden bewusst getrennt:
1. **Langfristig:** Primärquellen/Unternehmensqualität und verifizierte
   Bewertung aus dem bestehenden UNITY-Entscheidungsmodell;
   fehlende Ergebnisse nicht schätzen.
2. **Mittelfristig:** überprüfte Schlusskurse, SMA50/200, RSI,
   21/63/252-Handelstage, technische Einstiegskorridore.
3. **Kurzfristig:** ausschließlich beobachtete Preisreaktion,
   5-Tage-Momentum, Abstand zur SMA50, 20-Tage-Volatilität und
   Volumenrelativstärke, sofern 21 reale Volumenwerte verfügbar sind.

**Kein erfundenes Social-Media-Sentiment und keine erfundenen
institutionellen Mittelzuflüsse.** Neue amtliche Unternehmensmeldungen
gelten nur als neutraler Prüfhinweis. Stimmung und Aufmerksamkeit
werden ausdrücklich nicht verwechselt: Eine starke Überdehnung,
naher Earnings-Termin oder dokumentiertes RR unter 2:1 verhindert
eine positive technische Favorisierung. Echte Handelsorders sind
ausgeschlossen. Die bestehende UNITY-Tiefenanalyse bleibt die
entscheidende Instanz für vollständige Quellen-, Bewertungs- und
Risiko-Gates.

Die angezeigte **technische Prüfpriorität (0–100)** ist nur eine
Reihenfolge für weitergehende Untersuchungen, **keine**
Erfolgswahrscheinlichkeit, Anlageempfehlung oder ein Ersatz des
fundamentalen UNITY-Investmentscores. Fehlende Informationen senken
die Konfidenz und können eine Kaufentscheidung verhindern, sie
werden nicht als wirtschaftliche Schwäche ausgegeben.
Quellen- und Entscheidungsgrenzen sind in jeder Detailkarte sichtbar.

Hintergrund: ESMA 2024 fand für Social-Media-Sentiment hauptsächlich
kurzlebige Zusammenhänge mit Kursen
(https://www.esma.europa.eu/sites/default/files/2024-04/ESMA50-524821-3157_Risk_Article_Social_Media_sentiment_influence_on_EU_equity_prices.pdf).
Cookson et al. 2024 unterscheiden Aufmerksamkeit und Stimmung als
unterschiedliche Informationsdimensionen
(https://www.sciencedirect.com/science/article/pii/S0304405X2400093X).

## UNITY LAB 0.13.52 – Vergabeergebnisse fachlich eindeutig

EU-TED-Bekanntmachungen vom Typ `can-standard` sind nicht automatisch
erteilte Aufträge. Der Collector berücksichtigt jetzt zusätzlich das
amtliche eForms-Losresultat `BT-142-LotResult`. Nur `selec-w` kennzeichnet
einen für mindestens ein Los ausgewählten Gewinner. Alle anderen
Bekanntmachungen werden als **„Zuschlag nicht bestätigt“** geführt.
Genannte Auftragnehmer sind weiterhin **nicht** als UNITY-Emittenten
verifiziert. Die iPhone-Ansicht zeigt diesen Unterschied ausdrücklich,
listet vier der jüngsten Meldungen je Thema und bietet weitere Meldungen
zum Ausklappen an. Amtlich genannte Verfahrenswerte dürfen mehrere Lose
umfassen. Aus ihnen werden keine ETF-Zuflüsse, Anlegertransaktionen oder
Unternehmensumsätze berechnet.

## UNITY LAB 0.13.51 – Neues Kapital- und Ereignisradar (EU TED)

Die mobile App hat einen sechsten Hauptbereich **Kapitalradar**. Dort werden
veröffentlichte europäische Vergabebekanntmachungen (Tenders Electronic Daily,
TED Search API v3) als erste **amtliche Ereignisquelle** angezeigt, mit
eindeutiger ID, Veröffentlichungsdatum, Original-Link, Quelle, gegebenenfalls
publiziertem Verfahrenswert und eventuell genanntem Auftragnehmer.

- Erster automatischer Pilot: **Transformatoren (CPV 31170000)**,
  **Stromkabel (31320000)**, **Kühl-/Wärmetauschtechnik (42510000)**.
  Die Recherche umfasst ausschließlich eine **begrenzte Stichprobe**
  (je höchstens 50 jüngste Treffer innerhalb des Suchfensters,
  davon maximal 25 angezeigt), keine komplette Branchenstatistik.
- Die Datenpipeline `scripts/refresh_capital_events.py` läuft per
  `.github/workflows/capital-events.yml` werktäglich und veröffentlicht
  **nur amtliche Daten**, niemals private Aktienlisten, Käufe oder Token.
- Erst nach einer zweiten erfolgreichen Aktualisierung können neu entdeckte
  Meldungen als **„Neu erfasst“** erscheinen. Ein erstmaliger Komplettabruf
  wird nicht fälschlich als sprunghafter neuer Auftragseingang dargestellt.
- Bei Quellenfehlern bleiben frühere Daten intern als Archiv erhalten.
  Die App kennzeichnet veraltete Daten und zeigt sie **nicht als
  aktuelles Ereignissignal** an.
- **Kein Nachweis von Aktienkäufen, institutionellen Kapitalzuflüssen,
  einzelnen Unternehmensaufträgen oder neuen Umsätzen.**
  Beobachtete mögliche Branchenprofiteure werden ausschließlich als
  **Beobachtungsgruppe** genannt, ausdrücklich nicht als Auftragnehmer.
  Sämtliche Vergabewerte können mehrere Lose umfassen. Keine Addition
  zu angeblichen Investitionssummen.
- Daneben erscheint eine **Datenbereitschaftsübersicht der gesamten
  aktiven UNITY-Liste**: je Aktie prüfen, ob verlässliche Kursdaten,
  ein aktueller EU-Finanzberichts-Pilot und ein bestätigter nächster
  Earnings-Termin vorhanden sind. Fehlende Daten führen nicht zu
  künstlich schlechten Unternehmensscores.
- Der bisherige UNITY-Score und sämtliche simulierten Depottransaktionen
  bleiben unverändert. Die neue Ereignisquelle **gibt niemals direkt
  eine Kauf- oder Verkaufsentscheidung frei**. Weitere institutionelle
  Daten (SEC 13F, Stimmrechtsmitteilungen, ETF-Fondsflüsse) stehen als
  eigene spätere Ebene an; SEC-Direktzugriffe von GitHub sind aktuell
  nicht zuverlässig erreichbar.
- Verifizierte Quelle und CPV-Katalog:
  https://docs.ted.europa.eu/api/latest/search.html
  https://docs.ted.europa.eu/eforms/latest/reference/code-lists/cpv.html

## UNITY LAB 0.13.50 – Direkter pCloud-Upload: vorbereitete App-Schnittstelle

Die App hat nun einen getesteten **Ein-Klick-Upload-Client** (`pcloud-direct.js`).
Er sendet nach autorisiertem Login die aktuelle inkrementelle Sicherung
an eine HTTPS-Schnittstelle, überprüft den vom Server bestätigten pCloud-
Dateinamen, Dateigröße, Backup-ID und SHA-256-Hash und schreibt den lokalen
Sicherungs-Cursor **nur nach einer bestätigten Cloud-Speicherung** fort.
Ein fehlerhafter Upload, ein veralteter lokaler Stand oder ein nicht geprüftes
Serverergebnis wird ausdrücklich nicht als erfolgreiche Sicherung angezeigt.

**Wichtig:** Der Client ist aus Sicherheitsgründen noch **nicht aktiviert**:
`UNITY_PCLOUD_GATEWAY = ''`. Das öffentliche GitHub Pages stellt
keine sichere OAuth-Sitzung, geheime Tokens oder geschützte Upload-API bereit.
Die PWA zeigt daher `Automatischer Upload: technische Verbindung noch
nicht aktiv` und verwendet weiter den manuellen Teilen-/Bestätigungsweg.
Es wird weder eine Authentifizierung noch ein Cloud-Upload vorgetäuscht.

Zur Aktivierung ist eine separate **same-origin** HTTPS-Vermittlung
erforderlich, die eine einmalige echte OAuth-Freigabe annimmt und
`GET /api/pcloud/connection`, `GET /api/pcloud/auth/start`
und `POST /api/pcloud/backups/incremental` bereitstellt. Nach
erfolgreichem HTTPS-Upload und bestätigtem pCloud-Metadatenabruf muss
die Schnittstelle `{storage:'pcloud',verified:true,backupId,snapshotHash,
fileName,byteSize,sha256,fileId}` zurückgeben. Sie muss einen gültigen
CSRF-Nachweis und eine authentifizierte Sitzung verlangen; der Browser
erhält **keinen pCloud-Token**. Keine Zugangsdaten im GitHub-Repository.
Die bereits vorhandene Ordnertrennung bleibt unverändert.

## UNITY LAB 0.13.49 – Private pCloud-Ordner deutlich getrennt

Im iPhone-Bereich **Datensicherung** sind jetzt zwei getrennte Sicherungsarten
mit eindeutigem Namen und empfohlenem pCloud-Ziel zu sehen:

- `UNITY-LAB/01-AENDERUNGEN/`: regelmäßiger Sicherungssatz, erste BASIS-Datei
  und alle nachfolgenden AENDERUNG-Dateien müssen gemeinsam in diesem Ordner
  bleiben. Neue Dateinamen: `UNITY-LAB-AENDERUNGEN-<Zeitstempel>-BASIS.json`
  beziehungsweise `...-AENDERUNG.json`.
- `UNITY-LAB/02-VOLLSICHERUNG/`: unabhängige vollständige JSON-Rückfallebene.
  Neue Dateinamen: `UNITY-LAB-VOLLSICHERUNG_<Zeitstempel>.json`. Frühere
  `UNITY-LAB_BACKUP_`-Dateien bleiben importierbar.

**Bestehende Sicherungsketten:** Nicht durch das Verschieben oder Entfernen
einzelner Dateien beschädigen. Entweder die vorhandene BASIS plus sämtliche
Änderungen gemeinsam nach `01-AENDERUNGEN` verschieben, oder einen neuen
vollständigen BASIS-Satz in dem neuen Ordner anlegen, die Speicherung bestätigen
und erst danach alte Ketten separat archivieren. Die App greift noch
nicht selbst auf den pCloud-Ordner zu.

**Ziel Ein-Klick-Automatik:** Einmalige explizite pCloud-Autorisierung per
OAuth, anschließend Datei automatisch per pCloud-API in den richtigen privaten
Unterordner hochladen und erst nach bestätigtem Cloud-Abruf den lokalen
Sicherungsstand fortschreiben. Für die bisher öffentlich gehostete statische
PWA fehlt eine sichere serverseitige Autorisierungs-/Upload-Schnittstelle.
Es gibt **noch keine direkte automatische pCloud-Verbindung**.
Die Dateifreigabe und manuelle Bestätigung bleiben bis zur sicheren Einrichtung
notwendig. Keine Zugangstokens, Client-Secrets oder persönlichen Sicherungen
im öffentlichen GitHub-Repository.

## UNITY LAB 0.13.48 – Inkrementelle pCloud-Sicherung, Local-First

Die neue Funktion übernimmt das WERK-ARCHIV-Prinzip, statt bei jeder
kleinen Änderung eine vollständige JSON-Datei zu erzeugen.

**Bedienung:** Datensicherung → **Änderungen in pCloud sichern**.
Beim ersten Mal exportiert UNITY die Datei UNITY-LAB-CLOUD-…-BASIS.json
mit dem vollständigen Satz aller neun lokalen Stores. Später enthält jede
UNITY-LAB-CLOUD-…-AENDERUNG.json nur neue, geänderte oder entfernte
Datensätze plus einen kleinen Index der SHA-256-Prüfsummen sämtlicher
gültiger Datensätze. Unveränderte große Kurshistorien werden nicht erneut
übertragen. Es entstehen keine immer wieder vollständigen JSON-Sicherungen.

Die iPhone-Safari-PWA kann den Ordner beim bestehenden Share-Sheet-Verfahren
**nicht selbstständig überschreiben, kontrollieren oder in pCloud
hinaufladen**. Nach Übergabe über die Dateifreigabe muss derselbe
private pCloud-Sicherungsordner gewählt werden. Erst nach Kontrolle wird
**Speicherung in pCloud bestätigen** gedrückt. Dadurch schreibt die
App den lokalen Cursor im IndexedDB-Settings-Store fort. Er wird nicht
als Investmentdatensatz in den Sicherungsdateien gespeichert.
Abgebrochenes Teilen verschiebt den Cursor nicht. Keine unbeaufsichtigte
pCloud-OAuth-Verbindung, kein automatischer Hintergrund-Sync.

**Wiederherstellung:** Die BASIS-Datei und alle zugehörigen AENDERUNG-
Dateien zusammen über die iPhone-Dateiauswahl auswählen. UNITY prüft
Eltern-IDs, Index-Hashes und die SHA-256-Prüfsumme jedes Datenblocks.
Fehlende oder widersprüchliche Dateien führen zum Abbruch.
Neue Datensätze werden erst nach expliziter Bestätigung ergänzt;
unterschiedliche bestehende Datensätze werden nicht überschrieben.
Die ursprüngliche vollständige JSON-Sicherung bleibt separat erhalten.

**Unterschied zum WERK-ARCHIV:** Dort sind inhaltsadressierte .part-Dateien
und kleine JSON-Indizes getrennt gespeichert. UNITY verpackt die neuen
inhaltsadressierten Datenblöcke und den Index in einer kleinen JSON-Datei,
damit auf dem iPhone jeweils nur eine Datei geteilt werden muss.
Eine automatische pCloud-Verzeichnissynchronisation ist weiterhin
ein separates Projekt. Frühere Änderungssätze dürfen nicht entfernt
werden, solange kein neuer bestätigter Basissatz vorhanden ist.

## UNITY LAB 0.13.46 – amtliche Unternehmensberichte und Ereignismonitor

Das neue Recherchemodul **research.js** zeigt für bekannte Emittenten offizielle
Veröffentlichungen und neu gefundene Rechnungslegungsdaten in der Aktienansicht
und der UNITY-Tiefenanalyse. Unter der Aktie steht das Datum, der neutrale
Dokumenttyp und ein Link zu den Originaldokumenten. Eine Einreichung ist
**nicht** automatisch eine positive Nachricht und **keine Handelsfreigabe**.

- Die GitHub-Actions-Datei **official-research.yml** startet werktags und
  bei Änderungen am offiziellen Collector. Sie liest keine privaten
  iPhone-Daten. Der Collector **scripts/refresh_research.py** gleicht
  die amtlichen SEC-Ticker-/CIK-Kennungen mit SEC-EDGAR-Unternehmensmeldungen
  und XBRL-Companyfacts ab. Aktueller Pilot: Eaton, Vertiv, GE Vernova,
  nVent, Hubbell, Quanta Services, AMD, Apple, Microsoft, NVIDIA.
  Die übrige aktive Aktienliste wird *nicht als vollständig analysiert*
  dargestellt.
- Die vorhandenen vier europäischen Emittenten bleiben im separaten
  XBRL-/Emittentenpilot: ABB, Schneider Electric, Siemens Energy und Infineon.
  Der Quellenmonitor verlinkt diese Primärberichte, zählt Finanzkennzahlen
  aber nicht doppelt.
- Nur identisch zugeordnete SEC-CIK/Ticker, belegte Datenformate,
  Zeiträume, Maßeinheiten und Originalquellen werden verwendet.
  Bei SEC-Ausfällen markiert der Collector die Daten als
  **source-unavailable** oder **stale-previous**. Das bisherige Depot,
  Analysen und Kaufzonen werden nicht überschrieben.
- SEC 8-K und 6-K sind neutrale Pflichtmeldungen. Weitere Presse- und
  Zeitungsartikel (FT, GDELT etc.) werden **noch nicht automatisch
  übernommen**, solange Zugriffs-/Nutzungsrechte und Zuordnung nicht
  zweifelsfrei geklärt sind. Keine automatisierte Textextraktion aus
  bezahlpflichtigen Inhalten, keine Nachrichten-Sentiment-Scoring-Prognosen.
- Die SEC akzeptiert automatisierte Abfragen nur im Rahmen der
  Fair-Access-Regeln, mit identifizierbarem User Agent. Für diesen kleinen
  Pilot sind die Abfragen zeitlich gestaffelt. Kostenlos bedeutet weder
  lückenlos noch garantierte Verfügbarkeit. Der SEC-Server kann Zugriffe
  ablehnen. Die Anzahl echter fehlgeschlagener SEC-Quellen wird dokumentiert.
- **data/research.json** enthält nur öffentliche Unternehmensmetadaten,
  niemals private Watchlists, fiktive Käufe, Finanzbestände oder
  Anmeldedaten. Keine neuen Berechtigungen oder Geheimschlüssel in der PWA.
- Der existierende vollständige UNITY-Investmentscore bleibt von den
  neuen Metadaten zunächst getrennt. Die Informationen ermöglichen eine
  schnellere manuelle Verifikation; erst nach Tests zu Quellenabdeckung,
  Zeitstempel und Bilanzkonsistenz dürfen sie automatische harte
  Bewertungs-/Earnings-Regeln direkt beeinflussen.

# Unity Lab 0.4.0

Local-first PWA for hypothetical stock transactions and investment strategy research.

## Hosting

GitHub Pages: Settings → Pages → Deploy from a branch → main → /(root).

Expected public URL after Pages is enabled: https://kontextron-oss.github.io/-unity-lab-pwa/

## UNITY LAB 0.13.42: New-stock onboarding (local first)

- Adding a curated, internationally searched or Wikidata-listed stock uses the **same locally stored stock record and analysis workflow**. Adding an individual stock does **not** require changing GitHub source code, changing the scheduled public market feed or granting GitHub access again.
- Known provider symbols trigger an automatic first historical quote check; a network or provider failure leaves the watchlist entry intact and displays "Daten prüfen" instead of inventing data.
- When the worldwide Yahoo lookup already retrieved a currency-matched history, the user confirms the chosen stock and that unverified history is locally cached in IndexedDB, rather than being held only in memory for that session.
- Unverified histories may provide an *indicative* technical prefilter but are **not** verified fundamentals, official bid/ask prices or authority for a real order. Current four-issuer European fundamentals coverage is not automatically expanded to arbitrary new stock symbols.
- The local device's watchlist is **not uploaded to the public GitHub repository**. Scheduled centralized EOD collection still uses a separately curated server list and does not automatically learn personal holdings.
- On iPhone, the Stocks screen shows a short, explicit post-addition status. All pre-existing positions, trades and historic decisions remain untouched.

## UNITY LAB 0.13.44 – Watchlist remove and restore

- On the green home watchlist, tap × next to any stock to **remove it from active watchlists**. The full stock list offers a clearly labeled **Entfernen** action alongside existing **Ausblenden** and sorting controls.
- Removal is a *reversible archive*, not a database deletion. The original stock ID, historical quotes, analyses, transaction history and audit ledger remain untouched. Use **Archivierte Aktien wiederherstellen** in the Stocks view, or choose **Wiederherstellen** for an archived stock from the curated catalog.
- An open (simulated) position **cannot be removed**, preserving valuation and continuity; use the existing hide control or first close the simulation position.
- Archived stocks are ignored by active watchlists, trading selectors and analysis rankings and remain archived after restarting the app. The automatic first-20 stock onboarding respects archived entries. Realized gain/loss across already closed and archived stocks remains included in portfolio totals.
- No schema migration, no new authorization and no deletion of stored financial records.

## UNITY LAB 0.13.45 – pCloud backup on iPhone (user-confirmed handoff)

- **Datensicherung → In pCloud sichern · Teilen** creates a full, timestamped JSON snapshot of all local IndexedDB stores: instruments, quotes, transactions, strategies, audit, fundamentals, histories, analyses and settings. On supported iPhone browsers, Apple's system Share Sheet opens with the newly generated JSON file. The user must **select their private pCloud folder**; a closed share sheet is not proof of successful storage.
- If file sharing is unavailable or fails, the file is offered for download and can be moved to pCloud through the Files app. Old, date-stamped files are not overwritten. The previous JSON download remains.
- Restoring uses **Datensicherung → Aus pCloud wiederherstellen**, selects an existing JSON file via iPhone Files/pCloud and uses the existing no-silent-overwrite ID/conflict validation; the maximum incoming JSON backup size is now 50 MB instead of 5 MB to accommodate stored stock histories.
- **Not yet implemented:** unattended cloud backup, pCloud OAuth token handling, automatic background synchronization, cloud version conflict resolution. Those would require a dedicated, user-authorized pCloud connection and real iOS/PWA integration testing, not a shared public link or hard-coded credential.
- Public GitHub still hosts nonpersonal application code and public reference-price files; it never automatically receives the user’s local holdings. Google Sheets remains an independent price cross-check and is not silently synced to pCloud.

## Stock lookup\n\n- Online company-name search uses Wikidata's public MediaWiki API with CORS and no key. Results may be incomplete, ambiguous or outdated.\n- P414/P249 exchange/ticker claims and P946 ISIN are mapped conservatively; historical listings and ambiguous ISINs are not automatically imported.\n- Confirm all stock identifiers and currency against an authoritative exchange before financial use.\n- Online lookup does not provide live quotes, fundamentals, verified listing status, or full ISIN/ticker search.\n- The curated offline catalog and manual entry remain available when offline.\n\n## Current limitations

- Stock quotes and FX rates are manually entered, **not verified live data**.
- No automatic UNITY stock analysis or buy recommendation.
- No pCloud synchronization yet.
- Browser IndexedDB stores personal data on each device, not on GitHub.
- Export JSON backups regularly; importing does not silently overwrite conflicting records.
- Browser/Safari end-to-end validation is still required.

Never commit private portfolios, passwords, API keys, or pCloud credentials.

## UNITY analysis beta (0.2.0)

- New UNITY-Analyse tab and one-click Analysieren in the watchlist.
- Non-destructive IndexedDB v1 to v2 upgrade: adds fundamentals, histories, analyses.
- Transparent partial quality, valuation, technical, RR, flows and alternatives calculations; no score for missing components.
- Mandatory data checks for quote freshness, externally verified market reference, balance, earnings, guidance and RR >= 2. No operative recommendation is released by this beta.
- Optional historical daily-close retrieval using a user-supplied Twelve Data API key, not stored. Verify symbol, market, and currency before importing. Historical prices do not establish a current exchange reference.
- Manual fundamentals with source notes, immutable analysis snapshots, CSV price history, non-destructive historical imports.
- Backup format v2 exports all stores and accepts legacy v1 backups without deleting new data.
- The heuristic scoring model is **not backtested**; full automated fundamentals, earnings verification, intraday quotes, pCloud sync and portfolio-aware decisions are future work.


## Market data connector (0.3.0)

Under UNITY-Analyse, the Twelve Data connector supports manual on-demand quote, statistics and earnings-calendar lookups. A personal Twelve Data API key is required and is kept only in the browser form, not persisted or committed. The earnings calendar costs 40 provider credits per request and may require a higher subscription. Coverage and CORS depend on the provider.

All retrieved values appear in a preview. Import requires explicit confirmation; existing ROE and earnings dates are never silently overwritten. Currency mismatches block import; foreign-currency quotes require a user-supplied EUR FX rate. Timestamps and source metadata are recorded. Imported provider data do not automatically certify earnings, financial statements or guidance; no automatic buy recommendation is issued.

A data feed alone is not independent verification. Confirm price, exchange, currency, reporting dates and fundamentals with official market/issuer sources before making investment decisions. No API credentials should be entered into repository files.


## Keyless curated daily reference feed (0.3.1)

A scheduled GitHub Actions job (`scripts/refresh_market.py`) retrieves an experimental delayed daily chart reference for the 15 ISINs in the built-in watchlist. The source is the unofficial Yahoo Finance chart endpoint, not an official exchange or licensed real-time feed. The generated `data/market.json` contains 260 daily closes, source symbol, currency, exchange, latest date, generation time, and errors. The browser fetches it from GitHub raw content, shows a preview and requires explicit confirmation to import a quote or history. Non-EUR positions require a separately entered EUR exchange rate. The automatic provider does not supply independently verified financial statements, earnings or operational trading recommendations. Data may be delayed, unavailable, restricted, or wrong. Do not use it for execution without checking an official exchange/issuer source. Confirm provider rights before production or commercial use.

If the scheduled job fails, the previous valid snapshot is retained and older dates remain visible. This pilot is not a substitute for a properly licensed market data provider. No keys are embedded in the application.


## Unity Lab 0.4.0: automatic comparative research overview

The app opens with an automatically populated comparative overview of all 15 curated equities, with an option to filter to the user's saved watchlist. It fetches the existing dated market snapshot and computes trend, 3-month/12-month returns, RSI, SMA50/200, drawdown, and a clearly labelled **technical comparison index**. Selecting a company opens a plain-language interpretation; the same interpretation appears at the top of its stock analysis page. No manual quote import is needed for these comparisons.

**Important:** The comparison index is not the full UNITY score, an AI-generated recommendation, or a fair-value estimate. There is no autonomous ChatGPT reasoning service in this static GitHub Pages PWA. All securities are marked **no operational buy approval** because independently verified fundamentals, earnings, forecasts, and sufficiently current market data are missing. The next architecture milestone is a secure server-side analysis pipeline with reliable licensed data and independently verified source provenance; do not place OpenAI API keys or financial-provider secrets in public frontend files. The PWA must never present technical strength as evidence that a stock is cheap.


## Unity Lab 0.5.0: visual charts and data freshness

The market overview now includes 3-month sparklines for every supported stock, with a large interactive 1M/3M/6M/1Y daily-close chart in the company detail view. The detailed chart optionally overlays 50-day and 200-day moving averages. Chart date, trading currency, and exchange are visible. No chart is fabricated for stocks without a supported data feed. The UI explicitly displays the timestamp of the last data snapshot and allows a manual re-fetch of the latest published snapshot.

**Real-time requirement not yet met:** the current scheduled GitHub Actions market snapshot is an unofficial delayed end-of-day source and is *not* a real-time feed. A trustworthy current-price analysis requires a licensed real-time provider, a secure server-side credential and data ingestion layer, clear exchange/quote timestamps, an independent source check, fundamentals/earnings and strict UNITY 5.2 veto gates. Do not describe this version as live market analysis. No operational buy recommendation is produced from technical charts alone.


## Unity Lab 0.6.0: data quality and provenance gates

The UI now audits every reference stock for ISIN/currency consistency, valid and ordered daily history, matching latest close, and trading-weekday freshness. A per-stock expandable source status reports the last dated close, exchange, and data-availability limitations. Weekend days are excluded from the weekday age check; market holidays are not yet covered. An old or failed reference fetch removes a stock from the technical ranking without erasing its chart. Every quote remains labelled **unofficial delayed daily close, not real-time**. Manual data forms are now optional expandable sections rather than the default user workflow.

The scheduled refresh validates 200+ valid trading-day points, prevents future-dated quotes, retains the last valid history on source failure, records fetch provenance, and retries GitHub pushes after concurrent updates. It runs on weekdays and Saturday morning to capture Friday's US close. A successful scheduled refresh does not guarantee a new trade or a current quote. **Version 0.6 does not yet include licensed live quotes, fully automatic fundamental/earnings ingestion, AI analysis or an actionable UNITY buy signal.** Those require additional sources and a secure server-side execution service.


## Unity Lab 0.7.0: mobile-first simulated portfolio and six-year charts

- The default start screen begins with a compact **simulated portfolio** showing recorded positions, remaining quantity, EUR cost basis, current value, open P&L, and realized P&L. The stock cards are clickable and show an adjustable week/month/year/3-year/6-year price trend.
- A stock's portfolio detail displays a readable green chart with white line and calendar labels, switchable 1M/3M/6M/1Y/3Y/6Y and SMA overlays, followed by an itemized dated **buy/sell ledger**. These are historical *stock prices*, **not a historical EUR portfolio-value curve**.
- Sales are recorded as immutable simulated SELL entries with date, quantity, price, and EUR FX. Average EUR cost basis is reduced proportionally; realized EUR P&L is calculated on the average-cost method. Invalid over-sales and cancellation of a buy required by a later sale are blocked; cancellation is logged, not erased. Existing BUY entries and local data schema remain unchanged.
- Daily close history is requested for a ten-year provider range and trimmed to six actual calendar years (up to approximately 1,500+ exchange trading days per stock). Newer listings display their true shorter histories, never invented pre-listing values.
- **Not connected to a real brokerage account.** No positions or transactions are inferred from screenshots. The existing app remains a *simulation* until an explicit, privacy-conscious import of real holdings is designed and authorized. Current EUR values are only displayed when both a usable quote and the required recent FX are available. Historical multi-currency portfolio values need dated FX series and corporate-action adjustments and are intentionally not fabricated. Data is an unofficial delayed end-of-day feed, not live quotes.


## Unity Lab 0.9.0: Personal stock dashboard on launch

- The app now opens on a mobile-first **green portfolio/watchlist home**. It displays only locally selected stocks (not the entire research universe), their last available EOD price, selected-period percentage movement, up/down indicator, and a compact count of long-term up/down trends. The home range selector offers last trading session (“Aktuell”), week, month, year, 3 years and 6 years. “Aktuell” is **last available daily close-to-close movement**, not an intraday change.
- Tapping a stock opens a green/white historical chart with time axes and the automatic **UNITY short verdict**: technical trend, preliminary strength index, buy and sell evidence gates, and a plain-language reason. A prominent button opens the detailed UNITY analysis, where existing technical indicators (SMA50/200, RSI, MACD) are now automatically calculated from the EOD snapshot when available, rather than requiring manual CSV imports.
- The stock-selection screen supports showing or hiding each local stock on the home screen **without deleting its transactions, fundamental records or research history**. New users can add stocks from the curated offline catalog. Existing user selections remain unchanged.
- If a simulated position exists and all relevant market prices/FX are usable, the green home panel shows its aggregate hypothetical EUR market value. Otherwise it shows a count or an explicit unavailable-value marker; **no fictional broker holdings or balances** are created from screenshots.
- This is **not a fully autonomous AI investment analyst**: no verified intraday feed, no continuously fetched company fundamentals, no verified earnings calendar, and no sourced fair-value/target-price pipeline are connected yet. Thus the app does not claim that any stock has a defensible buy/sell approval. It computes available technical evidence and displays what remains to be checked. Market snapshots are refreshed on app opening and rechecked when the user returns after 15 minutes; their underlying data is still delayed EOD.


## Unity Lab 0.9.2: Mobile reorder and decision-linked test trades

- Each selected stock has an explicit **☰ drag handle** for pointer/touch reorder. New order is saved atomically in IndexedDB as `watchOrder`, without deleting or rewriting trade history. For accessibility, the stock management view also provides **↑/↓** buttons. The stock name/price row remains a separate button that opens the detail view.
- The **＋** on the home page opens the stock catalog search; additional stocks append to the existing selected list. Existing user selections and order remain intact.
- Stock detail presents a historical green/white chart, quote date/exchange, ISIN, simulated quantity, EUR cost basis, unrealized profit where FX is available, dated buy/sell history, the automatic technical UNITY assessment, and a link to deeper analysis.
- **Buy · Simulation / Sell · Simulation** buttons open a local test-order form with quantity, proposed last close (explicitly not an executable price), FX, date and note. EUR FX is fixed to 1. User confirmation is required; oversells and chronologically invalid backdated trades are rejected. No brokerage or real trading API is connected.
- Each newly recorded test trade archives the then-available **UNITY decision snapshot** (technical classification, source quote date, preliminary index, short rationale and no-approval status) alongside the trade. This supports later prospective validation of decisions without retroactively changing the original verdict. No historical outperformance is claimed from the snapshot alone.

## UNITY Lab 0.9.4 – kostenloser europäischer Kurs-Pilot

Vier Pilotwerte: ABB (SIX, CHF), Schneider Electric (Paris, EUR), Siemens Energy (Xetra, EUR) und Infineon (Xetra, EUR). Infineon wurde dem Katalog und der historischen Tagesschlusskurs-Abfrage hinzugefügt.

Eine **getrennte** GitHub-Actions-Routine `intraday-pilot.yml` prüft an Werktagen zwischen 07:07 und 17:47 UTC alle 20 Minuten, ob aus einem inoffiziellen, schlüssellosen Yahoo-Chart-Endpunkt gültige **15-Minuten-Kursbalken** abrufbar sind. Diese Routine verursacht keine zusätzlich bestellten API-Abonnements; GitHub-Actions-Kontingente und Nutzungsrechte der Datenquelle bleiben zu beachten. GitHub-Actions-Zeitpläne sind Best-Effort und können verzögert ausfallen.

`data/intraday.json` ist bewusst vom stabilen EOD-Snapshot getrennt. Jede Pilotbeobachtung enthält ISIN, Börsenkürzel, Börsenplatz, Währung, beobachteten UTC-Zeitstempel und tatsächliche Abrufzeit. Falsche Symbole, Währungen, zukünftige oder unplausible Balken werden abgewiesen. Alte oder fehlgeschlagene Pilotdaten werden im Browser nicht als frisch ausgegeben.

Die Startseite zeigt einen Pilotpreis **nur dann**, wenn die letzte 15-Minuten-Beobachtung höchstens 90 Minuten alt und nach dem letzten verfügbaren Tagesschluss datiert ist. Sonst zeigt sie den klar datierten EOD-Kurs. Der Prozentwert für „Aktuell“ wird bei Pilotdaten relativ zum letzten Tagesschluss berechnet. Die langfristigen Charts, technischen Indikatoren, Bewertungs-/Earnings-Vetos und UNITY-Entscheidungen bleiben auf der separat geprüften Tageskursreihe aufgebaut. Ein 15-Minuten-Balken ist weder ein ausführbarer Börsenkurs noch eine garantierte 15–20-Minuten-Verzögerung. **Es gibt weiterhin keine automatische Handelsfreigabe.**

**Wichtig:** Die Yahoo-Chart-API ist keine zugesicherte lizenzierte Datenversorgung. Vor produktiver automatischer Nutzung und Weitergabe von Kursdaten müssen Verfügbarkeit, erlaubte Verwendung und Nutzungsrechte überprüft werden. Der Pilot dient zunächst dem technischen Machbarkeits- und Zuverlässigkeitstest, nicht als professioneller Handelsdatenfeed.

## UNITY Lab 0.9.5 – automatische Euro-Umrechnung und direkte Sortierung

Die Startseite bietet an jeder Aktie dauerhaft sichtbare **↑ / ↓-Schaltflächen** sowie den bisherigen Ziehgriff ☰. Die individuelle Reihenfolge wird lokal in IndexedDB gespeichert und durch das alternative Sortierverfahren „Handlungsbedarf“ nicht überschrieben. Das Pluszeichen öffnet den Aktienkatalog.

Testkäufe und Testverkäufe werden **nur simuliert**. Das Formular fragt nur die Stückzahl und optional eine Notiz ab. Der Kurs wird aus dem aktuell verfügbaren, datierten Pilot-15-Minuten-Balken oder aus dem letzten validierten Börsenschlusskurs übernommen. Der EUR-Wechselkurs wird ohne Nutzereingabe aus der kostenlosen täglichen Referenzkursveröffentlichung der **Europäischen Zentralbank (EZB)** übernommen und als EUR pro 1 Einheit der Handelswährung gespeichert. Eine Quelle, deren Kursdaten oder Wechselkurse fehlen oder zu alt sind, blockiert den Testhandel. EUR/EUR wird immer mit 1 umgerechnet. Der voraussichtliche Eurobetrag wird während der Stückzahleingabe angezeigt, vor dem Speichern wird die Simulation bestätigt. Es gibt keine Verbindung zu einem Broker und keine echte Ausführung; EZB-Referenzkurse sind keine handelbaren Bankenkurse, Gebühren und Spread werden nicht simuliert.

Die simulierten Depotwerte werden für Nicht-EUR-Positionen automatisch mit dem datierten EZB-Kurs bewertet. Der bisherige manuelle Verkauf wurde auf denselben automatischen Buchungsweg umgestellt. Vorhandene Transaktionen bleiben unverändert. Externe aktuelle Nachrichten sind über einen klar bezeichneten Link pro Aktie erreichbar; eine automatische KI-Auswertung von Meldungen, Bilanzdaten, Earnings und Handlungssignalen ist weiterhin **nicht** implementiert und wird nicht vorgetäuscht.

## UNITY Lab 0.9.6 – iPhone 15 Pro und Kursdiagramm

Die Safari-PWA erhält iPhone-kompatible Breitenbegrenzungen für Hauptansicht, Aktien-Detail und SVG-Kursdiagramm. Formularfelder verwenden mindestens 16 px Schrift, damit iOS Safari beim Fokussieren der Stückzahleingabe nicht automatisch in die Seite hineinzoomt. Die sieben Zeiträume 1W, 1M, 3M, 6M, 1Y, 3Y, **6Y** passen auch auf schmale Displays in **eine** Zeile; die 6Y-Kurve verwendet sechs tatsächliche Kalenderjahre vor dem letzten verfügbaren Börsentag statt einer ungefähren Zahl von Handelstagen.

Unter dem Kursdiagramm werden die Linien erklärt: weiß = historischer Schlusskurs, gelb gestrichelt = SMA 50 (50 Handelstage), hellblau gestrichelt = SMA 200 (200 Handelstage). Der Schalter blendet beide gleitenden Durchschnitte gemeinsam ein oder aus. Für Datenreihen mit weniger als sechs Jahren wird der verfügbare Zeitraum angezeigt, keine Kurse erfunden. Der PWA-Cache wird mit 0.9.6 erneuert, ohne IndexedDB-Daten oder lokale Testtransaktionen zu löschen.

## UNITY Lab 0.9.10 – weltweite Suche und automatische Referenzdaten (Pilot)

- Ein einziges Suchfeld unter **Aktien & Kurse**: Unternehmensname, Börsenkürzel oder ISIN. Keine verpflichtenden manuellen Eingabefelder.
- Priorität: kuratierter UNITY-Katalog mit hinterlegten Stammdaten; danach internationale Unternehmens- und Tickersuche über den **inoffiziellen** Yahoo-Finance-Suchendpunkt. Falls dieser ausfällt oder nichts liefert, folgt eine Wikidata-Abfrage in Deutsch und Englisch mit zusätzlicher ISIN-/Ticker-Eigenschaftssuche.
- Bei der Übernahme eines internationalen Treffers werden Börse und Handelswährung automatisch aus der zugehörigen Kursantwort ausgelesen und gegen das ausgewählte Symbol validiert. Eine ISIN wird nur übernommen, wenn eine eindeutige Wikidata-Zuordnung über das Börsenkürzel gefunden wird; andernfalls bleibt sie ausdrücklich offen. Keine falschen ISINs und keine manuell erzwungene Eingabe.
- Historische Tages-Schlusskurse für internationale Treffer werden bis zu **sechs Kalenderjahre** auf Abruf geladen. Beim nächsten App-Start werden die ersten acht selbst aufgenommenen internationalen Aktien automatisch erneut abgefragt. Das Diagramm wird angezeigt, ohne daraus eine operative Kauf- oder Verkaufsempfehlung zu erfinden.
- In der Aktien-Detailansicht werden bis zu sechs datierte Google-News-RSS-Schlagzeilen der letzten 31 Tage als **externe Links** automatisch abgefragt. Bei Quellenausfall bleibt die externe Nachrichtensuche erreichbar. Nachrichten werden **nicht** automatisch auf Unternehmensbezug, Qualität, Ereignisrelevanz oder Investmentwirkung bewertet.
- Externe Zugriffe nutzen den derzeit kostenlosen, schlüssellosen Drittanbieter **cors.dev** als CORS-Relay für Yahoo Finance und Google News. Suchbegriffe und Börsensymbole werden an diese Dienste übermittelt. Kein API-Key im Browser, keine zusätzlichen laufenden Kosten vorgesehen; Preis-/Verfügbarkeitsänderungen, Ausfälle und Lizenzrestriktionen sind möglich. Die Quellen sind **keine offiziellen Börsendatenfeeds**. Ihre Nutzung ist ein experimenteller Prototyp, kein lizenzierter Handelsdatenservice.
- **Veto-Regel:** Extern über den CORS-Dienst geladene Kurse sind ausdrücklich als unbestätigt gekennzeichnet und geben weder operative Kauf-/Verkaufssignale noch Testtransaktionen frei. Für verbindliche UNITY-Entscheidungen fehlen weiterhin geprüfte Intraday-Referenzen, Bilanzdaten, Earnings-Termine, Bewertungsdaten und eine verlässliche automatisierte Nachrichtenanalyse. Die vier europäischen Intraday-Pilotwerte und die bisherige kuratierte EOD-Versorgung bleiben separat erhalten.
- Lokale Bestandsdaten, bestehende Transaktionen, Watchlist-Reihenfolge und Sicherungen bleiben unangetastet. Das Update ändert das IndexedDB-Schema nicht.

## UNITY Lab 0.10.0 – Fundamentaldaten-Pilot für vier europäische Unternehmen

Die bestehenden Kurs- und Depotfunktionen bleiben unverändert. Eine **neue, getrennte** Datei `data/fundamentals.json` dokumentiert für ABB, Schneider Electric, Siemens Energy und Infineon die Datenversorgung mit echten Berichtsquellen. Das Skript `scripts/refresh_fundamentals.py` läuft über GitHub Actions montags und donnerstags und kann manuell gestartet werden. Es benötigt keinen API-Schlüssel und keine kostenpflichtigen Abonnements.

Die Pilotquelle ist die freie ESEF-API von **XBRL International** (`https://filings.xbrl.org/api`). Der Abruf erfolgt anhand der zugehörigen **Konzern-LEI**, nicht anhand ähnlich lautender Tochterunternehmen. Die API ist unvollständig, insbesondere für Deutschland; die Schweizer ABB unterliegt nicht automatisch der EU-ESEF-Pflicht. Wenn ein Konzernbericht fehlt, wird ausdrücklich „kein Bericht“ oder „Quelle nicht erreichbar“ angezeigt, nicht ein frei erfundener Kennzahlenwert. Links zu den offiziellen Investor-Relations-Seiten ergänzen die Quellen.

Soweit maschinenlesbare xBRL-JSON-Berichte verfügbar sind, werden nur **eindeutig zuordenbare, nicht segmentierte Konzernkennzahlen** für das passende Geschäftsjahr und die passende Berichts-/Währungseinheit übernommen. Der Parser prüft Berichtszeitraum, Währung, Konzept, Wertbereich und widersprüchliche Duplikate. Abgeleitete Kennzahlen wie KGV, KBV, ROE und fairer Wert werden **nicht** aus unvollständigen Daten geschätzt. Quellen- und Berichtsdatum werden je Wert angegeben. Bei vorübergehendem Ausfall darf eine alte Quelle nur ausdrücklich als veraltet markiert angezeigt werden.

Die Finanzberichte erscheinen sowohl in der Aktien-Detailansicht als auch unter „UNITY-Analyse“. Die neuen Daten lösen **keine operative Kauf-/Verkaufsfreigabe** aus: Es fehlen weiterhin ein vollständiger und unabhängiger Datenabgleich, Quartalszahlen, Guidance, Earnings-Termine und nachprüfbare Bewertungen. Die automatische Unternehmensanalyse wird inkrementell aus realen Quellen aufgebaut.

### Erste tatsächlich eingelesene Ergebnisse (Abruf vom 01.11.2026)

Der ESEF-Pilot konnte **Schneider Electric SE** mit einem offiziellen maschinenlesbaren Jahresbericht 2025 und Vergleichsbericht 2024 verknüpfen. Die Parserausgabe enthält Umsatz 2025 **40,152 Mrd. EUR**, Jahresüberschuss **4,351 Mrd. EUR**, Bilanzsumme **62,504 Mrd. EUR**, Eigenkapital **24,455 Mrd. EUR** und operativen Cashflow **6,131 Mrd. EUR**. Automatisch errechnet: Umsatzwachstum **+5,24 %**, Jahresüberschussveränderung **−1,98 %**, Nettomarge **10,84 %**, Eigenkapitalquote **39,13 %** und operative Cashflow-Marge **15,27 %**. Die Werte beziehen sich auf das **Geschäftsjahr 2025**, nicht auf aktuelle Quartalszahlen. Die App verlinkt die XBRL-Originalberichte.

Für **ABB** (Schweizer Emittent) besteht keine passende ESEF-Pflichtquelle; für **Siemens Energy** und **Infineon** liefert das derzeit abgefragte ESEF-Archiv keine passende Konzernberichtsdatei. Diese Datenlücken bleiben sichtbar und lösen keine automatische Kaufempfehlung aus. Nächster Schritt: zusätzliche offizielle Unternehmensquellen für diese drei Gesellschaften und Ereignis-/Guidance-Abgleich.

Die bisher direkt sichtbaren manuellen Twelve-Data-Schlüssel-/Wechselkurs- und Kursimport-Panels werden aus der regulären UNITY-Analyse ausgeblendet. Alte lokale Daten und optionale erweiterte Datenpflege bleiben erhalten.

### UNITY Lab 0.10.1 – zweite offizielle Berichtsquelle

Zusätzlich zu den maschinenlesbaren ESEF-Berichten prüft die GitHub-Automation jetzt die **veröffentlichten Primärmeldungen** von ABB (regulatorische Emittentenmeldung über Nasdaq), Siemens Energy (offizielle Investor-/Pressemitteilung) und Infineon (offizielle Ergebnis-Pressemitteilung). Sie extrahiert ausschließlich exakt zuordenbare Jahreswerte aus den tatsächlich geladenen Quelltexten. Bei abweichenden oder widersprüchlichen Fundstellen wird der Wert nicht übernommen. Die Daten bleiben **separat** von IFRS-ESEF-Konzernzahlen: Ein bereinigter Free Cashflow ist nicht dasselbe wie operativer Cashflow oder Free Cashflow vor Steuern. Alle Werte enthalten den Berichtszeitraum 2025 und einen anklickbaren Originalquellenlink.

Die Automatisierung **überprüft aktuell ausdrücklich den Quellenjahrgang 2025**. Sie entdeckt noch nicht selbstständig alle künftigen Jahres- und Quartalsberichte. Eine nicht erreichbare Primärquelle führt zu einem sichtbar offenen Datenstatus; ein älterer bestätigter Wert wird nur mit explizitem Veraltet-Hinweis weiter angezeigt. Daraus folgt keine operative Kauf-/Verkaufsfreigabe.

**Produktvergleich und Zielarchitektur:** Der Wettbewerbsvorteil soll nicht in der Menge der Kursindikatoren liegen, sondern in einer entscheidungsorientierten, transparenten Priorisierung der vollständigen Watchlist. Nächste Prioritäten: zuverlässige Berichts-/Earnings-Aktualität, vergleichbare Bewertung und Sicherheitsmarge, relative Attraktivität aller beobachteten Aktien, verifizierbare Gründe für Kauf/Warten/Verkauf und ein rückblickend messbares Entscheidungsprotokoll. Die bisherigen Local-First-Daten, Kurse und das Simulationsdepot bleiben unangetastet.
