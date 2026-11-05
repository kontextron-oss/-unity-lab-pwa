#!/usr/bin/env python3
"""Build a fail-closed calendar snapshot from official issuer IR pages.

A date is published only when the issuer page itself names a future result,
earnings or financial-report event. No market-calendar aggregation, estimate
or guidance interpretation is used. English and German issuer calendars are
parsed independently; a roadshow or AGM never becomes an earnings date.
"""
from __future__ import annotations
import datetime as dt, html, json, re
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import Request, urlopen

ROOT=Path(__file__).resolve().parents[1]
DEST=ROOT/"data"/"issuer-calendar.json"
HEADERS={"User-Agent":"UNITY-LAB-IR-Monitor/1.1 (https://github.com/kontextron-oss/-unity-lab-pwa)","Accept":"text/html,application/xhtml+xml"}
ISSUERS={
 "MSFT":{"name":"Microsoft","url":"https://www.microsoft.com/en-us/Investor/"},
 "AAPL":{"name":"Apple","url":"https://investor.apple.com/investor-relations/default.aspx"},
 "AMD":{"name":"AMD","url":"https://ir.amd.com/news-events/ir-calendar"},
 "ADBE":{"name":"Adobe","url":"https://www.adobe.com/investor-relations.html"},
 "PWR":{"name":"Quanta Services","url":"https://investors.quantaservices.com/news-events/ir-calendar"},
 # European pilot values: official issuer pages, deliberately not market portals.
 "ABBN":{"name":"ABB","url":"https://global.abb/group/en/investors/overview"},
 "SIE":{"name":"Siemens","url":"https://www.siemens.com/de-de/company/investor-relations/financial-calendar/"},
 "JEN":{"name":"Jenoptik AG","url":"https://www.jenoptik.com/investors/events"},
 "SU":{"name":"Schneider Electric","url":"https://www.se.com/ww/en/about-us/investor-relations/financial-calendar-and-events/"}
}
ALLOWED={"www.microsoft.com","investor.apple.com","ir.amd.com","www.adobe.com","investors.quantaservices.com",
         "global.abb","www.siemens.com","www.jenoptik.com","www.se.com"}
MONTHS={m:i for i,m in enumerate(("january","february","march","april","may","june","july","august","september","october","november","december"),1)}
DATE_EN=re.compile(r"\b("+ "|".join(MONTHS) +r")\s+(\d{1,2}),\s*(20\d{2})\b",re.I)
DATE_DE=re.compile(r"\b(\d{1,2})\.(\d{1,2})\.(20\d{2})\b")
# These terms identify a financial disclosure. Conference, roadshow, AGM and
# generic investor-event dates never qualify on their own.
RESULT_TERMS=(
 "earnings","financial results","quarter results","annual results","revenues",
 "geschäftszahlen","quartalsmitteilung","quarterly statement","halbjahresbericht",
 "interim report","financial statements","preliminary results","jahresabschluss",
 "jahresergebnis","finanzergebnisse","ergebnisveröffentlichung"
)

def now():
 return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00","Z")

def text_at(url):
 if urlparse(url).hostname not in ALLOWED: raise ValueError("IR host not allowed")
 req=Request(url,headers=HEADERS)
 with urlopen(req,timeout=30) as res:
  if res.status!=200: raise ValueError("HTTP "+str(res.status))
  return res.read(2_000_000).decode("utf-8","replace")

def dated_matches(body):
 for match in DATE_EN.finditer(body):
  try: yield match.start(),match.end(),dt.date(int(match.group(3)),MONTHS[match.group(1).lower()],int(match.group(2)))
  except ValueError: continue
 for match in DATE_DE.finditer(body):
  try: yield match.start(),match.end(),dt.date(int(match.group(3)),int(match.group(2)),int(match.group(1)))
  except ValueError: continue

def next_event(raw,today):
 # Keep table/list rows separate: a result label from one event must never
 # validate the date of a nearby roadshow in another row.
 body=html.unescape(raw)
 body=re.sub(r"</(?:tr|li|p|h[1-6]|div|br|td|th)>","\\n",body,flags=re.I)
 body=re.sub(r"<[^>]+>"," ",body)
 candidates=[]
 for line in body.splitlines():
  line=re.sub(r"\\s+"," ",line).strip()
  if not line: continue
  for _start,_end,date in dated_matches(line):
   if date>today and any(term in line.lower() for term in RESULT_TERMS):
    candidates.append(date)
 return min(candidates).isoformat() if candidates else ""

def main():
 checked=now(); today=dt.datetime.now(dt.timezone.utc).date(); items={}
 for ticker,issuer in ISSUERS.items():
  item={"ticker":ticker,"name":issuer["name"],"source":"Offizielle Investor-Relations-Kalenderseite","sourceUrl":issuer["url"],"checkedAt":checked,"nextEarnings":"",
        "guidance":{"verified":False,"reason":"Guidance wird nur aus einer ausdrücklich zugeordneten Unternehmensveröffentlichung bestätigt."}}
  try:
   date=next_event(text_at(issuer["url"]),today)
   if date:
    item.update({"status":"confirmed-future-earnings","nextEarnings":date,
                 "earnings":{"confirmed":True,"date":date,"sourceUrl":issuer["url"]}})
   else:
    item.update({"status":"no-confirmed-future-earnings",
                 "earnings":{"confirmed":False,"date":"","sourceUrl":issuer["url"]}})
  except Exception as exc:
   item.update({"status":"source-unavailable",
                "earnings":{"confirmed":False,"date":"","sourceUrl":issuer["url"]},"error":str(exc)[:160]})
  items[ticker]=item
 data={"schemaVersion":1,"generatedAt":checked,"source":"Offizielle IR-Kalenderseiten",
       "scope":"Nur explizit auf der Emittentenseite erkennbare zukünftige Ergebnis- oder Financial-Results-Termine; keine Schätzung. Deutsche und englische Datumsformate, keine Konferenz- oder Roadshow-Termine.","items":items}
 DEST.write_text(json.dumps(data,ensure_ascii=False,indent=2)+"\\n",encoding="utf-8")
if __name__=="__main__": main()
