#!/usr/bin/env python3
"""Free ECB reference FX rates, not executable spot quotes. Fail closed.
EUR per currency unit; safe for indicative simulated accounting only.
"""
import datetime as dt
import json
import pathlib
import urllib.request
import xml.etree.ElementTree as ET

ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=ROOT/"data"/"fx.json"
URL="https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml"
def parse(payload):
    root=ET.fromstring(payload)
    dated=[node for node in root.iter() if node.attrib.get("time")]
    if len(dated)!=1:
        raise ValueError("Expected one ECB reference date")
    day=dated[0].attrib["time"]
    dt.date.fromisoformat(day)
    rates={"EUR":1.0}
    for node in dated[0].iter():
        cur=node.attrib.get("currency")
        if cur:
            value=float(node.attrib["rate"])
            if value<=0 or value>1e8 or cur in rates:raise ValueError("Invalid FX rate")
            rates[cur]=round(1/value,12) # EUR per one unit of currency
    if not {"EUR","CHF","USD"}.issubset(rates):
        raise ValueError("ECB currency coverage incomplete")
    return day,rates

def build():
    now=dt.datetime.now(dt.timezone.utc)
    with urllib.request.urlopen(urllib.request.Request(URL,headers={"User-Agent":"UNITY-Lab-FX-Research/0.1"}),timeout=20) as r:
        raw=r.read()
    day,rates=parse(raw)
    age=(now.date()-dt.date.fromisoformat(day)).days
    if age<0 or age>7:raise ValueError("ECB rates dated too far from today")
    OUT.parent.mkdir(parents=True,exist_ok=True)
    OUT.write_text(json.dumps({"schemaVersion":1,"source":"European Central Bank euro foreign exchange reference rates","sourceUrl":URL,"referenceDate":day,"generatedAt":now.isoformat(timespec="seconds"),"unit":"EUR per 1 foreign currency unit","rates":rates},ensure_ascii=False,separators=(",",":"))+"\n",encoding="utf-8")
    print(f"ECB reference {day}: CHF -> {rates['CHF']} EUR; USD -> {rates['USD']} EUR",flush=True)
if __name__=="__main__":
    build()
