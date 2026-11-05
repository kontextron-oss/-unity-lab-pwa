#!/usr/bin/env python3
"""Experimental delayed end-of-day reference snapshot for the fixed UNITY watchlist.
Never label as intraday or independently verified. Fail closed if source unavailable.
"""
import datetime as dt
import json
import pathlib
import re
import time
import urllib.error
import urllib.parse
import urllib.request

EXTRA_STOCKS = [
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
    ("DE0006231004", "IFX.DE", "EUR", "Infineon"),
    ("DE000A2NB601", "JEN.DE", "EUR", "Jenoptik AG"),
    ("@AMD", "AMD", "USD", "AMD"),
    ("@DWS.DE", "DWS.DE", "EUR", "DWS Group"),
    ("@TKA.DE", "TKA.DE", "EUR", "Thyssenkrupp"),
    ("@CBK.DE", "CBK.DE", "EUR", "Commerzbank"),
    ("@RBI.VI", "RBI.VI", "EUR", "Raiffeisen Bank International"),
    ("@VOD.L", "VOD.L", "GBP", "Vodafone Group"),
    ("@ARKK", "ARKK", "USD", "ARK Innovation ETF"),
    ("@AAPL", "AAPL", "USD", "Apple"),
    ("@MSFT", "MSFT", "USD", "Microsoft"),
    ("@SONY", "SONY", "USD", "Sony Group"),
    ("@GOOG", "GOOG", "USD", "Alphabet Inc. Class C"),
    ("@TSLA", "TSLA", "USD", "Tesla"),
    ("@DB1.DE", "DB1.DE", "EUR", "Deutsche Börse"),
    ("@SPY5.DE", "SPY5.DE", "EUR", "SPDR S&P 500 UCITS ETF"),
    ("@ANX.PA", "ANX.PA", "EUR", "Amundi Nasdaq-100 UCITS ETF"),
    ("@SAP.DE", "SAP.DE", "EUR", "SAP"),
    ("@UBSG.SW", "UBSG.SW", "CHF", "UBS Group"),
    ("@FME.DE", "FME.DE", "EUR", "Fresenius Medical Care"),
    ("@NVDA", "NVDA", "USD", "NVIDIA"),
    ("@TTWO", "TTWO", "USD", "Take-Two Interactive"),
    ("@AMZN", "AMZN", "USD", "Amazon"),
    ("@IBM", "IBM", "USD", "IBM"),
    ("@VWRL.L", "VWRL.L", "GBP", "Vanguard FTSE All-World UCITS ETF"),
    ("@BRK-B", "BRK-B", "USD", "Berkshire Hathaway B"),
    ("@DANSKE.CO", "DANSKE.CO", "DKK", "Danske Bank"),
    ("@KBC.BR", "KBC.BR", "EUR", "KBC Group"),
    ("@BAYN.DE", "BAYN.DE", "EUR", "Bayer"),
    ("@META", "META", "USD", "Meta Platforms"),
    ("@ADBE", "ADBE", "USD", "Adobe"),
    ("@HAL", "HAL", "USD", "Halliburton"),
    ("@PYPL", "PYPL", "USD", "PayPal"),
    ("@1810.HK", "1810.HK", "HKD", "Xiaomi"),
    ("@NEE", "NEE", "USD", "NextEra Energy"),
    ("@IBN", "IBN", "USD", "ICICI Bank ADR"),
    ("@UN01.DE", "UN01.DE", "EUR", "Uniper"),
    ("@SZG.DE", "SZG.DE", "EUR", "Salzgitter"),
    ("@WUW.DE", "WUW.DE", "EUR", "Wüstenrot & Württembergische"),
    ("@TATASTEEL.NS", "TATASTEEL.NS", "INR", "Tata Steel"),
    ("@SBIN.NS", "SBIN.NS", "INR", "State Bank of India"),
    ("@LHA.DE", "LHA.DE", "EUR", "Lufthansa"),
    ("@NAS.OL", "NAS.OL", "NOK", "Norwegian Air Shuttle"),
    ("@JUN3.DE", "JUN3.DE", "EUR", "Jungheinrich"),
    ("@AAF.L", "AAF.L", "GBP", "Airtel Africa"),
    ("@SOL-USD", "SOL-USD", "USD", "Solana"),
    ("@ADA-USD", "ADA-USD", "USD", "Cardano"),
    ("@ETC-USD", "ETC-USD", "USD", "Ethereum Classic"),
]
ROOT = pathlib.Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "data" / "market.json"
CATALOG_FILE = ROOT / "index.html"
CATALOG_ROW = re.compile(
    r"\\{name:'(?P<name>[^']+)',ticker:'(?P<ticker>[^']+)',isin:'(?P<isin>[^']+)',"
    r"exchange:'(?P<exchange>[^']+)',currency:'(?P<currency>[^']+)',"
    r"providerSymbol:'(?P<symbol>[^']*)',group:'[^']+'\\}"
)

def curated_catalog_stocks():
    """Use the app's curated master data as the only source for catalog symbols.

    The server snapshot must not silently drift from the visible selector: each
    selected catalog share receives its own ISIN key, currency check and price
    history.  This is a delayed technical reference, not a fundamental dataset.
    """
    rows = list(CATALOG_ROW.finditer(CATALOG_FILE.read_text(encoding="utf-8")))
    if not rows:
        raise RuntimeError("Could not read the curated equity catalog")
    stocks, isins, symbols = [], set(), set()
    for row in rows:
        name, isin, currency, symbol = (row.group(k).strip() for k in ("name", "isin", "currency", "symbol"))
        if not isin or not symbol or not currency:
            continue
        if isin in isins:
            raise RuntimeError(f"Duplicate catalog ISIN: {isin}")
        if symbol.upper() in symbols:
            raise RuntimeError(f"Duplicate catalog price symbol: {symbol}")
        isins.add(isin)
        symbols.add(symbol.upper())
        stocks.append((isin, symbol, currency, name))
    if len(stocks) < 20:
        raise RuntimeError("Curated catalog unexpectedly incomplete")
    return stocks

def build_stocks():
    catalog = curated_catalog_stocks()
    catalog_symbols = {symbol.upper() for _, symbol, _, _ in catalog}
    extras, seen = [], set(catalog_symbols)
    for key, symbol, currency, name in EXTRA_STOCKS:
        # Catalog values are keyed by their verified ISIN.  Retaining them as
        # @symbol duplicates would make the app ignore the catalog identity.
        if symbol.upper() in seen:
            continue
        seen.add(symbol.upper())
        extras.append((key, symbol, currency, name))
    return catalog + extras

STOCKS = build_stocks()

def get_chart(symbol):
    query = urllib.parse.urlencode({"range": "10y", "interval": "1d", "events": "false"})
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
    run_at = dt.datetime.now(dt.timezone.utc).isoformat(timespec='seconds')
    if OUTPUT.exists():
        try:
            previous = json.loads(OUTPUT.read_text(encoding="utf-8")).get("items", {})
        except (OSError, ValueError):
            pass
    items = {}
    errors = {}
    for key, symbol, expected_currency, name in STOCKS:
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
            points = sorted({x["date"]: x for x in points}.values(), key=lambda x: x["date"])
            # Preserve up to six calendar years; never fabricate pre-IPO data.
            cutoff = (dt.datetime.now(dt.timezone.utc).date() - dt.timedelta(days=366*6)).isoformat()
            points = [p for p in points if p["date"] >= cutoff]
            if len(points) < 200:
                raise ValueError("fewer than 200 valid daily closes")
            if any(points[i]["date"] >= points[i+1]["date"] for i in range(len(points)-1)):
                raise ValueError("duplicate or unordered trading dates")
            latest = points[-1]
            today = dt.datetime.now(dt.timezone.utc).date()
            last_date = dt.date.fromisoformat(latest["date"])
            if last_date > today:
                raise ValueError("latest quote date lies in the future")
            if (today-last_date).days > 14:
                raise ValueError("latest quote is more than 14 calendar days old")
            # Date-only precision is deliberate: timestamps are not treated as intraday.
            items[key] = {
                "name": name,
                "isin": key if not key.startswith("@") else "",
                "marketKey": key,
                "providerSymbol": symbol,
                "currency": currency,
                "exchange": str(meta.get("fullExchangeName") or meta.get("exchangeName") or ""),
                "price": latest["close"],
                "date": latest["date"],
                "points": points,
                "source": "Yahoo Finance chart (unofficial delayed reference)",
                "lastSuccessfulFetchAt": run_at,
                "quotePrecision": "day",
            }
            print(f"OK {name}: {latest['close']} {currency} ({latest['date']})", flush=True)
        except Exception as ex:
            errors[key] = str(ex)
            # Retain previous verified-symbol data but make its old date explicit.
            if key in previous:
                items[key] = previous[key]
            print(f"SKIP {name}: {ex}", flush=True)
        time.sleep(0.5)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "schemaVersion": 1,
        "generatedAt": run_at,
        "lastAttemptAt": run_at,
        "successfulSymbols": len(STOCKS)-len(errors),
        "failedSymbols": len(errors),
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
