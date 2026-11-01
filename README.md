# Unity Lab 0.4.0

Local-first PWA for hypothetical stock transactions and investment strategy research.

## Hosting

GitHub Pages: Settings → Pages → Deploy from a branch → main → /(root).

Expected public URL after Pages is enabled: https://kontextron-oss.github.io/-unity-lab-pwa/

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
