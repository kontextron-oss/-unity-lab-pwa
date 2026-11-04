#!/usr/bin/env python3
"""Build a source-bound US fundamentals snapshot from SEC Company Facts.

No browser requests, no API key and no estimated values. Snapshot publication is atomic. A company is published
only with its own CIK-bound SEC facts. Missing concepts remain missing.
"""
from __future__ import annotations
import datetime as dt
import json
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "data" / "sec-fundamentals.json"
BASE = "https://data.sec.gov/api/xbrl/companyfacts"
HEADERS = {"User-Agent": "UNITY-Lab-Research contact@kontextron.de", "Accept": "application/json"}
FORMS = {"10-K", "20-F", "40-F"}
ISSUERS = {
 "MSFT": {"cik": "0000789019", "name": "Microsoft", "isin": "US5949181045", "ir": "https://www.microsoft.com/en-us/Investor/"},
 "AAPL": {"cik": "0000320193", "name": "Apple", "isin": "US0378331005", "ir": "https://investor.apple.com/"},
 "ADBE": {"cik": "0000796343", "name": "Adobe", "isin": "US00724F1012", "ir": "https://www.adobe.com/investor-relations.html"},
 "AMD": {"cik": "0000002488", "name": "AMD", "isin": "US0079031078", "ir": "https://ir.amd.com/"},
 "PWR": {"cik": "0001050915", "name": "Quanta Services", "isin": "US74762E1029", "ir": "https://investors.quantaservices.com/"},
 "ETN": {"cik": "0001558370", "name": "Eaton", "isin": "IE00B8KQN827", "ir": "https://www.eaton.com/us/en-us/company/investor-relations.html"},
}
CONCEPTS = {
 "revenue": ("RevenueFromContractWithCustomerExcludingAssessedTax", "RevenueFromContractWithCustomerIncludingAssessedTax", "Revenues", "SalesRevenueNet", "SalesRevenueGoodsNet"),
 "netIncome": ("NetIncomeLoss",),
 "assets": ("Assets",),
 "equity": ("StockholdersEquity", "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest"),
 "operatingCashFlow": ("NetCashProvidedByUsedInOperatingActivities",),
}

def get_json(url):
    request = Request(url, headers=HEADERS)
    try:
        with urlopen(request, timeout=30) as response:
            if response.status != 200:
                raise RuntimeError(f"HTTP {response.status}")
            return json.load(response)
    except (HTTPError, URLError, TimeoutError) as exc:
        raise RuntimeError(f"SEC source unavailable: {exc}") from exc

def annual_rows(payload, concept):
    facts = ((payload.get("facts") or {}).get("us-gaap") or {}).get(concept) or {}
    units = facts.get("units") or {}
    rows = units.get("USD") or []
    out = []
    for row in rows:
        if row.get("form") not in FORMS or row.get("fp") != "FY":
            continue
        try:
            value = float(row["val"])
            end = str(row["end"])[:10]
            filed = str(row.get("filed") or "")[:10]
        except (KeyError, TypeError, ValueError):
            continue
        if not end or not filed or abs(value) >= 1e15:
            continue
        out.append({"value": value, "periodEnd": end, "filed": filed, "form": row.get("form"), "accn": row.get("accn"), "fy": str(row.get("fy") or "")})
    # SEC facts can include amendments; retain newest filed value for each fiscal end.
    latest = {}
    for row in sorted(out, key=lambda x: (x["periodEnd"], x["filed"])):
        latest[row["periodEnd"]] = row
    return [latest[key] for key in sorted(latest)]

def select_metric(payload, names):
    candidates = []
    for concept in names:
        rows = annual_rows(payload, concept)
        if rows:
            candidates.append((concept, rows))
    if not candidates:
        return None, [], None
    # Prefer the concept with the most recent annual filing. Older, deprecated
    # concepts must never win merely because they contain more history.
    concept, rows = max(candidates, key=lambda x: (x[1][-1]["periodEnd"], len(x[1])))
    return concept, rows, rows[-1]

def fact(value, concept, cik):
    if not value:
        return None
    return {"value": value["value"], "currency": "USD", "periodEnd": value["periodEnd"],
            "filed": value["filed"], "concept": "us-gaap:" + concept,
            "sourceUrl": f"{BASE}/CIK{cik}.json"}

def derived(current, prior, end_current, end_prior):
    result = {}
    for key, num, den in (("netMargin", "netIncome", "revenue"), ("equityRatio", "equity", "assets"), ("operatingCashFlowMargin", "operatingCashFlow", "revenue")):
        n, d = current.get(num, {}).get("value"), current.get(den, {}).get("value")
        if isinstance(n, (int,float)) and isinstance(d, (int,float)) and d > 0:
            result[key] = {"value": round(100*n/d, 2), "unit": "percent", "periodEnd": end_current, "basis": [num, den]}
    for key, metric in (("revenueGrowth", "revenue"), ("netIncomeGrowth", "netIncome")):
        n, p = current.get(metric, {}).get("value"), prior.get(metric, {}).get("value")
        if isinstance(n, (int,float)) and isinstance(p, (int,float)) and p > 0:
            result[key] = {"value": round(100*(n/p-1), 2), "unit": "percent", "periodEnd": end_current, "priorPeriodEnd": end_prior, "basis": [metric]}
    return result

def build_issuer(ticker, issuer, now):
    payload = get_json(f"{BASE}/CIK{issuer['cik']}.json")
    selected, series = {}, {}
    for label, names in CONCEPTS.items():
        concept, rows, latest = select_metric(payload, names)
        if concept and latest:
            selected[label] = (concept, latest)
            series[label] = rows
    # Keep one internally comparable fiscal year: prefer the latest period that
    # is covered by the most required metrics instead of mixing reporting years.
    end_counts = {}
    for rows in series.values():
        for row in rows:
            end_counts[row["periodEnd"]] = end_counts.get(row["periodEnd"], 0) + 1
    end = max(end_counts, key=lambda value: (end_counts[value], value)) if end_counts else ""
    current, prior = {}, {}
    previous_end = ""
    for label, (concept, row) in selected.items():
        rows = series[label]
        matching = [x for x in rows if x["periodEnd"] == end]
        if matching:
            current[label] = fact(matching[-1], concept, issuer["cik"])
        earlier = [x for x in rows if x["periodEnd"] < end]
        if earlier:
            prior[label] = fact(earlier[-1], concept, issuer["cik"])
            previous_end = max(previous_end, earlier[-1]["periodEnd"])
    report_url = f"{BASE}/CIK{issuer['cik']}.json"
    required = {"revenue", "netIncome", "assets", "equity", "operatingCashFlow"}
    status = "metrics-complete" if required.issubset(current) else ("metrics-partial" if len(current) >= 3 else "filing-no-validated-metrics")
    latest_filing = {"periodEnd": end, "published": max((x.get("filed","") for x in current.values()), default=""), "reportUrl": report_url, "filingSystem": "SEC EDGAR"}
    return {
      "name": issuer["name"], "ticker": ticker, "isin": issuer["isin"], "cik": issuer["cik"],
      "reportCurrency": "USD", "investorRelations": issuer["ir"], "status": status,
      "metrics": current, "priorMetrics": prior, "derived": derived(current, prior, end, previous_end),
      "latestFiling": latest_filing if end else None,
      "priorFiling": {"periodEnd": previous_end} if previous_end else None,
      "checkedAt": now, "source": "SEC EDGAR Company Facts · XBRL", "errors": []
    }

def main():
    now = dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    items = {}
    for ticker, issuer in ISSUERS.items():
        try:
            items[ticker] = build_issuer(ticker, issuer, now)
            print(ticker, items[ticker]["status"], list(items[ticker]["metrics"]), flush=True)
        except RuntimeError as exc:
            items[ticker] = {"name": issuer["name"], "ticker": ticker, "isin": issuer["isin"], "cik": issuer["cik"], "status": "source-unavailable", "metrics": {}, "priorMetrics": {}, "derived": {}, "latestFiling": None, "priorFiling": None, "checkedAt": now, "source": "SEC EDGAR Company Facts · XBRL", "errors": [str(exc)[:180]], "investorRelations": issuer["ir"], "reportCurrency": "USD"}
    snapshot = {"schemaVersion": 1, "generatedAt": now, "source": "SEC EDGAR Company Facts · XBRL", "scope": "US/SEC issuer universe; annual XBRL facts only, no estimated valuation", "items": items}
    OUTPUT.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")

if __name__ == "__main__":
    main()
