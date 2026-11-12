import datetime as dt
import importlib.util
import pathlib
import unittest
from unittest import mock
import urllib.error

FILE=pathlib.Path(__file__).resolve().parents[1]/"scripts"/"refresh_research.py"
spec=importlib.util.spec_from_file_location("unity_research",FILE)
research=importlib.util.module_from_spec(spec)
spec.loader.exec_module(research)
TODAY=dt.date.today()
RECENT=(TODAY-dt.timedelta(days=3)).isoformat()
END=(TODAY-dt.timedelta(days=65)).isoformat()
FY_START=(TODAY-dt.timedelta(days=430)).isoformat()
ACC="0000000000-26-000001"

def submissions(cik,ticker):
    return {"cik":cik,"tickers":[ticker],"filings":{"recent":{
      "form":["8-K","10-Q","10-Q/A","8-K","10-K"],
      "accessionNumber":[ACC,ACC,ACC,ACC,ACC],
      "filingDate":[RECENT,RECENT,RECENT,(TODAY+dt.timedelta(days=1)).isoformat(),RECENT],
      "primaryDocument":["form8k.htm","report.htm","amend.htm","future.htm","annual.htm"]}}}

def companyfacts(cik):
    return {"cik":cik,"facts":{"us-gaap":{
       "Revenues":{"units":{"USD":[
          {"form":"10-K","filed":RECENT,"end":END,"start":FY_START,"val":100_000_000,"accn":ACC},
          {"form":"10-K","filed":RECENT,"end":END,"start":FY_START,"val":100_000_000,"accn":ACC}]}},
       "StockholdersEquity":{"units":{"USD":[
          {"form":"10-Q","filed":RECENT,"end":END,"val":50_000_000,"accn":ACC}]}}
    }}}

class ResearchTests(unittest.TestCase):
    def test_tickers_only_exact_and_unique(self):
        doc={"0":{"ticker":"ETN","title":"Eaton plc","cik_str":1234},
             "1":{"ticker":"VRT","title":"Vertiv","cik_str":2345},
             "2":{"ticker":"VRT","title":"Other entity","cik_str":9999}}
        out=research.ticker_map(doc)
        self.assertEqual(out["ETN"],(1234,"Eaton plc"))
        self.assertNotIn("VRT",out)

    def test_filings_are_official_dated_metadata_not_sentiment(self):
        x=research.filing_events(submissions(1234,"ETN"),1234)
        self.assertEqual(len(x),3)
        self.assertTrue(all(e["url"].startswith("https://www.sec.gov/Archives/edgar/data/1234/") for e in x))
        self.assertNotIn("positive",str(x).lower())
        self.assertTrue(all(e["filedAt"]==RECENT for e in x))

    def test_material_filing_categories_require_review_without_directional_score(self):
        label, event_class, impact=research.filing_event_metadata("8-K","5.02,9.01")
        self.assertEqual(label,"Führungswechsel / Management")
        self.assertEqual(event_class,"leadership")
        self.assertEqual(impact,"review")
        label, event_class, impact=research.filing_event_metadata("8-K","")
        self.assertEqual(label,"Unternehmensmeldung")
        self.assertEqual(event_class,"filing")
        self.assertEqual(impact,"review")
        self.assertEqual(research.VERIFIED_CIK_FALLBACK["NVDA"][0],1045810)

    def test_reject_conflicting_values_same_original_period(self):
        facts=companyfacts(1234)
        facts["facts"]["us-gaap"]["Revenues"]["units"]["USD"].append(
          {"form":"10-K","filed":RECENT,"end":END,"start":FY_START,"val":120_000_000,"accn":ACC})
        self.assertIsNone(research.choose_fact(facts,research.DURATION["revenue"],"duration"))

    def test_sec_report_provides_source_checked_metrics(self):
        cik=1234
        def fake(url,max_bytes):
            if "/submissions/" in url:return submissions(cik,"ETN")
            if "/companyfacts/" in url:return companyfacts(cik)
            self.fail(url)
        with mock.patch.object(research,"get_json",side_effect=fake):
            item=research.sec_report("ETN","Eaton",cik,"Eaton plc",research.iso_now())
        self.assertEqual(item["status"],"metrics-partial")
        self.assertEqual(item["metrics"]["revenue"]["value"],100_000_000)
        self.assertEqual(item["metrics"]["equity"]["period"],"I")
        self.assertEqual(len(item["events"]),3)
        self.assertFalse("investmentDecision" in item)

    def test_cik_mismatch_rejected(self):
        with mock.patch.object(research,"get_json",return_value=submissions(9999,"ETN")):
            with self.assertRaisesRegex(ValueError,"SEC-CIK"):
                research.sec_report("ETN","Eaton",1234,"Eaton plc",research.iso_now())

    def test_failed_source_fails_closed_and_preserves_history_as_stale(self):
        previous={"items":{"IE00B8KQN827":{"status":"metrics-partial","events":[{"form":"8-K"}],
                                           "metrics":{"revenue":{"value":1}}}}}
        def broken(url,max_bytes=12_000_000):raise urllib.error.URLError("Offline")
        with mock.patch.object(research,"euro_sources",return_value={}),\
             mock.patch.object(research.time,"sleep",return_value=None):
            new=research.build(previous,fetch=broken)
        self.assertEqual(new["items"]["IE00B8KQN827"]["status"],"stale-previous")
        self.assertEqual(new["items"]["IE00B8KQN827"]["metrics"]["revenue"]["value"],1)
        self.assertEqual(new["items"]["US92537N1081"]["status"],"source-unavailable")
        self.assertEqual(new["sourceFailures"],len(research.US))
        self.assertNotIn("action",str(new))

    def test_sec_index_denied_fallback_only_uses_verified_ids(self):
        def fake(url,max_bytes=12_000_000):
            if url==research.TICKERS:
                raise urllib.error.HTTPError(url,403,"SEC site protection",{},None)
            if "/submissions/CIK0000002488.json" in url:
                return submissions(2488,"AMD")
            if "/companyfacts/CIK0000002488.json" in url:
                return companyfacts(2488)
            raise urllib.error.URLError("Other issuer source unavailable")
        with mock.patch.object(research,"euro_sources",return_value={}),\
             mock.patch.object(research.time,"sleep",return_value=None):
            new=research.build(fetch=fake)
        self.assertEqual(new["items"]["AMD"]["status"],"metrics-partial")
        self.assertEqual(new["items"]["IE00B8KQN827"]["status"],"source-unavailable")
        self.assertEqual(new["sourceFailures"],len(research.US)-1)
        self.assertEqual(new["items"]["AMD"]["cik"],"0000002488")

    def test_verified_date_not_misreported_as_publication_date(self):
        import tempfile
        with tempfile.TemporaryDirectory() as folder:
            path=pathlib.Path(folder)/"fundamentals.json"
            path.write_text(__import__("json").dumps({"items":{"CH0012221716":{
                "name":"ABB","isin":"CH0012221716",
                "officialHighlights":{"verifiedAt":research.iso_now(),
                                      "sourceUrl":"https://view.news.eu.nasdaq.com/view?id=abc"},
                "latestFiling":{}}}}),encoding="utf-8")
            with mock.patch.object(research,"EU",path):
                item=research.euro_sources()["CH0012221716"]
            self.assertEqual(item["events"][0]["filedAt"],"")

    def test_automatic_us_monitor_handles_mixed_provider_results(self):
        def fake(url,max_bytes=12_000_000):
            if url==research.TICKERS:
                return {"0":{"ticker":"ETN","title":"Eaton plc","cik_str":1234}}
            if "/submissions/" in url:return submissions(1234,"ETN")
            if "/companyfacts/" in url:return companyfacts(1234)
            raise urllib.error.URLError("Unknown")
        with mock.patch.object(research,"euro_sources",return_value={}),\
             mock.patch.object(research.time,"sleep",return_value=None):
            snapshot=research.build(fetch=fake)
        self.assertEqual(snapshot["items"]["IE00B8KQN827"]["status"],"metrics-partial")
        self.assertEqual(snapshot["items"]["AMD"]["status"],"source-unavailable")
        self.assertEqual(snapshot["items"]["IE00B8KQN827"]["ticker"],"ETN")

if __name__=="__main__":
    unittest.main()
