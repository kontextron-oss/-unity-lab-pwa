#!/usr/bin/env python3
"""Experimental, zero-key European 15-minute BAR pilot (NOT a licensed real-time feed).
Yahoo chart is an unofficial endpoint: access, accuracy, permitted use, and delay
are not guaranteed. Publish explicit observation timestamps; never invent quotes.
"""
import datetime as dt
import json
import pathlib
import time
import urllib.error
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "data" / "intraday.json"
PILOT = [
    ("CH0012221716", "ABBN.SW", "CHF", "ABB"),
    ("FR0000121972", "SU.PA", "EUR", "Schneider Electric"),
    ("DE000ENER6Y0", "ENR.DE", "EUR", "Siemens Energy"),
    ("DE0006231004", "IFX.DE", "EUR", "Infineon"),
]

def fetch_chart(symbol):
    query = urllib.parse.urlencode({"range": "5d", "interval": "15m", "events": "false"})
    for host in ("query1.finance.yahoo.com", "query2.finance.yahoo.com"):
        url = "https://" + host + "/v8/finance/chart/" + urllib.parse.quote(symbol, safe=".") + "?" + query
        req = urllib.request.Request(url, headers={
            "User-Agent": "Mozilla/5.0 (compatible; UnityLabPilot/0.1; personal research)",
            "Accept": "application/json",
        })
        try:
            with urllib.request.urlopen(req, timeout=12) as response:
                data = json.load(response)
            chart = data.get("chart") or {}
            if chart.get("error"):
                raise ValueError(str(chart["error"]))
            result = chart.get("result") or []
            if result:
                return result[0]
            raise ValueError("no chart result")
        except (urllib.error.URLError, ValueError, TimeoutError, KeyError) as ex:
            print(f"{symbol} {host}: {ex}", flush=True)
            time.sleep(0.3)
    raise RuntimeError(f"Intraday endpoint unavailable: {symbol}")

def extract_quote(chart, isin, symbol, currency, name, now):
    meta = chart.get("meta") or {}
    got_symbol = str(meta.get("symbol") or "").upper()
    got_currency = str(meta.get("currency") or "").upper()
    if got_symbol != symbol.upper():
        raise ValueError(f"symbol mismatch: {got_symbol} vs {symbol}")
    if got_currency != currency:
        raise ValueError(f"currency mismatch: {got_currency} vs {currency}")
    stamps = chart.get("timestamp") or []
    quotes = ((chart.get("indicators") or {}).get("quote") or [{}])[0]
    closes = quotes.get("close") or []
    bars = []
    for stamp, close in zip(stamps, closes):
        if not isinstance(stamp, (int, float)) or not isinstance(close, (float, int)):
            continue
        if not 0 < close < 1e8 or stamp > now.timestamp() + 60:
            continue
        bars.append((int(stamp), float(close)))
    bars.sort()
    if len(bars) < 3:
        raise ValueError("insufficient intraday bars")
    latest = bars[-1]
    if now.timestamp() - latest[0] > 8 * 86400:
        raise ValueError("intraday quote too old")
    return {
        "isin": isin, "name": name, "providerSymbol": symbol,
        "currency": currency, "exchange": str(meta.get("fullExchangeName") or meta.get("exchangeName") or ""),
        "price": round(latest[1], 5),
        "quotedAt": dt.datetime.fromtimestamp(latest[0], dt.timezone.utc).isoformat(timespec="seconds"),
        "quotePrecision": "15m-bar", "source": "Yahoo Finance chart · unofficial 15-minute bars",
        "delayedMinutes": None, "lastSuccessfulFetchAt": now.isoformat(timespec="seconds"),
    }

def build():
    print('Pilot: four European symbols; timestamps reflect 15m bars, not guaranteed exchange latency.', flush=True)
    now = dt.datetime.now(dt.timezone.utc)
    previous = {}
    if OUTPUT.exists():
        try:
            previous = json.loads(OUTPUT.read_text(encoding="utf-8")).get("items", {})
        except (OSError, ValueError):
            pass
    items, errors = {}, {}
    for isin, symbol, currency, name in PILOT:
        try:
            item = extract_quote(fetch_chart(symbol), isin, symbol, currency, name, now)
            items[isin] = item
            print(f"OK {name}: {item['price']} {currency} · {item['quotedAt']}", flush=True)
        except Exception as ex:
            errors[isin] = str(ex)
            if isin in previous:
                items[isin] = previous[isin]
            print(f"UNAVAILABLE {name}: {ex}", flush=True)
        time.sleep(0.35)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "schemaVersion": 1,
        "generatedAt": now.isoformat(timespec="seconds"),
        "scope": "Four European pilot stocks; 15m chart bars, NOT guaranteed 15-minute-delayed quotes",
        "source": "Unofficial Yahoo Finance chart; no accuracy, availability or licensing guarantee",
        "successfulSymbols": len(PILOT) - len(errors),
        "failedSymbols": len(errors),
        "items": items, "errors": errors,
    }
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"Published {len(items)} available or historical pilot entries; {len(errors)} fetch errors", flush=True)
    if not items:
        raise SystemExit("No pilot data; published explicit errors, no invented quotes")

if __name__ == "__main__":
    build()
