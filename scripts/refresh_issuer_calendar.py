#!/usr/bin/env python3
"""Build a fail-closed calendar snapshot from official issuer IR pages.

A date is published only when the issuer page itself names a *future* earnings
or financial-results event. No market-calendar aggregation, estimated date or
guidance interpretation is used.
"""
from __future__ import annotations
import datetime as dt, html, json, re
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import Request, urlopen

ROOT=Path(__file__).resolve().parents[1]
DEST=ROOT/"data"/"issuer-calendar.json"
HEADERS={"User-Agent":"UNITY-LAB-IR-Monitor/1.0 (https://github.com/kontextron-oss/-unity-lab-pwa)","Accept":"text/html,application/xhtml+xml"}
ISSUERS={
 "MSFT":{"name":"Microsoft","url":"https://www.microsoft.com/en-us/Investor/"},
 "AAPL":{"name":"Apple","url":"https://investor.apple.com/investor-relations/default.aspx"},
 "AMD":{"name":"AMD","url":"https://ir.amd.com/news-events/ir-calendar"},
 "ADBE":{"name":"Adobe","url":"https://www.adobe.com/investor-relations.html"},
 "PWR":{"name":"Quanta Services","url":"https://investors.quantaservices.com/news-events/ir-calendar"},
}
ALLOWED={"www.microsoft.com","investor.apple.com","ir.amd.com","www.adobe.com","investors.quantaservices.com"}
MONTHS={m:i for i,m in enumerate(("january","february","march","april","may","june","july","august","september","october","november","december"),1)}
DATE=re.compile(r"\b("+"|".join(MONTHS)+r")\s+(\d{1,2}),\s*(20\d{2})\b",re.I)

def now():
 return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00","Z")

def text_at(url):
 if urlparse(url).hostname not in ALLOWED: raise ValueError("IR host not allowed")
 req=Request(url,headers=HEADERS)
 with urlopen(req,timeout=30) as res:
  if res.status!=200: raise ValueError("HTTP "+str(res.status))
  return res.read(2_000_000).decode("utf-8","replace")

def next_event(raw,today):
 body=re.sub(r"<[^>]+>"," ",html.unescape(raw))
 body=re.sub(r"\s+"," ",body)
 for match in DATE.finditer(body):
  context=body[max(0,match.start()-280):match.end()+280].lower()
  is_results=("earnings" in context or "financial results" in context or "quarter results" in context)
  is_future_hint=("upcoming" in context or "next" in context or "will report" in context or "will be on" in context)
  if not(is_results and is_future_hint): continue
  try:
   date=dt.date(int(match.group(3)),MONTHS[match.group(1).lower()],int(match.group(2)))
  except ValueError: continue
  if date>today: return date.isoformat()
 return ""

def main():
 checked=now(); today=dt.datetime.now(dt.timezone.utc).date(); items={}
 for ticker,issuer in ISSUERS.items():
  item={"ticker":ticker,"name":issuer["name"],"source":"Offizielle Investor-Relations-Kalenderseite","sourceUrl":issuer["url"],"checkedAt":checked,"nextEarnings":"","guidance":{"verified":False,"reason":"Guidance wird nur aus einer ausdrücklich zugeordneten Unternehmensveröffentlichung bestätigt."}}
  try:
   date=next_event(text_at(issuer["url"]),today)
   if date:
    item.update({"status":"confirmed-future-earnings","nextEarnings":date,"earnings":{"confirmed":True,"date":date,"sourceUrl":issuer["url"]}})
   else:
    item.update({"status":"no-confirmed-future-earnings","earnings":{"confirmed":False,"date":"","sourceUrl":issuer["url"]}})
  except Exception as exc:
   item.update({"status":"source-unavailable","earnings":{"confirmed":False,"date":"","sourceUrl":issuer["url"]},"error":str(exc)[:160]})
  items[ticker]=item
 data={"schemaVersion":1,"generatedAt":checked,"source":"Offizielle IR-Kalenderseiten","scope":"Nur explizit auf der Emittentenseite erkennbare zukünftige Ergebnis- oder Financial-Results-Termine; keine Schätzung.","items":items}
 DEST.write_text(json.dumps(data,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
if __name__=="__main__": main()
