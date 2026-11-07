#!/usr/bin/env python3
"""UNITY model forecast laboratory: ex-ante, reproducible, non-trading baseline.

A 2026 revenue forecast can be registered ONLY before FY2026 ends, using
the full FY2024 and FY2025 SEC annual facts already public at registration.
Later filings are evaluated against the FROZEN model and the simpler no-growth
benchmark. A forecast record can never be revised in place. Actual outcomes
can be flagged for restatement review but not silently replaced.
This is a naive transparent baseline, NOT a calibrated probability forecast.
"""
from __future__ import annotations
import copy
import datetime as dt
import hashlib
import json
import math
import os
from pathlib import Path
import re
import tempfile

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/"data"/"sec-fundamentals.json"
OUTPUT=ROOT/"data"/"unity-model-forecasts.json"
MODEL="unity-revenue-momentum-shrink-v1"
SCHEMA=1
REQUIRED={"revenue","netIncome","assets","equity","operatingCashFlow"}
COMPANY={
  "PWR": ("US74762E1029","0001050915"),
  "GEV": ("US36828A1016","0001996810"),
  "VRT": ("US92537N1081","0001674101"),
  "ETN": ("IE00B8KQN827","0001551182")
}
URL=re.compile(r"^https://data\.sec\.gov/api/xbrl/companyfacts/CIK(\d{10})\.json$")
DATE=re.compile(r"^\d{4}-\d{2}-\d{2}$")

def day(value):
    if not isinstance(value,str) or not DATE.fullmatch(value):
        return None
    try:return dt.date.fromisoformat(value)
    except ValueError:return None

def allowed_identity(ticker,entry):
    expected=COMPANY.get(ticker)
    return bool(expected and isinstance(entry,dict) and
        entry.get("ticker")==ticker and entry.get("isin")==expected[0] and
        entry.get("cik")==expected[1] and entry.get("reportCurrency")=="USD")

def valid_revenue(entry,role,period):
    filing=entry.get("latestFiling") if role=="current" else entry.get("priorFiling")
    f=(entry.get("metrics") if role=="current" else entry.get("priorMetrics") or {}).get("revenue")
    if not isinstance(f,dict) or filing is None or filing.get("periodEnd")!=period:
        return None
    src=f.get("sourceUrl","")
    reg=URL.fullmatch(src)
    if (f.get("periodEnd")!=period or f.get("currency")!="USD" or
        f.get("unit")!="USD" or not str(f.get("concept","")).startswith("us-gaap:") or
        not reg or reg.group(1)!=entry["cik"]):
        return None
    if not isinstance(f.get("value"),(int,float)) or isinstance(f["value"],bool) or \
       not math.isfinite(f["value"]) or not 0<f["value"]<1e15:
        return None
    filed=day(f.get("filed"))
    if filed is None:return None
    return {"value":f["value"],"periodEnd":period,"filedAt":f["filed"],
            "sourceUrl":src,"concept":f["concept"],"currency":"USD","unit":"USD"}

def immutable_hash(value):
    return hashlib.sha256(json.dumps(value,sort_keys=True,ensure_ascii=False,
        separators=(",",":")).encode("utf-8")).hexdigest()

def candidate_for(ticker,issuer,now):
    if not allowed_identity(ticker,issuer) or issuer.get("status")!="metrics-complete":
        return None
    fiscal=(issuer.get("latestFiling") or {}).get("periodEnd")
    prior=(issuer.get("priorFiling") or {}).get("periodEnd")
    # Calendar-year reporters only in the first experimental cohort.
    # Other fiscal calendars require explicit future period window logic.
    if (not fiscal or not prior or not fiscal.endswith("-12-31") or
        not prior.endswith("-12-31")):
        return None
    last,prev=day(fiscal),day(prior)
    if not last or not prev or last.year-prev.year!=1:
        return None
    target=dt.date(last.year+1,12,31)
    if target<=now.date() or last>now.date():
        return None
    if not REQUIRED.issubset(issuer.get("metrics") or {}):
        return None
    current=valid_revenue(issuer,"current",fiscal)
    old=valid_revenue(issuer,"prior",prior)
    if not current or not old or current["concept"]!=old["concept"] or \
       day(current["filedAt"])>=now.date() or day(old["filedAt"])>=now.date():
        return None
    growth=current["value"]/old["value"]-1
    shrink=max(-.20,min(.25,0.5*growth))
    predicted=round(current["value"]*(1+shrink)/10_000_000)*10_000_000
    if predicted<=0:return None
    return {"id":f"{MODEL}:{ticker}:FY{target.year}",
      "modelId":MODEL,"createdAt":now.isoformat(timespec="seconds").replace("+00:00","Z"),
      "ticker":ticker,"isin":issuer["isin"],"cik":issuer["cik"],
      "metric":"revenue","targetPeriodEnd":target.isoformat(),
      "basePeriodEnd":fiscal,"priorPeriodEnd":prior,
      "inputs":{"current":current,"prior":old},
      "formula":"clamp(0.5*(FY_current_revenue/FY_prior_revenue-1),-20%,+25%); predicted=FY_current*(1+growth)",
      "historicGrowthPct":round(100*growth,2),
      "projectedGrowthPct":round(100*shrink,2),
      "predictedRevenueUSD":predicted,
      "flatRevenueBenchmarkUSD":current["value"],
      "nonProbabilistic":True,"calibrated":False,
      "purpose":"Forward one-year revenue, experimental benchmark; not a buy/sell or valuation signal"}

def observed_future(frozen,entry,now):
    if (not allowed_identity(frozen["ticker"],entry) or
        frozen["isin"]!=entry["isin"] or frozen["cik"]!=entry["cik"] or
        entry.get("status")!="metrics-complete" or
        (entry.get("latestFiling") or {}).get("periodEnd")!=frozen["targetPeriodEnd"]):
        return None
    metric=valid_revenue(entry,"current",frozen["targetPeriodEnd"])
    if not metric or metric["concept"]!=frozen["inputs"]["current"]["concept"]:
        return None
    filed=day(metric["filedAt"])
    registered=day(frozen["createdAt"][:10])
    target=day(frozen["targetPeriodEnd"])
    if (not filed or not registered or not target or filed<=registered or
        filed<target or filed>now.date()):
        return None
    actual=metric["value"]
    forecast=frozen["predictedRevenueUSD"]
    baseline=frozen["flatRevenueBenchmarkUSD"]
    err=round(100*(forecast/actual-1),2)
    flat=round(100*(baseline/actual-1),2)
    return {"valueUSD":actual,"filedAt":metric["filedAt"],
      "sourceUrl":metric["sourceUrl"],"concept":metric["concept"],
      "periodEnd":frozen["targetPeriodEnd"],"unit":"USD",
      "forecastErrorPct":err,"baselineErrorPct":flat,
      "absoluteErrorPct":abs(err),"baselineAbsoluteErrorPct":abs(flat),
      "outperformedFlatBaseline":abs(err)<abs(flat)}

def build(snapshot,previous,now):
    if not isinstance(now,dt.datetime) or now.tzinfo is None:
        raise ValueError("Timezone-aware current timestamp required")
    inputs=snapshot.get("items")
    if not isinstance(inputs,dict):raise ValueError("No SEC input map")
    history=previous.get("forecasts") or {}
    if not isinstance(history,dict):raise ValueError("Invalid earlier immutable model forecast journal")
    out={}
    for ident,prior in history.items():
        if not isinstance(prior,dict) or prior.get("frozen",{}).get("id")!=ident:
            raise ValueError("Invalid earlier forecast entry")
        immutable=prior["frozen"]
        if prior.get("forecastFingerprint")!=immutable_hash(immutable):
            raise ValueError("Forecast fingerprint changed: "+ident)
        out[ident]=copy.deepcopy(prior)
    for ticker in COMPANY:
        row=inputs.get(ticker)
        frozen=candidate_for(ticker,row,now) if row else None
        if frozen is not None and frozen["id"] not in out:
            out[frozen["id"]]={"frozen":frozen,
                "forecastFingerprint":immutable_hash(frozen),
                "status":"awaiting-audited-target-year",
                "verified":None,"observedCandidate":None}
    for ident,rec in out.items():
        frozen=rec["frozen"]
        row=inputs.get(frozen["ticker"]) or {}
        candidate=observed_future(frozen,row,now)
        original=rec.get("verified")
        if original:
            if candidate is None:
                rec["status"]="verified-previous-source-unavailable"
                rec["observedCandidate"]=None
            elif any(candidate.get(k)!=original.get(k) for k in
                    ("valueUSD","filedAt","sourceUrl","concept","periodEnd")):
                rec["status"]="revision-review"
                rec["observedCandidate"]=candidate
            else:
                rec["status"]="verified"
                rec["observedCandidate"]=None
        else:
            rec["status"]="verified" if candidate else "awaiting-audited-target-year"
            rec["verified"]=candidate
            rec["observedCandidate"]=None
    measured=[v for v in out.values() if v.get("verified") and
              v.get("status") in ("verified","verified-previous-source-unavailable","revision-review")]
    status_counts={k:sum(v["status"]==k for v in out.values()) for k in
                   ("awaiting-audited-target-year","verified",
                    "verified-previous-source-unavailable","revision-review")}
    return {"schemaVersion":SCHEMA,
      "generatedAt":now.isoformat(timespec="seconds").replace("+00:00","Z"),
      "source":"SEC annual companyfacts; prospectively locked baseline forecasts",
      "methodology":MODEL,"modelCalibrated":False,
      "qualityRule":"Do not compute a model success rate or confidence until >=20 out-of-sample annual results; no buy signals.",
      "counts":status_counts,"measuredSampleSize":len(measured),
      "verifiedForecastSkill":None if len(measured)<20 else {
          "meanAbsoluteErrorPct":round(sum(v["verified"]["absoluteErrorPct"] for v in measured)/len(measured),2),
          "flatBaselineMeanAbsoluteErrorPct":round(sum(v["verified"]["baselineAbsoluteErrorPct"] for v in measured)/len(measured),2),
      },"forecasts":out}

def write_atomic(target,payload):
    target.parent.mkdir(parents=True,exist_ok=True)
    with tempfile.NamedTemporaryFile("w",encoding="utf-8",dir=target.parent,
            prefix=".unity-model-",suffix=".tmp",delete=False) as f:
        temp=Path(f.name)
        json.dump(payload,f,indent=2,ensure_ascii=False,allow_nan=False)
        f.write("\n")
    try:os.replace(temp,target)
    finally:temp.unlink(missing_ok=True)

def main():
    now=dt.datetime.now(dt.timezone.utc)
    snapshot=json.loads(SOURCE.read_text(encoding="utf-8"))
    previous=json.loads(OUTPUT.read_text(encoding="utf-8")) if OUTPUT.exists() else {}
    result=build(snapshot,previous,now)
    write_atomic(OUTPUT,result)
    print("UNITY independent model forecasts", result["counts"],
        "measured out-of-sample", result["measuredSampleSize"])

if __name__=="__main__":
    main()
