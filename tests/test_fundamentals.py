import importlib.util
import pathlib
import unittest

path=pathlib.Path(__file__).resolve().parents[1]/"scripts"/"refresh_fundamentals.py"
spec=importlib.util.spec_from_file_location("fundpilot",path)
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

class FundamentalsTests(unittest.TestCase):
    def test_four_european_issuers_and_verified_leis(self):
        self.assertEqual(len(mod.PILOT),4)
        self.assertEqual(mod.PILOT["FR0000121972"]["lei"],"969500A1YF1XUYYXS284")
        self.assertEqual(mod.PILOT["DE000ENER6Y0"]["lei"],"5299005CHJZ14D4FDJ62")
        self.assertEqual(mod.PILOT["DE0006231004"]["lei"],"TSI2PJM6EPETEQ4X1U25")
    def test_no_unverified_urls(self):
        self.assertIsNone(mod.safe_link("https://malicious.example.com/report.json"))
        self.assertEqual(mod.safe_link("/report.json"),"https://filings.xbrl.org/report.json")
    def test_accept_single_valid_consolidated_fact(self):
        report={"facts":{"f1":{"dimensions":{"concept":"ifrs-full:Revenue","unit":"iso4217:EUR","period":"2025-01-01T00:00:00/2026-01-01T00:00:00"},"value":"1000000"}}}
        metrics=mod.extract_metrics(report,"2025-12-31","EUR","https://filings.xbrl.org/a.json")
        self.assertEqual(metrics["revenue"]["value"],1_000_000)
        self.assertEqual(metrics["revenue"]["currency"],"EUR")
    def test_segmented_and_mismatched_currency_facts_rejected(self):
        report={"facts":{"f1":{"dimensions":{"concept":"ifrs-full:Revenue","unit":"iso4217:USD","period":"2025-01-01/2026-01-01"},"value":"100"},
                         "f2":{"dimensions":{"concept":"ifrs-full:Revenue","unit":"iso4217:EUR","period":"2025-01-01/2026-01-01","custom:segment":"Other"},"value":"200"}}}
        self.assertNotIn("revenue",mod.extract_metrics(report,"2025-12-31","EUR","https://filings.xbrl.org/a.json"))
    def test_conflicting_facts_rejected(self):
        report={"facts":{k:{"dimensions":{"concept":"ifrs-full:Assets","unit":"iso4217:EUR","period":"2025-12-31"},"value":v} for k,v in (("a",100),("b",200))}}
        self.assertNotIn("assets",mod.extract_metrics(report,"2025-12-31","EUR","https://filings.xbrl.org/a.json"))
    def test_ratios_and_growth_only_from_matching_fiscal_years(self):
        current={"revenue":{"value":120},"netIncome":{"value":12},"assets":{"value":300},
                 "equity":{"value":90},"operatingCashFlow":{"value":18}}
        previous={"revenue":{"value":100},"netIncome":{"value":10}}
        result=mod.derived_ratios(current,previous,"2025-12-31","2024-12-31")
        self.assertEqual(result["revenueGrowth"]["value"],20.0)
        self.assertEqual(result["netMargin"]["value"],10.0)
        self.assertEqual(result["equityRatio"]["value"],30.0)
        self.assertEqual(result["operatingCashFlowMargin"]["value"],15.0)
        self.assertNotIn("revenueGrowth",mod.derived_ratios(current,previous,"2025-12-31","2022-12-31"))
        self.assertNotIn("netIncomeGrowth",mod.derived_ratios(current,{"netIncome":{"value":-5}},"2025-12-31","2024-12-31"))
    def test_complete_status_requires_all_five_core_metrics(self):
        self.assertEqual(mod.REQUIRED_METRICS, frozenset(("revenue","netIncome","assets","equity","operatingCashFlow")))
        current={key:{"value":1} for key in mod.REQUIRED_METRICS}
        self.assertTrue(mod.REQUIRED_METRICS.issubset(current))
        self.assertFalse(mod.REQUIRED_METRICS.issubset({"revenue":{"value":1},"netIncome":{"value":1}}))
    def test_official_issuer_highlights_parse_without_cross_mixing(self):
        abb='<html><body>ABB FY 2025 Revenues $33.2 billion and Cash flow from operating activities $5,469 million</body></html>'
        x=mod.parse_official_highlights(abb,mod.OFFICIAL_SOURCES["CH0012221716"])
        self.assertEqual(x["revenue"]["value"],33_200_000_000)
        self.assertEqual(x["operatingCashFlow"]["value"],5_469_000_000)
        self.assertEqual(x["operatingCashFlow"]["currency"],"USD")
        inf='<html><body>Infineon FY 2025: Revenue €14.662 billion; positive Adjusted Free Cash Flow of €1.803 billion</body></html>'
        x=mod.parse_official_highlights(inf,mod.OFFICIAL_SOURCES["DE0006231004"])
        self.assertEqual(x["revenue"]["value"],14_662_000_000)
        self.assertEqual(x["adjustedFreeCashFlow"]["value"],1_803_000_000)
        self.assertNotIn("operatingCashFlow",x)
    def test_official_issuer_rejects_wrong_identity_or_conflicting_figures(self):
        source=mod.OFFICIAL_SOURCES["CH0012221716"]
        with self.assertRaises(ValueError):
            mod.parse_official_highlights("<p>Another firm FY 2025 Revenues $33.2 billion</p>",source)
        x=mod.parse_official_highlights("<p>ABB FY 2025 Revenues $33.2 billion; FY 2025 Revenues $42.1 billion</p>",source)
        self.assertNotIn("revenue",x)
    def test_official_annual_reports_are_reference_only(self):
        expected = {
            "CH0012221716": ("US-GAAP", "2025-12-31"),
            "DE000ENER6Y0": ("IFRS", "2025-09-30"),
            "DE0006231004": ("IFRS", "2025-09-30"),
        }
        for isin, (standard, end) in expected.items():
            ref = mod.annual_report_reference(isin)
            self.assertEqual(ref["accountingStandard"], standard)
            self.assertEqual(ref["periodEnd"], end)
            self.assertEqual(ref["extractionStatus"], "not-machine-extracted")
            self.assertFalse(ref["coreMetricsValidated"])
            self.assertTrue(ref["sourceUrl"].startswith("https://"))
        self.assertIsNone(mod.annual_report_reference("US9999999999"))

    def test_siemens_official_backlog_and_orders_are_separate_from_core_metrics(self):
        source = mod.OFFICIAL_SOURCES["DE000ENER6Y0"]
        html = """<html><body>Siemens Energy fiscal year 2025.
        Driven by strong growth, orders reached €58.9 billion,
        revenue came in at €39.1 billion.
        With order intake of €58.9 billion, order backlog reached another
        new record of €138 billion.
        Net income at €1.685 billion.</body></html>"""
        facts = mod.parse_official_highlights(html, source)
        self.assertEqual(facts["orders"]["value"], 58_900_000_000)
        self.assertEqual(facts["orderBacklog"]["value"], 138_000_000_000)
        self.assertEqual(facts["revenue"]["value"], 39_100_000_000)
        self.assertEqual(facts["orderBacklog"]["kind"], "issuer-release")
        self.assertNotIn("operatingCashFlow", facts)

    def test_infineon_segment_result_not_net_income(self):
        source = mod.OFFICIAL_SOURCES["DE0006231004"]
        html = """<html><body>Infineon 2025:
        FY 2025: Revenue €14.662 billion, down 2 percent on the prior year;
        Segment Result €2.560 billion; Segment Result Margin 17.5 percent;
        positive Adjusted Free Cash Flow of €1.803 billion.</body></html>"""
        facts = mod.parse_official_highlights(html, source)
        self.assertEqual(facts["segmentResult"]["value"], 2_560_000_000)
        self.assertEqual(facts["adjustedFreeCashFlow"]["value"], 1_803_000_000)
        self.assertNotIn("netIncome", facts)
        self.assertNotIn("operatingCashFlow", facts)

    def test_annual_period_not_quarterly(self):
        report={"facts":{"f1":{"dimensions":{"concept":"ifrs-full:Revenue","unit":"iso4217:EUR","period":"2025-10-01/2026-01-01"},"value":123}}}
        self.assertNotIn("revenue",mod.extract_metrics(report,"2025-12-31","EUR","https://filings.xbrl.org/a.json"))

if __name__=="__main__":unittest.main()
