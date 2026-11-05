import datetime as dt
import importlib.util
import pathlib
import unittest

path=pathlib.Path(__file__).resolve().parents[1]/"scripts"/"refresh_issuer_calendar.py"
spec=importlib.util.spec_from_file_location("issuer_calendar",path)
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

class IssuerCalendarTests(unittest.TestCase):
    def test_european_pilot_sources_are_registered(self):
        for ticker in ("ABBN","SIE","JEN","SU","MSFT"):
            self.assertIn(ticker,mod.ISSUERS)
            self.assertTrue(mod.ISSUERS[ticker]["url"].startswith("https://"))

    def test_german_results_date_is_confirmed(self):
        raw="<table><tr><td>10.11.2026</td><td>Quarterly Statement January - September 2026</td></tr></table>"
        self.assertEqual(mod.next_event(raw,dt.date(2026,11,5)),"2026-11-10")

    def test_german_roadshow_is_not_an_earnings_date(self):
        raw="<table><tr><td>12.11.2026</td><td>Roadshow London</td></tr></table>"
        self.assertEqual(mod.next_event(raw,dt.date(2026,11,5)),"")

    def test_english_financial_results_date_is_confirmed(self):
        raw="<p>Upcoming event: February 11, 2027 – 1st quarter financial results</p>"
        self.assertEqual(mod.next_event(raw,dt.date(2026,11,5)),"2027-02-11")

    def test_final_non_results_event_cannot_use_page_footer(self):
        raw="December 1, 2026 UBS Industrials Conference " + ("x" * 300) + " Financial results"
        self.assertEqual(mod.next_event(raw,dt.date(2026,11,5),),"")

if __name__=="__main__":
    unittest.main()
