#!/usr/bin/env python3
"""UNITY: source-checked European financial report discovery, no invented figures.

Pilot: ABB, Schneider Electric, Siemens Energy, Infineon.
XBRL International's public ESEF index is incomplete, especially DE and CH.
Only facts with one unambiguous, non-segmented consolidated context and
matching fiscal period/currency are eligible. No valuation/trade signals.\nData availability is checked independently for each company.
"""
import datetime as dt
import json
import pathlib
import urllib.error
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "data" / "fundamentals.json"
BASE = "https://filings.xbrl.org"
PILOT = {
    "CH0012221716": {"name": "ABB", "lei": None, "currency": "USD",
                     "investor": "https://global.abb/group/en/investors",
                     "note": "Schweizer Emittent: ESEF-Berichterstattung nicht voraussetzbar; Konzern berichtet in USD."},
    "FR0000121972": {"name": "Schneider Electric", "lei": "969500A1YF1XUYYXS284", "currency": "EUR",
                     "investor": "https://www.se.com/ww/en/about-us/investor-relations/",
                     "note": "ESEF-Recherche über eindeutige französische Konzern-LEI."},
    "DE000ENER6Y0": {"name": "Siemens Energy", "lei": "5299005CHJZ14D4FDJ62", "currency": "EUR",
                     "investor": "https://www.siemens-energy.com/global/en/home/investor-relations.html",
                     "note": "Deutsche ESEF-Berichte im öffentlichen Archiv möglicherweise nicht vorhanden."},
    "DE0006231004": {"name": "Infineon", "lei": "TSI2PJM6EPETEQ4X1U25", "currency": "EUR",
                     "investor": "https://www.infineon.com/cms/en/about-infineon/investor/",
                     "note": "Deutsche ESEF-Berichte im öffentlichen Archiv möglicherweise nicht vorhanden."},
}
CONCEPTS = {
    "revenue": ("Revenue", "RevenueFromContractsWithCustomers", "SalesRevenueNet"),
    "netIncome": ("ProfitLoss", "ProfitLossAttributableToOwnersOfParent"),
    "assets": ("Assets",),
    "equity": ("Equity", "EquityAttributableToOwnersOfParent"),
    "operatingCashFlow": ("CashFlowsFromUsedInOperatingActivities",),
}
DURATION = {"revenue", "netIncome", "operatingCashFlow"}
HEADERS = {"User-Agent": "UNITY-Lab-Research/0.10 (https://github.com/kontextron-oss/-unity-lab-pwa)",
           "Accept": "application/vnd.api+json, application/json"}
def get_json(url, max_bytes=7_000_000):
    if not url.startswith(BASE + "/"): raise ValueError("unexpected host")
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=20) as response:
        if int(response.headers.get("Content-Length", 0)) > max_bytes:
            raise ValueError("source too large")
        payload = response.read(max_bytes+1)
        if len(payload)>max_bytes: raise ValueError("source too large")
    return json.loads(payload)

def safe_link(value):
    if not isinstance(value,str): return None
    if value.startswith("/"): value=BASE+value
    if not value.startswith(BASE+"/"): return None
    return value

def find_filings(lei):
    # Entity-specific route prevents similar-name subsidiaries from being mixed.
    url=BASE+"/api/entities/"+urllib.parse.quote(lei)+"/filings?page%5Bsize%5D=12"
    data=get_json(url, 1_000_000)
    print("ESEF entity",lei,"returned",len(data.get("data",[])),"entries",flush=True)
    if data.get("data"):
        first=data["data"][0]
        print("ESEF first id",str(first.get("id"))[:100],"attribute keys",list((first.get("attributes") or {}).keys())[:30],flush=True)
    result=[]
    for item in data.get("data", []):
        attrs=item.get("attributes") or {}
        fid=str(attrs.get("fxo_id") or "")
        # IDs contain the LEI and must never resolve to another group company.
        if not fid.startswith(lei+"-"): continue
        period=attrs.get("period_end") or attrs.get("period-end") or ""
        if not isinstance(period,str) or not period[:4].isdigit(): continue
        json_url=safe_link(attrs.get("json_url") or attrs.get("json-url"))
        viewer=safe_link(attrs.get("viewer_url") or attrs.get("viewer-url"))
        result.append({"id":fid,"periodEnd":period[:10],"published":attrs.get("published"),
                       "reportUrl":viewer,"jsonUrl":json_url,
                       "filingSystem":"ESEF" if "-ESEF-" in fid else "Other",
                       "validationErrors":attrs.get("error_count"),"validationWarnings":attrs.get("warning_count")})
    return sorted(result,key=lambda x:x["periodEnd"],reverse=True)

def period_end(value):
    if not isinstance(value,str): return None
    try: return dt.date.fromisoformat(value[:10])
    except ValueError: return None

def valid_fact(fact, target_end, currency, duration):
    dims=fact.get("dimensions") or {}
    # Do not silently mix business segments, other reporting entities, or
    # differently scoped facts into group financial statements.
    if any(k not in {"concept","entity","period","unit","language","noteId"} for k in dims):
        return False
    if dims.get("unit") not in {"iso4217:"+currency, currency}: return False
    period=dims.get("period")
    if not isinstance(period,str): return False
    try:
        parts=period.split("/")
        if duration and len(parts)!=2: return False
        if not duration and len(parts)!=1: return False
        end=period_end(parts[-1])
        if not end or abs((end-target_end).days)>3:return False
        if duration:
            start=period_end(parts[0])
            if not start or not 330 <= (end-start).days <= 400:return False
    except (TypeError,ValueError): return False
    value=fact.get("value")
    return isinstance(value,(float,int,str)) and str(value).strip() not in {"","NaN","INF"}

def extract_metrics(document, fiscal_end, currency, source):
    target=period_end(fiscal_end)
    if not target:return {}
    facts=document.get("facts") or {}
    if not isinstance(facts,dict):return {}
    result={}
    for label,names in CONCEPTS.items():
        for concept in names:
            matches=[]
            for fact in facts.values():
                dims=fact.get("dimensions") or {}
                if dims.get("concept") not in {"ifrs-full:"+concept,"https://xbrl.ifrs.org/taxonomy/2024-03-27/ifrs-full#"+concept}:
                    continue
                if not valid_fact(fact,target,currency,label in DURATION):continue
                try: value=float(fact["value"])
                except (TypeError,ValueError,OverflowError):continue
                if not -1e15<value<1e15:continue
                matches.append(value)
            # Duplicate equal facts are fine; conflicting figures are not.
            unique={round(v,2) for v in matches}
            if len(unique)==1:
                result[label]={"value":matches[0],"currency":currency,"periodEnd":fiscal_end,
                               "concept":"ifrs-full:"+concept,"sourceUrl":source}
                break
    return result

def build():
    old={}
    if OUTPUT.exists():
        try:old=json.loads(OUTPUT.read_text(encoding="utf-8")).get("items",{})
        except (OSError,ValueError):pass
    now=dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")
    items={}
    for isin,stock in PILOT.items():
        row={"name":stock["name"],"isin":isin,"lei":stock["lei"],
             "reportCurrency":stock["currency"],"investorRelations":stock["investor"],
             "note":stock["note"],"status":"not-covered","metrics":{},
             "latestFiling":None,"checkedAt":now,"source":"filings.xbrl.org ESEF (XBRL International)",
             "errors":[]}
        if not stock["lei"]:
            row["status"]="no-esef-route"
        else:
            try:
                filings=find_filings(stock["lei"])
                print(stock["name"],"filings",len(filings),flush=True)
                if not filings:
                    row["status"]="no-filing-found"
                else:
                    row["latestFiling"]=filings[0]
                    row["status"]="filing-found"
                    docurl=filings[0].get("jsonUrl")
                    if docurl:
                        try:
                            report=get_json(docurl)
                            row["metrics"]=extract_metrics(report,filings[0]["periodEnd"],stock["currency"],docurl)
                            row["status"]="metrics-partial" if row["metrics"] else "filing-no-validated-metrics"
                        except (ValueError,urllib.error.URLError,TimeoutError,KeyError) as ex:
                            row["errors"].append("xBRL-JSON: "+str(ex)[:140])
            except urllib.error.HTTPError as ex:
                row["status"]="no-filing-found" if ex.code==404 else "source-unavailable"
                if ex.code!=404:row["errors"].append("ESEF API: HTTP "+str(ex.code))
            except (ValueError,urllib.error.URLError,TimeoutError,KeyError) as ex:
                row["status"]="source-unavailable"
                row["errors"].append("ESEF API: "+str(ex)[:140])
        # Preserve only a previous successful filing snapshot on temporary API
        # outage, explicitly marked stale; never silently present it as fresh.
        prior=old.get(isin) or {}
        if row["status"]=="source-unavailable" and prior.get("latestFiling"):
            row["latestFiling"]=prior["latestFiling"]
            row["metrics"]=prior.get("metrics",{})
            row["status"]="stale-previous"
            row["previousCheckedAt"]=prior.get("checkedAt")
        items[isin]=row
        print(stock["name"],row["status"],"metrics",list(row["metrics"]),flush=True)
    output={"schemaVersion":1,"generatedAt":now,"source":"XBRL International filings.xbrl.org",
            "scope":"Four European pilot issuers; partial annual filings, no live valuations",
            "items":items}
    OUTPUT.parent.mkdir(parents=True,exist_ok=True)
    OUTPUT.write_text(json.dumps(output,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print("Fundamental pilot saved",len(items),flush=True)

if __name__=="__main__":build()
