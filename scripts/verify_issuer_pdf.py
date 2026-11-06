#!/usr/bin/env python3
"""Fail-closed pilot of five consolidated FY2025 facts from two official issuer PDFs.

This is a READ-ONLY provenance probe. It never edits customer data, app state,
trading decisions, source snapshots, or the public repository. Changing fiscal
years requires a separately reviewed page/label manifest and regression test.
"""
from __future__ import annotations
import argparse
import io
import json
import re
import urllib.parse
import urllib.request

MAX_PDF_BYTES = 24_000_000
SOURCES = {
    "DE000ENER6Y0": {
        "name": "Siemens Energy", "url": "https://assets.siemens-energy.com/dam/32b27e9a-af91-4915-8b51-b3af012d0d98/A-Siemens_Energy_Annual_Report_2025-pdf_Original%20file.pdf",
        "host": "assets.siemens-energy.com", "year": 2025, "periodEnd": "2025-09-30",
        "currency": "EUR", "unitScale": 1_000_000, "standard": "IFRS",
        "facts": {
            "revenue": (147, 0, "Revenue", 39077),
            "netIncome": (147, 0, "Net income (loss)", 1685),
            "assets": (149, 0, "Total assets", 56637),
            "equity": (149, 0, "Total equity", 10675),
            "operatingCashFlow": (150, 0, "Cash flows from operating activities", 5821),
        },
    },
    "DE0006231004": {
        "name": "Infineon", "url": "https://www.infineon.com/row/public/documents/corporate/investors/annual-reports/2025/2025-annual-report-v01-00-en.pdf",
        "host": "www.infineon.com", "year": 2025, "periodEnd": "2025-09-30",
        "currency": "EUR", "unitScale": 1_000_000, "standard": "IFRS",
        "facts": {
            "revenue": (92, 0, "Revenue", 14662),
            "netIncome": (92, 0, "Profit (loss) for the period", 1015),
            "assets": (94, 0, "Total assets", 30470),
            "equity": (94, 1, "Total equity", 17051),
            "operatingCashFlow": (95, 0, "Cash flows from operating activities", 3217),
        },
    },
}
NUMERIC = re.compile(r"^\(?-?\d[\d,]*\)?$")
def normalized(value):
    return re.sub(r"\s+", " ", str(value)).strip().casefold()

def group_lines(words, y_tolerance=2.6):
    """Group PDF text words into same-baseline rows regardless of PDF text-block order."""
    pairs = []
    for word in words:
        if len(word) < 5:
            continue
        x0, y0, x1, y1, value = word[:5]
        if not isinstance(value, str) or not value.strip():
            continue
        pairs.append((float((y0+y1)/2), float((x0+x1)/2), value.strip()))
    rows = []
    for y, x, value in sorted(pairs):
        if rows and abs(y - rows[-1]["y"]) <= y_tolerance:
            row = rows[-1]
            row["terms"].append((x, value))
            row["y"] = (row["y"]*row["n"]+y)/(row["n"]+1)
            row["n"] += 1
        else:
            rows.append({"y": y, "terms": [(x, value)], "n": 1})
    for row in rows:
        row["terms"].sort(key=lambda v: v[0])
    return rows

def year_columns(rows, width, height, year, table_index):
    """Use the actual printed year header, not hard-coded PDF pixel positions."""
    values = sorted((x, y) for row in rows if row["y"] < height*0.42
                    for x, word in row["terms"] if word == str(year)
                    and width*0.16 < x < width*0.94
                    for y in [row["y"]])
    # Headers can be repeated as text extraction artifacts. Distinct columns only.
    xs = []
    for x, _ in values:
        if not xs or abs(x-xs[-1]) > width*.065:
            xs.append(x)
    if table_index >= len(xs):
        raise ValueError("FY header not identified in designated statement column")
    return xs[table_index]

def parse_statement_row(words, width, height, year, column, label):
    rows = group_lines(words)
    year_x = year_columns(rows, width, height, year, column)
    found = []
    for row in rows:
        left_floor = year_x - width*.32 if column else 0
        left = [word for x, word in row["terms"]
                if left_floor < x < year_x - width*.045]
        prefix = normalized(" ".join(left))
        target = normalized(label)
        if not prefix.startswith(target):
            continue
        # Avoid 'total equity attributable...' and continuing/discontinued cash flow.
        suffix = prefix[len(target):].strip()
        if suffix and not re.fullmatch(r"[\d, ]+", suffix):
            continue
        candidates = [(abs(x-year_x), value) for x, value in row["terms"]
                      if abs(x-year_x) < width*.055 and NUMERIC.fullmatch(value)]
        if not candidates:
            continue
        distance, raw = min(candidates)
        num = int(raw.replace(",", "").replace("(", "-").replace(")", ""))
        found.append((row["y"], num))
    unique = {value for _, value in found}
    if len(found) != 1 or len(unique) != 1:
        raise ValueError("Missing or ambiguous statement row: " + label)
    return found[0][1]

def fetch_pdf(url, hostname):
    parts = urllib.parse.urlsplit(url)
    if parts.scheme != "https" or parts.hostname != hostname:
        raise ValueError("Unapproved annual report host")
    request = urllib.request.Request(url, headers={
        "User-Agent": "UNITY-Lab-Research/0.15 (https://github.com/kontextron-oss/-unity-lab-pwa)",
        "Accept": "application/pdf",
    })
    with urllib.request.urlopen(request, timeout=35) as response:
        final_url = response.geturl()
        final_host = urllib.parse.urlsplit(final_url).hostname
        if final_host != hostname:
            raise ValueError("Annual report redirect to unapproved host")
        length = int(response.headers.get("Content-Length", "0"))
        if length > MAX_PDF_BYTES:
            raise ValueError("PDF exceeds size limit")
        raw = response.read(MAX_PDF_BYTES+1)
    if len(raw) > MAX_PDF_BYTES or not raw.startswith(b"%PDF-"):
        raise ValueError("PDF unavailable or not a genuine PDF")
    return raw

def parse_issuer_pdf(spec, pdf_bytes):
    import fitz  # PyMuPDF is installed only in isolated, network-enabled PDF job.
    doc = fitz.open(stream=io.BytesIO(pdf_bytes), filetype="pdf")
    try:
        if not doc.is_pdf or doc.page_count <= max(p[0] for p in spec["facts"].values()):
            raise ValueError("Annual report is incomplete")
        if normalized(spec["name"]) not in normalized(doc[0].get_text()):
            raise ValueError("Annual report issuer identity mismatch")
        fields = {}
        for field, (page_idx, table, label, reference) in spec["facts"].items():
            page = doc[page_idx]
            value = parse_statement_row(page.get_text("words", sort=True),
                                        page.rect.width, page.rect.height,
                                        spec["year"], table, label)
            if value != reference:
                raise ValueError("Annual report fact conflicts with reviewed FY2025 benchmark: " + field)
            fields[field] = {
                "value": value * spec["unitScale"], "currency": spec["currency"],
                "periodEnd": spec["periodEnd"], "sourceUrl": spec["url"],
                "sourceType": "issuer-audited-annual-report",
                "page": page_idx+1, "label": label,
                "basis": "consolidated-group", "sourceUnit": "million",
            }
        if fields["assets"]["value"] < fields["equity"]["value"] or any(
            fields[k]["value"] <= 0 for k in fields
        ):
            raise ValueError("Consolidated financial sanity check failed")
        return fields
    finally:
        doc.close()

def extract_issuer(isin):
    spec = SOURCES[isin]
    fields = parse_issuer_pdf(spec, fetch_pdf(spec["url"], spec["host"]))
    return {"isin": isin, "name": spec["name"], "periodEnd": spec["periodEnd"],
            "currency": spec["currency"], "standard": spec["standard"],
            "sourceUrl": spec["url"], "sourceType": "issuer-audited-annual-report",
            "reviewed": True, "reviewScope": "FY2025 five core metrics",
            "metrics": fields}

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--probe", action="store_true", help="Read-only official PDF connectivity and extraction test")
    args = p.parse_args()
    if not args.probe:
        p.error("Read-only pilot: use --probe; importing data requires separate approval")
    result = {}
    for isin in SOURCES:
        try:
            row = extract_issuer(isin)
            result[isin] = {"status": "verified", "name": row["name"],
                            "source": row["sourceUrl"],
                            "valuesInMillions": {k: v["value"]/1_000_000 for k,v in row["metrics"].items()}}
        except Exception as err:
            result[isin] = {"status": "unavailable", "reason": str(err)[:180]}
    print(json.dumps(result, indent=2, ensure_ascii=False))
    if any(v["status"] != "verified" for v in result.values()):
        raise SystemExit(1)

if __name__ == "__main__":
    main()
