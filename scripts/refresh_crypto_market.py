#!/usr/bin/env python3
"""Build a public, keyless crypto market snapshot for the UNITY Lab PWA.

The browser never calls the external provider.  A GitHub Action downloads,
validates and publishes the static snapshot.  If one required asset is
incomplete, no file is written and the last valid snapshot remains online.
"""
from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
OUT_JSON = ROOT / "data" / "crypto-market.json"
OUT_JS = ROOT / "data" / "crypto-market.js"
ASSETS = {
    "ADA": "ada-cardano",
    "SOL": "sol-solana",
    "ETC": "etc-ethereum-classic",
}
API = "https://api.coinpaprika.com/v1/tickers"
SOURCE = "CoinPaprika · USD-Referenz · Marktaggregat"
MIN_POINTS = 200
TIMEOUT_SECONDS = 25


def get_json(url: str):
    request = Request(url, headers={"Accept": "application/json", "User-Agent": "UNITY-Lab-PWA/1.0"})
    try:
        with urlopen(request, timeout=TIMEOUT_SECONDS) as response:
            if response.status != 200:
                raise RuntimeError(f"HTTP {response.status} for {url}")
            return json.load(response)
    except (HTTPError, URLError, TimeoutError) as exc:
        raise RuntimeError(f"Source request failed: {exc}") from exc


def daily_points(history):
    by_date = {}
    for row in history if isinstance(history, list) else []:
        date = str(row.get("timestamp", ""))[:10]
        try:
            close = float(row.get("price"))
            volume = float(row.get("volume_24h") or 0)
        except (TypeError, ValueError):
            continue
        if date and close > 0:
            by_date[date] = {"date": date, "close": close, "volume": max(volume, 0)}
    return [by_date[key] for key in sorted(by_date)]


def build_asset(ticker: str, provider_id: str, start: str, end: str, checked_at: str):
    ticker_data = get_json(f"{API}/{provider_id}")
    history = get_json(f"{API}/{provider_id}/historical?start={start}&end={end}&interval=24h")
    quote = (ticker_data.get("quotes") or {}).get("USD") or {}
    try:
        price = float(quote.get("price"))
    except (TypeError, ValueError):
        price = 0
    points = daily_points(history)
    if price <= 0 or len(points) < MIN_POINTS:
        raise RuntimeError(f"{ticker}: insufficient validated market history ({len(points)} daily points)")
    return {
        "ticker": ticker,
        "currency": "USD",
        "price": price,
        "volume24": float(quote.get("volume_24h") or 0),
        "marketCap": float(quote.get("market_cap") or 0),
        "date": points[-1]["date"],
        "fetchedAt": checked_at,
        "source": SOURCE,
        "venue": "Marktaggregat",
        "points": points,
    }


def main():
    now = datetime.now(timezone.utc)
    checked_at = now.replace(microsecond=0).isoformat().replace("+00:00", "Z")
    end = now.date().isoformat()
    start = (now.date() - timedelta(days=370)).isoformat()
    assets = {ticker: build_asset(ticker, provider_id, start, end, checked_at) for ticker, provider_id in ASSETS.items()}
    snapshot = {
        "schema": 1,
        "generatedAt": checked_at,
        "refresh": "GitHub Actions · alle 2 Stunden",
        "source": SOURCE,
        "assets": assets,
    }
    encoded = json.dumps(snapshot, ensure_ascii=False, separators=(",", ":"))
    OUT_JSON.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    OUT_JS.write_text("window.UNITY_CRYPTO_MARKET_SNAPSHOT=" + encoded + ";\n", encoding="utf-8")
    print(f"Validated and wrote {len(assets)} crypto assets at {checked_at}")


if __name__ == "__main__":
    main()
