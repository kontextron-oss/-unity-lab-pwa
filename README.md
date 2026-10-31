# Unity Lab 0.2.0

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
