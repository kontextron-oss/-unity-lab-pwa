#!/usr/bin/env python3
"""Experimental delayed end-of-day reference snapshot for the fixed UNITY watchlist.
Never label as intraday or independently verified. Fail closed if source unavailable.
"""
import datetime as dt
import json
import pathlib
import time
import urllib.error
import urllib.parse
import urllib.request

STOCKS = [
    ("CH0012221716", "ABBN.SW", "CHF", "ABB"),
    ("FR0000121972", "SU.PA", "EUR", "Schneider Electric"),
    ("IE00B8KQN827", "ETN", "USD", "Eaton"),
    ("DE000ENER6Y0", "ENR.DE", "EUR", "Siemens Energy"),
    ("US92537N1081", "VRT", "USD", "Vertiv"),
    ("DE000A0D6554", "NDX1.DE", "EUR", "Nordex"),
    ("IT0004176001", "PRY.MI", "EUR", "Prysmian"),
    ("FR0010307819", "LR.PA", "EUR", "Legrand"),
    ("DE0007236101", "SIE.DE", "EUR", "Siemens"),
    ("CH1101098163", "BEAN.SW", "CHF", "Belimo"),
    ("US36828A1016", "GEV", "USD", "GE Vernova"),
    ("IE00BDVJJQ56", "NVT", "USD", "nVent Electric"),
    ("US4435106079", "HUBB", "USD", "Hubbell"),
    ("US74762E1029", "PWR", "USD", "Quanta Services"),
    ("FR0000044448", "NEX.PA", "EUR", "Nexans"),
]
ROOT = pathlib.Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "data" / "market.json"

def get_chart(symbol):
    query = urllib.parse.urlencode({"range": "2y", "interval": "1d", "events": "false"})
    path = urllib.parse.quote(symbol, safe=".")
    for host in ("query1.finance.yahoo.com", "query2.finance.yahoo.com"):
        url = f"https://{host}/v8/finance/chart/{path}?{query}"
        req = urllib.request.Request(url, headers={
            "User-Agent": "Mozilla/5.0 (compatible; UnityLabResearch/0.3; personal research)",
            "Accept": "application/json",
        })
        try:
            with urllib.request.urlopen(req, timeout=15) as response:
                data = json.load(response)
            chart = data.get("chart") or {}
            if chart.get("error"):
                raise ValueError(str(chart["error"]))
            results = chart.get("result") or []
            if not results:
                raise ValueError("empty chart result")
            return results[0]
        except (urllib.error.URLError, ValueError, TimeoutError, KeyError) as ex:
            print(f"{symbol} {host}: {ex}", flush=True)
            time.sleep(0.3)
    raise RuntimeError(f"Both chart hosts unavailable: {symbol}")

def build():
    previous = {}
    if OUTPUT.exists():
        try:
            previous = json.loads(OUTPUT.read_text(encoding="utf-8")).get("items", {})
        except (OSError, ValueError):
            pass
    items = {}
    errors = {}
    for isin, symbol, expected_currency, name in STOCKS:
        try:
            chart = get_chart(symbol)
            meta = chart.get("meta") or {}
            currency = str(meta.get("currency") or "").upper()
            actual_symbol = str(meta.get("symbol") or "").upper()
            if actual_symbol != symbol.upper():
                raise ValueError(f"symbol mismatch: {actual_symbol} != {symbol}")
            if currency != expected_currency:
                raise ValueError(f"currency mismatch: {currency} != {expected_currency}")
            timestamps = chart.get("timestamp") or []
            q = ((chart.get("indicators") or {}).get("quote") or [{}])[0]
            closes = q.get("close") or []
            points = []
            for ts, close in zip(timestamps, closes):
                if not isinstance(close, (float, int)) or not 0 < close < 1e8:
                    continue
                day = dt.datetime.fromtimestamp(ts, tz=dt.timezone.utc).date().isoformat()
                points.append({"date": day, "close": round(float(close), 5)})
            points = sorted({x["date"]: x for x in points}.values(), key=lambda x: x["date"])[-260:]
            if len(points) < 26:
                raise ValueError("too few valid daily closes")
            latest = points[-1]
            # Date-only precision is deliberate: timestamps are not treated as intraday.
            items[isin] = {
                "name": name,
                "isin": isin,
                "providerSymbol": symbol,
                "currency": currency,
                "exchange": str(meta.get("fullExchangeName") or meta.get("exchangeName") or ""),
                "price": latest["close"],
                "date": latest["date"],
                "points": points,
                "source": "Yahoo Finance chart (unofficial delayed reference)",
            }
            print(f"OK {name}: {latest['close']} {currency} ({latest['date']})", flush=True)
        except Exception as ex:
            errors[isin] = str(ex)
            # Retain previous verified-symbol data but make its old date explicit.
            if isin in previous:
                items[isin] = previous[isin]
            print(f"SKIP {name}: {ex}", flush=True)
        time.sleep(0.5)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "schemaVersion": 1,
        "generatedAt": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "source": "Yahoo Finance chart (unofficial, delayed, no accuracy guarantee)",
        "scope": "Curated UNITY watchlist only; not an official exchange feed",
        "items": items,
        "errors": errors,
    }
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"Saved {len(items)} items; {len(errors)} errors", flush=True)
    # Do not publish an empty snapshot as if it were working.
    if not items:
        raise SystemExit("No market data retrieved; refusing empty publication.")

if __name__ == "__main__":
    build()
