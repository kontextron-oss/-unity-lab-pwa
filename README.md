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
