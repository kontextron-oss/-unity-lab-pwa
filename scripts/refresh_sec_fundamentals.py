#!/usr/bin/env python3
"""Build a source-bound US fundamentals snapshot from SEC Company Facts.

No browser requests, no API key and no estimated values. Snapshot publication is atomic. A company is published
only with its own CIK-bound SEC facts. Missing concepts remain missing.
"""
from __future__ import annotations
import datetime as dt
import json
import math
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
 "GEV": {"cik": "0001996810", "name": "GE Vernova", "isin": "US36828A1016", "ir": "https://www.gevernova.com/investors"},
 "VRT": {"cik": "0001674101", "name": "Vertiv", "isin": "US92537N1081", "ir": "https://investors.vertiv.com/"},
 "ETN": {"cik": "0001551182", "name": "Eaton", "isin": "IE00B8KQN827", "ir": "https://www.eaton.com/us/en-us/company/investor-relations.html"},
}
CONCEPTS = {
 "revenue": ("RevenueFromContractWithCustomerExcludingAssessedTax", "RevenueFromContractWithCustomerIncludingAssessedTax", "Revenues", "SalesRevenueNet", "SalesRevenueGoodsNet"),
 "netIncome": ("NetIncomeLoss",),
 "assets": ("Assets",),
 "equity": ("StockholdersEquity", "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest"),
 "operatingCashFlow": ("NetCashProvidedByUsedInOperatingActivities",),
}
# Valuation inputs are supplemental: they never change the completeness of a
# financial filing and stay absent when their SEC XBRL unit is not exact.
VALUATION_CONCEPTS = {
 "epsDiluted": (("EarningsPerShareDiluted",), ("USD/shares",)),
 "sharesDiluted": (("WeightedAverageNumberOfDilutedSharesOutstanding",), ("shares",)),
 "capitalExpenditure": (("PaymentsToAcquirePropertyPlantAndEquipment",), ("USD",)),
 # Balance-sheet shares are as of the fiscal date. Never use diluted weighted
 # annual-average shares as a substitute for end-of-period share count.
 "sharesOutstanding": (("CommonStockSharesOutstanding",), ("shares",)),
 "cashAndEquivalents": (("CashAndCashEquivalentsAtCarryingValue",), ("USD",)),
 # These are debt COMPONENTS, not a complete total-debt guarantee.
 "debtLongTermNoncurrent": (("LongTermDebtNoncurrent",), ("USD",)),
 "debtLongTermIncludingCurrent": (
      ("LongTermDebtAndCapitalLeaseObligationsIncludingCurrentMaturities",
       "LongTermDebtAndFinanceLeaseObligationsIncludingCurrentMaturities"), ("USD",)),
 "shortTermBorrowings": (("ShortTermBorrowings",), ("USD",)),

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

# A '10-K' form with 'fp=FY' can still contain Q4, nine-month or balance-
# sheet values. A true annual FLOW must have a ~52-week start/end interval;
# instant facts (assets, shares, debt) must have no 'start' field.
INSTANT_LABELS = {"assets", "equity", "sharesOutstanding", "cashAndEquivalents",
                  "debtLongTermNoncurrent", "debtLongTermIncludingCurrent",
                  "shortTermBorrowings"}
REQUIRED_CORE = {"revenue", "netIncome", "assets", "equity", "operatingCashFlow"}
MAX_ANNUAL_AGE_DAYS = 540

def annual_rows(payload, concept, accepted_units=("USD",), *, instant=False):
    facts = ((payload.get("facts") or {}).get("us-gaap") or {}).get(concept) or {}
    unit_map = facts.get("units") or {}
    out = []
    for unit in accepted_units:
        for row in unit_map.get(unit, []):
            if row.get("form") not in FORMS or row.get("fp") != "FY":
                continue
            try:
                value = float(row["val"])
                end = dt.date.fromisoformat(str(row["end"]))
                filed = dt.date.fromisoformat(str(row["filed"]))
                start_text = row.get("start")
                start = dt.date.fromisoformat(str(start_text)) if start_text else None
            except (KeyError, TypeError, ValueError):
                continue
            if not math.isfinite(value) or abs(value) >= 1e15 or filed < end:
                continue
            if instant:
                if start is not None:
                    continue
            else:
                if start is None or not 330 <= (end-start).days <= 385:
                    # FY in an SEC filing does NOT guarantee a 12-month value.
                    continue
            out.append({"value": value, "unit": unit,
                        "periodEnd": end.isoformat(), "start": start.isoformat() if start else None,
                        "filed": filed.isoformat(), "form": row.get("form"),
                        "accn": row.get("accn"), "fy": str(row.get("fy") or "")})
    # Keep the latest explicitly filed annual value per SAME period, not the
    # latest datapoint irrespective of its reporting span.
    selected = {}
    for row in sorted(out, key=lambda x: (x["periodEnd"], x["filed"], str(x.get("accn") or ""))):
        selected[row["periodEnd"]] = row
    return [selected[key] for key in sorted(selected)]

def select_metric(payload, names, accepted_units=("USD",), *, instant=False):
    candidates = []
    for concept in names:
        rows = annual_rows(payload, concept, accepted_units, instant=instant)
        if rows:
            candidates.append((concept, rows))
    if not candidates:
        return None, [], None
    # Select the best current concept rather than the deprecated concept with
    # the greatest number of old filings. Never combine two concepts in a sum.
    concept, rows = max(candidates, key=lambda x: (x[1][-1]["periodEnd"], len(x[1])))
    return concept, rows, rows[-1]

def annual_period_quality(period_end, now):
    try:
        year_end = dt.date.fromisoformat(str(period_end))
        date = dt.datetime.fromisoformat(now.replace("Z", "+00:00")).date()
    except (ValueError, TypeError, AttributeError):
        return {"status": "unverified", "ageDays": None, "maxAgeDays": MAX_ANNUAL_AGE_DAYS}
    age = (date-year_end).days
    return {"status": "current" if 0 <= age <= MAX_ANNUAL_AGE_DAYS else "stale",
            "ageDays": age, "maxAgeDays": MAX_ANNUAL_AGE_DAYS}

def fact(value, concept, cik):
    if not value:
        return None
    unit = str(value.get("unit") or "USD")
    return {"value": value["value"], "currency": "USD" if unit.startswith("USD") else None, "unit": unit,
            "periodEnd": value["periodEnd"], "filed": value["filed"], "concept": "us-gaap:" + concept,
            "sourceUrl": f"{BASE}/CIK{cik}.json"}

def derived(current, prior, end_current, end_prior):
    result = {}
    # Free cash flow is calculated only when both cash flow from operations and
    # cash capital expenditure come from the same annual SEC period.
    ocf, capex = current.get("operatingCashFlow", {}).get("value"), current.get("capitalExpenditure", {}).get("value")
    if isinstance(ocf, (int,float)) and isinstance(capex, (int,float)) and ocf > 0 and capex >= 0:
        result["freeCashFlow"] = {"value": round(ocf-capex, 2), "unit": "USD", "periodEnd": end_current,
                                    "basis": ["operatingCashFlow", "capitalExpenditure"], "kind": "derived"}
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
        concept, rows, latest = select_metric(payload, names, instant=label in INSTANT_LABELS)
        if concept and latest:
            selected[label] = (concept, latest)
            series[label] = rows
    for label, (names, units) in VALUATION_CONCEPTS.items():
        concept, rows, latest = select_metric(payload, names, units, instant=label in INSTANT_LABELS)
        if concept and latest:
            selected[label] = (concept, latest)
            series[label] = rows
    # FIRST choose the newest complete YEAR-END among actual annual core facts.
    # Old logic maximised the number of rows, which incorrectly promoted 2009
    # Adobe / 2018 Microsoft / 2022 Quanta as 'latest'.
    candidate_ends = {r["periodEnd"] for key in REQUIRED_CORE for r in series.get(key, ())}
    if not candidate_ends:
        # Keep a supplemental-only source visible for review, but never
        # classify it as complete without the five required core facts.
        candidate_ends = {r["periodEnd"] for rows in series.values() for r in rows}
    now_day = dt.datetime.fromisoformat(now.replace("Z", "+00:00")).date()
    valid_ends = [end for end in candidate_ends if dt.date.fromisoformat(end) <= now_day]
    end = max(valid_ends, default="")
    previous_end = ""
    if end:
        previous = [p for p in valid_ends if
                    330 <= (dt.date.fromisoformat(end)-dt.date.fromisoformat(p)).days <= 400]
        previous_end = max(previous, default="")
    current, prior = {}, {}
    for label, (concept, _) in selected.items():
        by_end = {r["periodEnd"]:r for r in series[label]}
        if end in by_end:
            current[label] = fact(by_end[end], concept, issuer["cik"])
        if previous_end and previous_end in by_end:
            prior[label] = fact(by_end[previous_end], concept, issuer["cik"])
    quality = annual_period_quality(end, now)
    coverage = len(REQUIRED_CORE.intersection(current))
    if quality["status"] != "current":
        status = "filing-stale" if end else "filing-no-validated-metrics"
    else:
        status = ("metrics-complete" if coverage == len(REQUIRED_CORE) else
                  "metrics-partial" if coverage > 0 else "filing-no-validated-metrics")
    report_url = f"{BASE}/CIK{issuer['cik']}.json"
    latest_filing = {"periodEnd": end,
                     "published": max((x.get("filed","") for x in current.values()), default=""),
                     "reportUrl": report_url, "filingSystem": "SEC EDGAR"}
    errors=[]
    if quality["status"] == "stale":
        errors.append("SEC-FY-Jahresabschluss zu alt oder in Zukunft: "+end+
                      " · keine Bewertungs- oder Handelsfreigabe")
    if coverage < len(REQUIRED_CORE) and end:
        errors.append("Nur "+str(coverage)+"/5 verifizierte Konzernkennzahlen im neuesten Jahresabschluss "+end)
    return {
      "name": issuer["name"], "ticker": ticker, "isin": issuer["isin"], "cik": issuer["cik"],
      "reportCurrency": "USD", "investorRelations": issuer["ir"], "status": status,
      "metrics": current, "priorMetrics": prior,
      "derived": derived(current, prior, end, previous_end) if status == "metrics-complete" else {},
      "periodQuality": quality,
      "valuationInputs": {
         "sourceType": "sec-us-gaap-concepts",
         "note": "Instant shares / cash / debt components are not interchangeable with annual weighted average shares or total debt.",
         "completeDebtKnown": False, "forwardGuidanceVerified": False,
         "securities": "Common-stock only; issuer-level valuation may need share-class or ADS adjustment."
      },
      "latestFiling": latest_filing if end else None,
      "priorFiling": {"periodEnd": previous_end} if previous_end else None,
      "checkedAt": now, "source": "SEC EDGAR Company Facts · annual XBRL", "errors": errors
    }

def main():
    now = dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    previous = {}
    if OUTPUT.exists():
        try:
            previous = json.loads(OUTPUT.read_text(encoding="utf-8")).get("items", {})
        except (OSError, ValueError):
            pass
    items = {}
    for ticker, issuer in ISSUERS.items():
        try:
            items[ticker] = build_issuer(ticker, issuer, now)
            print(ticker, items[ticker]["status"], list(items[ticker]["metrics"]), flush=True)
        except RuntimeError as exc:
            old = previous.get(ticker) or {}
            identity_ok = all(old.get(k) == v for k, v in (
                ("ticker", ticker), ("isin", issuer["isin"]), ("cik", issuer["cik"])))
            if identity_ok and old.get("status") in {"metrics-complete", "metrics-partial", "stale-previous"} and old.get("latestFiling"):
                items[ticker] = {**old, "status": "stale-previous", "checkedAt": now,
                                 "lastVerifiedAt": old.get("lastVerifiedAt") or old.get("checkedAt"),
                                 "errors": ["SEC source unavailable: " + str(exc)[:160]]}
            else:
                items[ticker] = {"name": issuer["name"], "ticker": ticker, "isin": issuer["isin"], "cik": issuer["cik"], "status": "source-unavailable", "metrics": {}, "priorMetrics": {}, "derived": {}, "latestFiling": None, "priorFiling": None, "checkedAt": now, "source": "SEC EDGAR Company Facts · XBRL", "errors": [str(exc)[:180]], "investorRelations": issuer["ir"], "reportCurrency": "USD"}
    snapshot = {"schemaVersion": 1, "generatedAt": now, "source": "SEC EDGAR Company Facts · XBRL", "scope": "US/SEC issuer universe; annual XBRL facts only, no estimated valuation", "items": items}
    OUTPUT.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")

if __name__ == "__main__":
    main()
