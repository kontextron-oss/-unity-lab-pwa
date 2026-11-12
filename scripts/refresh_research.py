#!/usr/bin/env python3
"""UNITY official issuer research monitor. No paid APIs, no synthetic investment advice.

SEC EDGAR submissions + XBRL companyfacts provide US issuer reports and filing
event metadata. Existing EU issuer/XBRL source is only *referenced*, not overwritten.
Never treat 8-K as good/bad news without reading its contents. No article scraping.
A broken source preserves the last known snapshot with an explicit stale status.
"""
from __future__ import annotations
import datetime as dt
import json
import os
import pathlib
import time
import urllib.error
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
DEST = ROOT / "data" / "research.json"
EU = ROOT / "data" / "fundamentals.json"
BASE = "https://data.sec.gov"
TICKERS = "https://www.sec.gov/files/company_tickers.json"
# Explicit public catalog mapping; no access to personal device holdings.
US = {
    "IE00B8KQN827": ("ETN", "Eaton"),
    "US92537N1081": ("VRT", "Vertiv"),
    "US36828A1016": ("GEV", "GE Vernova"),
    "IE00BDVJJQ56": ("NVT", "nVent"),
    "US4435106079": ("HUBB", "Hubbell"),
    "US74762E1029": ("PWR", "Quanta Services"),
    "AMD": ("AMD", "AMD"),  # Catalog issuer currently has no verified ISIN.
    "AAPL": ("AAPL", "Apple"),
    "MSFT": ("MSFT", "Microsoft"),
    "NVDA": ("NVDA", "NVIDIA"),
}
# SEC-verified issuer CIKs: used only if the SEC's public ticker index is down.
# Every match is checked again against the ticker and CIK in SEC submissions.
# Additional names are deliberately omitted rather than guessed.
VERIFIED_CIK_FALLBACK = {
    "VRT": (1674101, "VERTIV HOLDINGS CO"),
    "PWR": (1050915, "QUANTA SERVICES INC"),
    "AMD": (2488, "ADVANCED MICRO DEVICES INC"),
    "AAPL": (320193, "APPLE INC"),
    "MSFT": (789019, "MICROSOFT CORP"),
    "NVDA": (1045810, "NVIDIA CORP"),
}
ALLOWED_FORMS = {"10-K", "10-Q", "8-K", "20-F", "6-K", "10-K/A", "10-Q/A", "8-K/A", "20-F/A", "6-K/A"}
FORM_LABELS = {
    "10-K": "Jahresbericht", "10-Q": "Quartalsbericht",
    "8-K": "Unternehmensmeldung", "20-F": "Ausländischer Jahresbericht",
    "6-K": "Mitteilung ausländischer Emittenten"
}
# SEC item codes classify the filing topic, never its economic direction.
# They are an explicit instruction to review the original document, not a trade signal.
EVENT_RULES = {
    "5.02": ("Führungswechsel / Management", "leadership"),
    "1.05": ("Cybersecurity-Ereignis", "cybersecurity"),
    "4.02": ("Rechnungslegung überprüfen", "accounting"),
    "2.06": ("Wertminderung / Abschreibung", "impairment"),
    "1.02": ("Wesentlicher Vertragsverlust", "contract"),
    "2.04": ("Fälligkeit / Finanzierung prüfen", "financing"),
}
def filing_event_metadata(form, item_codes):
    codes = {part.strip() for part in str(item_codes or "").replace(";", ",").split(",") if part.strip()}
    for code, (label, event_class) in EVENT_RULES.items():
        if code in codes:
            return label, event_class, "review"
    return FORM_LABELS.get(form, "Pflichtveröffentlichung"), "filing", "review"
DURATION = {
    "revenue": ("Revenues", "RevenueFromContractWithCustomerExcludingAssessedTax",
                "RevenueFromContractWithCustomerIncludingAssessedTax", "SalesRevenueNet"),
    "netIncome": ("NetIncomeLoss", "ProfitLoss"),
    "operatingCashFlow": ("NetCashProvidedByUsedInOperatingActivities",),
}
INSTANT = {
    "assets": ("Assets",),
    "equity": ("StockholdersEquity", "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest"),
    "liabilities": ("Liabilities",)
}
HEADERS = {
    # Real project/contact URL; SEC expects identifiable automated access.
    "User-Agent": "UNITY-LAB-Research (https://github.com/kontextron-oss/-unity-lab-pwa)",
    "Accept": "application/json"
}

def iso_now():
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")

def get_json(url, max_bytes=12_000_000):
    if not (url.startswith(BASE + "/") or url == TICKERS):
        raise ValueError("Host nicht auf der SEC-Positivliste")
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=22) as r:
        if int(r.headers.get("Content-Length", 0)) > max_bytes:
            raise ValueError("SEC-Antwort zu groß")
        raw = r.read(max_bytes + 1)
    if len(raw) > max_bytes:
        raise ValueError("SEC-Antwort zu groß")
    return json.loads(raw)

def ticker_map(doc):
    records = doc.values() if isinstance(doc, dict) else doc
    found = {}
    for x in records:
        if not isinstance(x, dict):
            continue
        symbol = str(x.get("ticker") or "").upper()
        cik = x.get("cik_str")
        if not symbol or not isinstance(cik, int) or cik <= 0:
            continue
        found.setdefault(symbol, set()).add((cik, str(x.get("title") or "")))
    return {symbol: next(iter(values)) for symbol, values in found.items() if len(values) == 1}

def filing_events(subs, cik):
    recent = (subs.get("filings") or {}).get("recent") or {}
    forms = recent.get("form") or []
    keys = ("accessionNumber", "filingDate", "primaryDocument")
    item_codes = recent.get("items") or []
    rows = []
    for i, form in enumerate(forms):
        if form not in ALLOWED_FORMS or form.endswith("/A"):
            continue
        try:
            accession, date, doc = (recent[k][i] for k in keys)
            day = dt.date.fromisoformat(date)
            if day > dt.date.today() or day < dt.date.today()-dt.timedelta(days=420):
                continue
            if not (isinstance(doc, str) and doc and "/" not in doc and ".." not in doc):
                continue
            digits = str(accession).replace("-", "")
            if not (digits.isdigit() and len(digits) == 18):
                continue
            url = "https://www.sec.gov/Archives/edgar/data/{}/{}/{}".format(cik, digits, doc)
            label, event_class, decision_impact = filing_event_metadata(form, item_codes[i] if i < len(item_codes) else "")
            rows.append({"form":form, "label":label, "eventClass":event_class,
                         "decisionImpact":decision_impact, "filedAt":date, "url":url, "source":"SEC EDGAR"})
        except (IndexError, KeyError, TypeError, ValueError):
            continue
    rows.sort(key=lambda x: x["filedAt"], reverse=True)
    return rows[:10]

def choose_fact(companyfacts, tags, kind):
    # Only exact SEC-reported USD consolidated facts, with a 10-K/10-Q frame.
    concepts = (companyfacts.get("facts") or {}).get("us-gaap") or {}
    candidates = []
    for tag in tags:
        obj = concepts.get(tag)
        records = (obj.get("units") or {}).get("USD", []) if isinstance(obj, dict) else []
        for fact in records:
            try:
                if fact.get("form") not in ("10-K", "10-Q"):
                    continue
                if fact.get("accn") is None:
                    continue
                filed = dt.date.fromisoformat(fact["filed"])
                end = dt.date.fromisoformat(fact["end"])
                if end > dt.date.today() or end < dt.date.today()-dt.timedelta(days=700):
                    continue
                value = fact["val"]
                if isinstance(value, bool) or not isinstance(value, (int, float)) or abs(value) > 1e16:
                    continue
                if kind == "duration":
                    start = dt.date.fromisoformat(fact["start"])
                    days = (end - start).days
                    if fact["form"] == "10-K":
                        if not 330 <= days <= 400: continue
                        period = "FY"
                    else:
                        if not 75 <= days <= 105: continue
                        period = "Q"
                else:
                    if "start" in fact: continue
                    period = "I"
                candidates.append({"value":value, "unit":"USD", "period":period, "end":end.isoformat(),
                    "filed":filed.isoformat(), "form":fact["form"], "concept":"us-gaap:"+tag,
                    "accession":fact["accn"]})
            except (TypeError, ValueError, KeyError):
                continue
    if not candidates: return None
    # Same fiscal end/period may be repeated in later filings (comparatives).
    # Prefer the earliest timely original filing rather than a newer comparative.
    grouped = {}
    for f in candidates:
        key = (f["end"], f["period"])
        grouped.setdefault(key, []).append(f)
    complete = []
    for key, group in grouped.items():
        earliest = min(x["filed"] for x in group)
        primary = [x for x in group if x["filed"] == earliest]
        if len({x["value"] for x in primary}) != 1:
            continue
        v = primary[0]
        # Avoid corrupted or future original filings:
        complete.append(v)
    complete.sort(key=lambda x:(x["end"],x["period"] == "FY",x["filed"]), reverse=True)
    return complete[0] if complete else None

def sec_report(ticker, expected_name, cik, legal_name, now):
    padded = str(cik).zfill(10)
    subs = get_json(BASE+"/submissions/CIK"+padded+".json", 2_800_000)
    if int(subs.get("cik", -1)) != cik or ticker not in [str(x).upper() for x in subs.get("tickers", [])]:
        raise ValueError("SEC-CIK bzw. Börsenkürzel stimmt nicht mit Emittent überein")
    entries = filing_events(subs, cik)
    result = {"ticker":ticker,"name":expected_name,"legalName":legal_name,"cik":padded,
              "status":"filings-only","checkedAt":now,"source":"SEC EDGAR",
              "sourceUrl":BASE+"/submissions/CIK"+padded+".json",
              "events":entries,"metrics":{},"issues":[],
              "note":"Meldungstyp und Veröffentlichungstag sind keine Sentiment- oder Kaufentscheidung."}
    try:
        facts = get_json(BASE+"/api/xbrl/companyfacts/CIK"+padded+".json", 11_000_000)
        if int(facts.get("cik", -1)) != cik:
            raise ValueError("Companyfacts-CIK stimmt nicht überein")
        for field,tags in DURATION.items():
            obj = choose_fact(facts,tags,"duration")
            if obj: result["metrics"][field]=obj
        for field,tags in INSTANT.items():
            obj=choose_fact(facts,tags,"instant")
            if obj: result["metrics"][field]=obj
        if result["metrics"]: result["status"]="metrics-partial"
        else: result["issues"].append("Keine eindeutig vergleichbaren jüngsten US-GAAP-Fakten")
    except (urllib.error.URLError, ValueError, KeyError) as e:
        result["issues"].append("SEC-XBRL-Kennzahlen derzeit nicht abrufbar: "+type(e).__name__)
    return result

def euro_sources():
    if not EU.exists(): return {}
    data=json.loads(EU.read_text(encoding="utf-8"))
    now=iso_now()
    sources={}
    for isin, f in (data.get("items") or {}).items():
        if not isinstance(f,dict) or f.get("isin") != isin:continue
        events=[]
        last=f.get("latestFiling") or {}
        if last.get("reportUrl") and last.get("periodEnd"):
            events.append({"form":"ESEF","label":"Veröffentlichter Jahresbericht",
                "filedAt":str(last.get("published") or "")[:10],
                "url":last["reportUrl"],"source":"XBRL International"})
        highlights=f.get("officialHighlights") or {}
        if highlights.get("sourceUrl"):
            events.append({"form":"ISSUER","label":"Offizielle Unternehmensmitteilung",
                # verifiedAt is the date OUR collector checked the report, not when it was published.
                "filedAt":str(highlights.get("publishedAt") or "")[:10],
                "url":highlights["sourceUrl"],"source":"Emittent / Pflichtmitteilung"})
        sources[isin]={"name":f.get("name"),"isin":isin,"status":"european-pilot",
          "checkedAt":f.get("checkedAt") or now,"source":"XBRL / Emittentenpilot",
          "sourceUrl":last.get("reportUrl") or f.get("investorRelations"),
          "events":events[:5],"metrics":{},
          "issues":["Europäische Bilanzkennzahlen im bestehenden Pilot ansehen; keine doppelten SEC-Fakten."]}
    return sources

def build(previous=None, fetch=get_json, clock=iso_now):
    # Allows hermetic tests of the resolver via injected API.
    global get_json
    original=get_json
    get_json=fetch
    try:
        now=clock()
        prev=(previous or {}).get("items") or {}
        items=euro_sources()
        failed=0
        try:
            mapping=ticker_map(get_json(TICKERS,2_200_000))
        except (urllib.error.URLError, ValueError, KeyError) as exc:
            mapping=dict(VERIFIED_CIK_FALLBACK)
            # Direct issuer lookup still must validate both CIK and ticker.
            print("SEC-Ticker-Verzeichnis nicht abrufbar; nur SEC-geprüfte CIK-IDs probieren",
                  type(exc).__name__,flush=True)
        for key,(ticker,name) in US.items():
            try:
                if ticker not in mapping:
                    raise ValueError("SEC-Ticker nicht eindeutig auffindbar")
                cik,legal=mapping[ticker]
                time.sleep(.2) # Conservative SEC traffic; below fair-access threshold.
                items[key]=sec_report(ticker,name,cik,legal,now)
            except (urllib.error.URLError,ValueError,KeyError,TimeoutError,OSError) as e:
                failed+=1
                prior=prev.get(key)
                if prior and prior.get("status") not in ("source-unavailable","stale-previous"):
                    items[key]={**prior,"status":"stale-previous",
                        "issues":["Quelle seit letzter erfolgreichen Sicherung nicht erreichbar; ältere Daten nur als Archiv."]}
                else:
                    items[key]={"ticker":ticker,"name":name,"status":"source-unavailable",
                        "checkedAt":now,"source":"SEC EDGAR","events":[],"metrics":{},
                        "issues":["Keine verifizierten Daten bei diesem Abruf: "+type(e).__name__]}
        return {"schemaVersion":1,"generatedAt":now,"source":"SEC EDGAR und XBRL-/Emittentenpilot",
                "scope":"Öffentliche Emittenten, keine privaten Portfoliodaten",
                "usIssuerCount":len(US),"sourceFailures":failed,"items":items}
    finally:
        get_json=original

def main():
    previous=None
    if DEST.exists():
        try: previous=json.loads(DEST.read_text(encoding="utf-8"))
        except (ValueError,OSError):pass
    data=build(previous)
    DEST.parent.mkdir(parents=True,exist_ok=True)
    temp=DEST.with_suffix(".json.tmp")
    temp.write_text(json.dumps(data,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    temp.replace(DEST)
    print("Research monitor:",len(data["items"]),"issuers;",data["sourceFailures"],"SEC failures")

if __name__=="__main__":
    main()
