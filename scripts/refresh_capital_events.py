#!/usr/bin/env python3
"""UNITY public procurement event radar: recent verified EU TED award notices.

Research ONLY: awarding a contract is not an institutional portfolio flow,
nor a confirmed order for any UNITY-listed issuer. Every note links to TED.
Data from the open TED search API; no personal holdings or paid article text.
"""
from __future__ import annotations

import datetime as dt
import json
import pathlib
import re
import urllib.error
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "data" / "capital_events.json"
URL = "https://api.ted.europa.eu/v3/notices/search"
FIELDS = [
    "publication-number", "publication-date", "notice-type", "notice-title", "official-language",
    "buyer-name", "buyer-country", "winner-name", "winner-identifier",
    "classification-cpv", "total-value", "total-value-cur",
    "BT-142-LotResult",
]
# All exact official CPV categories. Query results are only samples (50 per theme).
TOPICS = {
    "transformers": {
        "label": "Transformatoren", "cpv": "31170000",
        "context": "Europäische Netztechnik und Transformatoren",
    },
    "power-cables": {
        "label": "Stromkabel und Netzverbindungen", "cpv": "31320000",
        "context": "Europäische Kabel- und Netzbeschaffung",
    },
    "cooling": {
        "label": "Kühl- und Wärmetauschtechnik", "cpv": "42510000",
        "context": "Gebäude- und technische Kühl-/Wärmetechnik; nicht automatisch Rechenzentren",
    },
}
NUMBER_RE = re.compile(r"^[0-9]{1,8}-20[0-9]{2}$")
DATE_RE = re.compile(r"^(20[0-9]{2})-([0-9]{2})-([0-9]{2})")
MAX_ROWS = 50


def utcnow():
    return dt.datetime.now(dt.timezone.utc)


def fetch(payload):
    data = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    request = urllib.request.Request(
        URL, data=data, method="POST",
        headers={"Accept": "application/json", "Content-Type": "application/json",
                 "User-Agent": "UNITY-LAB-Research/1.0 (public GitHub Pages research project)"},
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        if int(response.headers.get("Content-Length", 0)) > 3_000_000:
            raise ValueError("TED-Antwort zu groß")
        raw = response.read(3_000_001)
    if len(raw) > 3_000_000:
        raise ValueError("TED-Antwort zu groß")
    return json.loads(raw)


def single(value, limit=150, preferred_lang=""):
    """Return a single unambiguous text value, honoring TED multilingual maps.

    TED buyer-name/winner-name use {lang: [names]}; never select the first
    of *multiple* firms or merge multiple winners into one issuer.
    """
    if isinstance(value, (str, int, float)) and not isinstance(value, bool):
        return str(value).strip()[:limit]
    if isinstance(value, list) and len(value) == 1:
        return single(value[0], limit, preferred_lang)
    if isinstance(value, dict):
        langs = list(value)
        # Prefer the notice's original language where available, then German,
        # then English; do not infer any legal entity from translated names.
        options = [preferred_lang, "deu", "eng"] + langs
        for lang in options:
            if lang and lang in value:
                txt = single(value[lang], limit, preferred_lang)
                if txt:
                    return txt
    return ""


def date_from(value, today):
    s = single(value, 40)
    match = DATE_RE.match(s)
    if not match:
        return ""
    try:
        date = dt.date.fromisoformat(match.group(0))
        if date > today or date < today - dt.timedelta(days=92):
            return ""
        return date.isoformat()
    except ValueError:
        return ""


def process(notices, cpv, today):
    """Only official, dated, exact-CPV award notices. No inferred beneficiaries."""
    result, seen = [], set()
    if not isinstance(notices, list):
        raise ValueError("TED notices ist keine Liste")
    for obj in notices[:MAX_ROWS]:
        if not isinstance(obj, dict):
            continue
        number = single(obj.get("publication-number"), 25)
        if not NUMBER_RE.fullmatch(number) or number in seen:
            continue
        published = date_from(obj.get("publication-date"), today)
        if not published:
            continue
        if single(obj.get("notice-type")) != "can-standard":
            continue
        codes = obj.get("classification-cpv", "")
        # TED may return a semicolon-delimited list or an array.
        values = codes if isinstance(codes, list) else re.split(r"[,;\s]+", str(codes))
        if cpv not in [str(c).strip() for c in values]:
            continue
        original_lang = single(obj.get("official-language"), 3).lower()
        title = single(obj.get("notice-title"), 250, original_lang)
        buyer = single(obj.get("buyer-name"), 180, original_lang)
        country = single(obj.get("buyer-country"), 3)
        winner = single(obj.get("winner-name"), 180, original_lang)
        winner_id = single(obj.get("winner-identifier"), 100)
        lot_result = obj.get("BT-142-LotResult")
        raw_status = lot_result if isinstance(lot_result, list) else re.split(
            r"[,;\\s]+", str(lot_result or ""))
        status_values = {str(x).strip() for x in raw_status if str(x).strip()}
        # can-standard is only the *type* of outcome notice, and does NOT
        # prove that every lot is awarded (closed / cancelled results exist).
        winner_selected = "selec-w" in status_values
        # Multi-company text or missing legal identity: no issuer attribution.
        if ";" in winner or ";" in winner_id:
            winner = ""
            winner_id = ""
        # Values may be for the procedure, lots or multiple winners; show only
        # source amount for reference, never claim it equals an investment flow.
        raw_value = obj.get("total-value")
        cur = single(obj.get("total-value-cur"), 3)
        val = None
        if isinstance(raw_value, (float, int)) and not isinstance(raw_value, bool):
            if 0 < raw_value < 1e13 and cur in ("EUR", "USD", "CHF", "GBP"):
                val = round(float(raw_value), 2)
        seen.add(number)
        result.append({
            "id": number, "publishedAt": published, "title": title or "EU-Vergabebekanntmachung",
            "titleLanguage": original_lang if original_lang and title else "",
            "buyer": buyer, "buyerCountry": country, "winner": winner,
            "winnerIdentityVerified": False,
            "noticeType": "award-notice" if winner_selected else "result-notice-unconfirmed",
            "winnerSelectedForAtLeastOneLot": winner_selected,
            "lotResultCode": "selec-w" if winner_selected else "not-confirmed",
            "cpv": cpv,
            "publishedValue": val, "currency": cur if val is not None else "",
            "source": "EU TED · amtliche Bekanntmachung",
            "url": f"https://ted.europa.eu/en/notice/-/detail/{number}",
            "interpretation": ("TED: Gewinner mindestens eines Loses ausgewählt; "
                               "keine bestätigte Wirkung auf UNITY-Unternehmen." if winner_selected
                               else "TED: Ergebnisbekanntmachung; Vergabe/Zuschlag nicht bestätigt."),
        })
    return sorted(result, key=lambda x: (x["publishedAt"], x["id"]), reverse=True)


def query(cpv, since):
    assert re.fullmatch(r"[0-9]{8}", cpv)
    assert re.fullmatch(r"20[0-9]{6}", since)
    return {
        "query": (f"classification-cpv={cpv} AND notice-type=can-standard "
                  f"AND publication-date>={since} SORT BY publication-date DESC"),
        "fields": FIELDS, "page": 1, "limit": MAX_ROWS, "scope": "ALL",
        "paginationMode": "PAGE_NUMBER", "checkQuerySyntax": False,
        "onlyLatestVersions": True,
    }


def build(previous=None, source=fetch, clock=utcnow):
    now = clock()
    if now.tzinfo is None:
        raise ValueError("UTC clock required")
    stamp = now.isoformat(timespec="seconds")
    today = now.date()
    since = (today - dt.timedelta(days=45)).strftime("%Y%m%d")
    out = {}
    failures = 0
    for key, definition in TOPICS.items():
        last = ((previous or {}).get("topics") or {}).get(key) or {}
        try:
            data = source(query(definition["cpv"], since))
            if not isinstance(data, dict) or not isinstance(data.get("notices"), list):
                raise ValueError("TED-Datenstruktur nicht erkannt")
            entries = process(data["notices"], definition["cpv"], today)
            earlier = {e.get("id"): e for e in (last.get("events") or [])
                       if isinstance(e, dict)}
            comparable = last.get("status") == "available"
            for event in entries:
                known = earlier.get(event["id"]) or {}
                event["firstSeenAt"] = known.get("firstSeenAt") or stamp
                event["newSincePreviousScan"] = bool(comparable and event["id"] not in earlier)
            count = data.get("totalNoticeCount")
            out[key] = {
                **definition, "status": "available", "checkedAt": stamp,
                "querySince": since, "noticeType": "award-notice",
                "sampleSize": len(entries),
                "newSincePreviousScan": sum(e["newSincePreviousScan"] for e in entries[:25]),
                "totalMatchingNotices": count if isinstance(count, int) and count >= 0 else None,
                "isComplete": False,
                "events": entries[:25],
                "warning": ("Begrenzter Stichprobenausschnitt jüngster Vergaben. "
                            "Keine vollständige Branchenstatistik, keine Investmentzuflüsse, "
                            "keine gesicherte Zuordnung zu börsennotierten Unternehmen."),
            }
        except (urllib.error.URLError, ValueError, OSError, TimeoutError, KeyError) as exc:
            failures += 1
            # Retain last snapshot as archival evidence but never represent as current.
            out[key] = {
                **definition, "status": "stale" if last.get("status") in ("available", "stale") else "unavailable",
                "checkedAt": stamp,
                "lastSuccessfulAt": last.get("checkedAt") if last.get("status") == "available"
                else last.get("lastSuccessfulAt"),
                "querySince": since, "noticeType": "award-notice",
                "sampleSize": len(last.get("events") or []),
                "newSincePreviousScan": 0,
                "totalMatchingNotices": None, "isComplete": False,
                "events": (last.get("events") or [])[:25],
                "warning": "TED derzeit nicht abrufbar; ältere Meldungen sind ausschließlich Archiv.",
                "errorType": type(exc).__name__,
            }
    return {
        "schemaVersion": 1, "generatedAt": stamp,
        "source": "Amtliche EU-Veröffentlichungen · TED Search API v3",
        "sourceUrl": "https://docs.ted.europa.eu/api/latest/search.html",
        "sourceFailures": failures,
        "licenseNote": "Quelle: Europäische Union, Tenders Electronic Daily (TED).",
        "coverage": "3 CPV-Themen; je höchstens 50 jüngste Treffer im 45-Tage-Fenster; keine Vollerhebung",
        "kind": "public-procurement-events-not-equity-fund-flows",
        "topics": out,
    }


def main():
    previous = None
    if OUTPUT.exists():
        try:
            previous = json.loads(OUTPUT.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            pass
    data = build(previous)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    temp = OUTPUT.with_suffix(".json.tmp")
    temp.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    temp.replace(OUTPUT)
    print("TED capital-event radar:", len(data["topics"]), "CPV topics,",
          data["sourceFailures"], "source failures",
          [len(x["events"]) for x in data["topics"].values()])


if __name__ == "__main__":
    main()
