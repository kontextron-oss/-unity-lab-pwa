#!/usr/bin/env python3
"""UNITY prospectively timestamped SEC outcome audit. Public, read-only to client.

The fixed, pre-result issuer forecast is NEVER modified. An audited later 10-K
result may be measured only after the registered date, for the exact issuer,
concept, unit, period and SEC CIK. Revised/changed SEC values require review;
prior published outcome facts are retained unchanged. No predictions or trades.
"""
from __future__ import annotations
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import re
import tempfile
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
CHECKPOINTS = ROOT / "data" / "foresight-checkpoints.json"
SEC = ROOT / "data" / "sec-fundamentals.json"
OUTPUT = ROOT / "data" / "foresight-outcomes.json"
REGISTRY = {
    "IE00B8KQN827": {"ticker": "ETN", "cik": "0001551182"},
    "US92537N1081": {"ticker": "VRT", "cik": "0001674101"},
}
METRICS = {
    "revenue": ("RevenueFromContractWithCustomerExcludingAssessedTax", "USD"),
    "epsDiluted": ("EarningsPerShareDiluted", "USD/shares"),
}
ISO = re.compile(r"^\d{4}-\d{2}-\d{2}$")
SOURCE = re.compile(r"^https://data\.sec\.gov/api/xbrl/companyfacts/CIK(\d{10})\.json$")
DECIMALS = 2

def parsed_day(value: str) -> dt.date | None:
    if not isinstance(value, str) or not ISO.fullmatch(value):
        return None
    try:
        return dt.date.fromisoformat(value)
    except ValueError:
        return None

def fingerprint(checkpoint: dict) -> str:
    return hashlib.sha256(json.dumps(checkpoint, ensure_ascii=False, sort_keys=True,
        separators=(",", ":")).encode("utf-8")).hexdigest()

def checked_checkpoint(c: dict, checked_date: dt.date) -> bool:
    if not isinstance(c, dict):
        return False
    registry = REGISTRY.get(c.get("isin"))
    kind = METRICS.get(c.get("metric"))
    recorded, published, end = (parsed_day(c.get(k)) for k in
                                 ("recordedAt", "sourcePublishedAt", "periodEnd"))
    if not registry or not kind or not all((recorded, published, end)):
        return False
    if not (published <= recorded < end and recorded <= checked_date):
        return False
    if (c.get("ticker") != registry["ticker"] or
        c.get("fiscalYear") != 2026 or c.get("periodEnd") != "2026-12-31" or
        c.get("unit") != kind[1] or c.get("basis") != "US-GAAP" or
        c.get("sourceType") != "official-issuer-2026-management-guidance" or
        not str(c.get("sourceUrl", "")).startswith("https://")):
        return False
    forecast = c.get("forecast")
    if not isinstance(forecast, dict):
        return False
    is_pos = lambda x: isinstance(x, (int, float)) and not isinstance(x, bool) and 0 < x < 1e13
    if forecast.get("kind") == "range":
        return is_pos(forecast.get("low")) and is_pos(forecast.get("high")) and forecast["low"] <= forecast["high"]
    return forecast.get("kind") == "point" and is_pos(forecast.get("value"))

def sec_value(c: dict, sec_items: dict, now: dt.datetime) -> dict | None:
    identity = REGISTRY[c["isin"]]
    issuer = sec_items.get(identity["ticker"])
    if not isinstance(issuer, dict) or any((
        issuer.get("ticker") != identity["ticker"],
        issuer.get("isin") != c["isin"],
        issuer.get("cik") != identity["cik"],
        issuer.get("status") != "metrics-complete",
        issuer.get("reportCurrency") != "USD",
    )):
        return None
    filing = issuer.get("latestFiling") or {}
    url = filing.get("reportUrl")
    matched = SOURCE.fullmatch(str(url or ""))
    if not matched or matched.group(1) != identity["cik"]:
        return None
    if filing.get("periodEnd") != c["periodEnd"]:
        return None
    fact = (issuer.get("metrics") or {}).get(c["metric"])
    concept, unit = METRICS[c["metric"]]
    if not isinstance(fact, dict) or any((
        fact.get("periodEnd") != c["periodEnd"],
        fact.get("unit") != unit,
        fact.get("currency") != "USD",
        fact.get("concept") != "us-gaap:" + concept,
        fact.get("sourceUrl") != url,
    )):
        return None
    filed = parsed_day(fact.get("filed"))
    if (filed is None or filed < parsed_day(c["periodEnd"]) or
        filed <= parsed_day(c["recordedAt"]) or filed > now.date()):
        return None
    value = fact.get("value")
    if not isinstance(value, (int, float)) or isinstance(value, bool) or not 0 < value < 1e13:
        return None
    return {"value": value, "filedAt": filed.isoformat(), "sourceUrl": url,
        "concept": fact["concept"], "unit": unit, "periodEnd": c["periodEnd"]}

def score(c: dict, observed: dict) -> dict:
    f = c["forecast"]
    midpoint = (f["low"] + f["high"]) / 2 if f["kind"] == "range" else f["value"]
    value = observed["value"]
    result = dict(observed)
    result["errorPercent"] = round((value / midpoint - 1) * 100, DECIMALS)
    result["category"] = (
        ("below-guidance" if value < f["low"] else
         "above-guidance" if value > f["high"] else
         "within-guidance") if f["kind"] == "range"
        else "point-deviation"
    )
    return result

def build(checkpoints: dict, sec_snapshot: dict, previous: dict,
          now: dt.datetime) -> dict:
    if now.tzinfo is None:
        raise ValueError("Need timezone-aware refresh timestamp")
    if checkpoints.get("schemaVersion") != 1 or not isinstance(checkpoints.get("checkpoints"), list):
        raise ValueError("Unknown checkpoint data schema")
    existing = previous.get("entries") or {}
    if not isinstance(existing, dict):
        raise ValueError("Invalid old audit journal")
    items = sec_snapshot.get("items") or {}
    if not isinstance(items, dict):
        raise ValueError("Invalid SEC source snapshot")
    seen,entries=set(),{}
    for c in checkpoints["checkpoints"]:
        if not checked_checkpoint(c, now.astimezone(ZoneInfo('Europe/Berlin')).date()):
            raise ValueError("Unverified or future-dated checkpoint")
        cid = c["id"]
        if not isinstance(cid, str) or not cid or cid in seen:
            raise ValueError("Duplicate checkpoint ID")
        seen.add(cid)
        digest=fingerprint(c)
        old=existing.get(cid)
        if old and old.get("forecastFingerprint") != digest:
            raise ValueError("Previously registered forecast changed: " + cid)
        observed=sec_value(c,items,now)
        result=score(c,observed) if observed else None
        previousVerified=old.get("verified") if isinstance(old,dict) else None
        entry={
            "id": cid, "isin": c["isin"], "ticker": c["ticker"], "metric": c["metric"],
            "periodEnd": c["periodEnd"], "sourcePublishedAt": c["sourcePublishedAt"],
            "recordedAt": c["recordedAt"], "guidanceSourceUrl": c["sourceUrl"],
            "forecast": c["forecast"], "forecastFingerprint": digest,
            "lastCheckedAt": now.isoformat(timespec="seconds").replace("+00:00", "Z"),
            "status": "awaiting-audited-FY2026", "verified": None,
            "observedCandidate": None,
        }
        if previousVerified:
            # An already published result is immutable. Any changed SEC value
            # or superseding filing must be reviewed, not silently substituted.
            entry["verified"]=previousVerified
            if result is None:
                entry["status"]="verified-previous-source-unavailable"
            elif any(result.get(k)!=previousVerified.get(k) for k in
                    ("value","filedAt","sourceUrl","concept","unit","periodEnd")):
                entry["status"]="revision-review"
                entry["observedCandidate"]=result
            else:
                entry["status"]="verified"
        elif result:
            entry["verified"]=result
            entry["status"]="verified"
        entries[cid]=entry
    # Checkpoints may be added but never discarded from an established journal.
    missing=set(existing)-seen
    if missing:
        raise ValueError("Previously registered checkpoint removed: " + ",".join(sorted(missing)))
    status_counts={key:sum(x["status"]==key for x in entries.values()) for key in
                   ("awaiting-audited-FY2026","verified","verified-previous-source-unavailable","revision-review")}
    return {
        "schemaVersion":1,"generatedAt":now.isoformat(timespec="seconds").replace("+00:00","Z"),
        "source":"Source-checked annual SEC companyfacts with original pre-committed issuer guidance",
        "secGeneratedAt":sec_snapshot.get("generatedAt"),
        "scope":"Public precommitted management guidance outcomes only; no price forecast, model tuning or trade orders.",
        "counts":status_counts,"entries":entries,
    }

def write_atomic(target: Path, payload: dict):
    target.parent.mkdir(parents=True,exist_ok=True)
    with tempfile.NamedTemporaryFile("w", encoding="utf-8",
            dir=target.parent, prefix=".foresight-", suffix=".tmp", delete=False) as f:
        temp=Path(f.name)
        json.dump(payload,f,indent=2,ensure_ascii=False,allow_nan=False)
        f.write("\n")
    try:
        os.replace(temp,target)
    finally:
        temp.unlink(missing_ok=True)

def main():
    now=dt.datetime.now(dt.timezone.utc)
    checkpoints=json.loads(CHECKPOINTS.read_text(encoding="utf-8"))
    sec=json.loads(SEC.read_text(encoding="utf-8"))
    previous=json.loads(OUTPUT.read_text(encoding="utf-8")) if OUTPUT.exists() else {}
    result=build(checkpoints,sec,previous,now)
    write_atomic(OUTPUT,result)
    print("UNITY outcome audit",result["counts"],"source",result["secGeneratedAt"])

if __name__=="__main__":
    main()
