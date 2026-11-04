#!/usr/bin/env python3
"""Build a public, keyless crypto market snapshot for the UNITY Lab PWA.

The browser never calls the external provider.  A GitHub Action downloads,
validates and publishes the static snapshot. The source is a public USD spot-market feed.  If one required asset is
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
    "ADA": "ADAUSD",
    "SOL": "SOLUSD",
    "ETC": "ETCUSD",
}
API = "https://api.kraken.com/0/public"
SOURCE = "Kraken · USD-Spotmarkt"
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
    ticker_data = get_json(f"{API}/Ticker?pair={provider_id}")
    history_data = get_json(f"{API}/OHLC?pair={provider_id}&interval=1440")
    if ticker_data.get("error") or history_data.get("error"):
        raise RuntimeError(f"{ticker}: Kraken returned an error")
    ticker_rows = ticker_data.get("result") or {}
    history_rows = history_data.get("result") or {}
    ticker_quote = next((value for key, value in ticker_rows.items() if key != "last"), {})
    ohlc = next((value for key, value in history_rows.items() if key != "last"), [])
    try:
        price = float((ticker_quote.get("c") or [0])[0])
    except (TypeError, ValueError, IndexError):
        price = 0
    history = [{"timestamp": datetime.fromtimestamp(int(row[0]), timezone.utc).isoformat(), "price": row[4], "volume_24h": row[6]} for row in ohlc if isinstance(row, list) and len(row) >= 7]
    points = daily_points(history)
    if price <= 0 or len(points) < MIN_POINTS:
        raise RuntimeError(f"{ticker}: insufficient validated market history ({len(points)} daily points)")
    return {
        "ticker": ticker,
        "currency": "USD",
        "price": price,
        "volume24": float((ticker_quote.get("v") or [0, 0])[1] or 0),
        "marketCap": 0,
        "date": points[-1]["date"],
        "fetchedAt": checked_at,
        "source": SOURCE,
        "venue": "Kraken Spot",
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
