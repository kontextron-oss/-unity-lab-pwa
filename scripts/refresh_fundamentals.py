#!/usr/bin/env python3
"""UNITY: source-checked European financial report discovery, no invented figures.

Pilot: ABB, Schneider Electric, Siemens Energy, Infineon.
XBRL International's public ESEF index is incomplete, especially DE and CH.
Only facts with one unambiguous, non-segmented consolidated context and
matching fiscal period/currency are eligible. No valuation/trade signals.\nData availability is checked independently for each company.
"""
import datetime as dt
import html
import re
from html.parser import HTMLParser
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

def derived_ratios(current, previous, end_current, end_previous):
    out={}
    for key,numerator,denominator in (
        ("netMargin","netIncome","revenue"),
        ("equityRatio","equity","assets"),
        ("operatingCashFlowMargin","operatingCashFlow","revenue")):
        n=current.get(numerator,{}).get("value")
        d=current.get(denominator,{}).get("value")
        if isinstance(n,(float,int)) and isinstance(d,(float,int)) and d>0:
            out[key]={"value":round(100*n/d,2),"unit":"percent","periodEnd":end_current,
                      "basis":[numerator,denominator]}
    a=period_end(end_current);b=period_end(end_previous)
    if a and b and 330<=(a-b).days<=400:
        for key,metric in (("revenueGrowth","revenue"),("netIncomeGrowth","netIncome")):
            n=current.get(metric,{}).get("value")
            p=previous.get(metric,{}).get("value")
            if isinstance(n,(float,int)) and isinstance(p,(float,int)) and p>0:
                out[key]={"value":round(100*(n/p-1),2),"unit":"percent",
                          "periodEnd":end_current,"priorPeriodEnd":end_previous,"basis":[metric]}
    return out


# Second, independently sourced route for issuers not covered by ESEF.
# This reads the issuer's own FY2025 press release. Unlike xBRL financial
# statements, these are a deliberately small, non-comparable highlights set.
OFFICIAL_SOURCES={
 "CH0012221716":{
  "url":"https://new.abb.com/news/detail/132985/q4-2025-results",
  "issuer":"ABB", "year":"2025", "currency":"USD",
  "facts":{
   "revenue":{"pattern":r"FY\s*2025.{0,1400}?Revenues\s*\$\s*(\d+(?:\.\d+)?)\s*billion","scale":1_000_000_000,"label":"Umsatz"},
   "operatingCashFlow":{"pattern":r"FY\s*2025.{0,1600}?Cash\s+flow\s+from\s+operating\s+activities\s*\$\s*([\d,]+)\s*million","scale":1_000_000,"label":"Operativer Cashflow"}
  }},
 "DE000ENER6Y0":{
  "url":"https://www.siemensenergy.com/us/en/home/press-releases/siemens-energy-fulfills-all-commitments---and-increases-mid-term.html",
  "issuer":"Siemens Energy","year":"2025","currency":"EUR",
  "facts":{
   "revenue":{"pattern":r"revenue\s+came\s+in\s+at\s*€\s*(\d+(?:\.\d+)?)\s*billion","scale":1_000_000_000,"label":"Umsatz"},
   "netIncome":{"pattern":r"Net\s+income\s+at\s*€\s*(\d+(?:\.\d+)?)\s*billion","scale":1_000_000_000,"label":"Jahresüberschuss"},
   "freeCashFlowPreTax":{"pattern":r"Free\s+cash\s+flow\s+pre\s+tax\s+rose\s+sharply\s+to\s*€\s*(\d+(?:\.\d+)?)\s*billion","scale":1_000_000_000,"label":"Free Cashflow vor Steuern"}
  }},
 "DE0006231004":{
  "url":"https://www.infineon.com/press-release/2025/infxx202511-021",
  "issuer":"Infineon","year":"2025","currency":"EUR",
  "facts":{
   "revenue":{"pattern":r"FY\s*2025:\s*Revenue\s*€\s*(\d+(?:\.\d+)?)\s*billion","scale":1_000_000_000,"label":"Umsatz"},
   "adjustedFreeCashFlow":{"pattern":r"positive\s+Adjusted\s+Free\s+Cash\s+Flow\s+of\s*€\s*(\d+(?:\.\d+)?)\s*billion","scale":1_000_000_000,"label":"Bereinigter Free Cashflow"}
  }}
}
class VisibleText(HTMLParser):
 def __init__(self):
  super().__init__();self.parts=[];self.hidden=0
 def handle_starttag(self,tag,attrs):
  if tag in {"script","style","noscript"}:self.hidden+=1
 def handle_endtag(self,tag):
  if tag in {"script","style","noscript"}:self.hidden=max(0,self.hidden-1)
 def handle_data(self,data):
  if not self.hidden:self.parts.append(data)
def parse_official_highlights(html_document,source):
 p=VisibleText();p.feed(html_document)
 text=re.sub(r"\s+"," ",html.unescape(" ".join(p.parts))).strip()
 if not re.search(r"\b"+re.escape(source["issuer"])+r"\b",text,re.I) or not re.search(r"\b2025\b",text):
  raise ValueError("Issuer or fiscal year not identifiable")
 facts={}
 for key,rule in source["facts"].items():
  matches=re.findall(rule["pattern"],text,re.I)
  values=set()
  for match in matches:
   try:values.add(float(match.replace(",",""))*rule["scale"])
   except ValueError:pass
  if len(values)==1:
   value=values.pop()
   if 0<value<1e12:
    facts[key]={"value":round(value),"currency":source["currency"],"periodEnd":source["year"],
                "label":rule["label"],"sourceUrl":source["url"],"kind":"issuer-release"}
 return facts
def official_highlights(isin):
 source=OFFICIAL_SOURCES.get(isin)
 if not source:return None
 req=urllib.request.Request(source["url"],headers={"User-Agent":HEADERS["User-Agent"],"Accept":"text/html"})
 with urllib.request.urlopen(req,timeout=20) as response:
  if int(response.headers.get("Content-Length",0))>2_500_000:raise ValueError("source too large")
  raw=response.read(2_500_001)
  if len(raw)>2_500_000:raise ValueError("source too large")
  encoding=response.headers.get_content_charset() or "utf-8"
 doc=raw.decode(encoding,errors="replace")
 facts=parse_official_highlights(doc,source)
 if not facts:raise ValueError("No unambiguous FY2025 issuer values")
 return {"fiscalYear":"2025","sourceUrl":source["url"],"sourceType":"issuer-press-release",
         "verifiedAt":dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
         "currency":source["currency"],"facts":facts}

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
             "note":stock["note"],"status":"not-covered","metrics":{},"priorMetrics":{},"derived":{},
             "latestFiling":None,"priorFiling":None,"officialHighlights":None,"checkedAt":now,"source":"filings.xbrl.org ESEF (XBRL International)",
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
                            previous=next((f for f in filings[1:] if f["periodEnd"]!=filings[0]["periodEnd"]),None)
                            if previous and previous.get("jsonUrl"):
                                row["priorFiling"]=previous
                                try:
                                    old_report=get_json(previous["jsonUrl"])
                                    row["priorMetrics"]=extract_metrics(old_report,previous["periodEnd"],stock["currency"],previous["jsonUrl"])
                                except (ValueError,urllib.error.URLError,TimeoutError,KeyError) as prior_error:
                                    row["errors"].append("Vorjahresbericht: "+str(prior_error)[:120])
                            row["derived"]=derived_ratios(row["metrics"],row["priorMetrics"],
                                filings[0]["periodEnd"],row["priorFiling"]["periodEnd"] if row["priorFiling"] else None)
                        except (ValueError,urllib.error.URLError,TimeoutError,KeyError) as ex:
                            row["errors"].append("xBRL-JSON: "+str(ex)[:140])
            except urllib.error.HTTPError as ex:
                row["status"]="no-filing-found" if ex.code==404 else "source-unavailable"
                if ex.code!=404:row["errors"].append("ESEF API: HTTP "+str(ex.code))
            except (ValueError,urllib.error.URLError,TimeoutError,KeyError) as ex:
                row["status"]="source-unavailable"
                row["errors"].append("ESEF API: "+str(ex)[:140])
        if isin in OFFICIAL_SOURCES:
            try:
                row["officialHighlights"]=official_highlights(isin)
                if row["status"] in {"no-esef-route","no-filing-found","source-unavailable"}:
                    row["status"]="issuer-release-only"
            except (ValueError,urllib.error.URLError,TimeoutError,LookupError) as ex:
                row["errors"].append("Offizielle Meldung: "+str(ex)[:140])
                previous_official=(old.get(isin) or {}).get("officialHighlights")
                if previous_official:
                    row["officialHighlights"]={**previous_official,"stale":True}
        # Preserve only a previous successful filing snapshot on temporary API
        # outage, explicitly marked stale; never silently present it as fresh.
        prior=old.get(isin) or {}
        if row["status"]=="source-unavailable" and prior.get("latestFiling"):
            row["latestFiling"]=prior["latestFiling"]
            row["metrics"]=prior.get("metrics",{})
            row["priorMetrics"]=prior.get("priorMetrics",{})
            row["priorFiling"]=prior.get("priorFiling")
            row["derived"]=prior.get("derived",{})
            row["status"]="stale-previous"
            row["previousCheckedAt"]=prior.get("checkedAt")
        items[isin]=row
        print(stock["name"],row["status"],"metrics",list(row["metrics"]),"issuer",list((row["officialHighlights"] or {}).get("facts",{})),flush=True)
    output={"schemaVersion":1,"generatedAt":now,"source":"XBRL International filings.xbrl.org",
            "scope":"Four European pilot issuers; partial annual filings, no live valuations",
            "items":items}
    OUTPUT.parent.mkdir(parents=True,exist_ok=True)
    OUTPUT.write_text(json.dumps(output,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print("Fundamental pilot saved",len(items),flush=True)

if __name__=="__main__":build()
