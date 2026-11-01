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
    def test_official_issuer_highlights_parse_without_cross_mixing(self):
        abb='<html><body>ABB 2025 KEY FIGURES REVENUES in mn $33,220 FREE CASHFLOW in mn $4,566</body></html>'
        x=mod.parse_official_highlights(abb,mod.OFFICIAL_SOURCES["CH0012221716"])
        self.assertEqual(x["revenue"]["value"],33_200_000_000)
        self.assertEqual(x["freeCashFlow"]["value"],4_566_000_000)
        self.assertEqual(x["freeCashFlow"]["currency"],"USD")
        inf='<html><body>Infineon FY 2025: Revenue €14.662 billion; positive Adjusted Free Cash Flow of €1.803 billion</body></html>'
        x=mod.parse_official_highlights(inf,mod.OFFICIAL_SOURCES["DE0006231004"])
        self.assertEqual(x["revenue"]["value"],14_662_000_000)
        self.assertEqual(x["adjustedFreeCashFlow"]["value"],1_803_000_000)
        self.assertNotIn("operatingCashFlow",x)
    def test_official_issuer_rejects_wrong_identity_or_conflicting_figures(self):
        source=mod.OFFICIAL_SOURCES["CH0012221716"]
        with self.assertRaises(ValueError):
            mod.parse_official_highlights("<p>Another firm 2025 REVENUES in mn $33,220</p>",source)
        x=mod.parse_official_highlights("<p>ABB 2025 REVENUES in mn $33,220; REVENUES in mn $42,100</p>",source)
        self.assertNotIn("revenue",x)
    def test_annual_period_not_quarterly(self):
        report={"facts":{"f1":{"dimensions":{"concept":"ifrs-full:Revenue","unit":"iso4217:EUR","period":"2025-10-01/2026-01-01"},"value":123}}}
        self.assertNotIn("revenue",mod.extract_metrics(report,"2025-12-31","EUR","https://filings.xbrl.org/a.json"))

if __name__=="__main__":unittest.main()
