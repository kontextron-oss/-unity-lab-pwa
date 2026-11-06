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

    def test_pdf_core_is_attached_only_after_five_provenanced_facts(self):
        isin = "DE000ENER6Y0"
        spec = mod.ANNUAL_REPORT_REFERENCES[isin]
        url, period = spec["sourceUrl"], spec["periodEnd"]
        def full_reader(given):
            self.assertEqual(given, isin)
            return {
                "isin": given, "currency": "EUR", "periodEnd": period,
                "sourceUrl": url, "sourceType": "issuer-audited-annual-report",
                "metrics": {
                    k: {"value": i*1_000_000, "periodEnd": period, "currency": "EUR",
                        "sourceUrl": url, "sourceType": "issuer-audited-annual-report",
                        "page": 150} for i, k in enumerate(sorted(mod.REQUIRED_METRICS), 1)
                }
            }
        row = {"name": "Siemens Energy", "status": "issuer-release-only",
               "metrics": {}, "annualReport": mod.annual_report_reference(isin),
               "errors": [], "latestFiling": None}
        result = mod.attach_source_checked_pdf(row, {}, isin, extractor=full_reader)
        self.assertEqual(result["status"], "issuer-pdf-metrics-complete")
        self.assertEqual(set(result["metrics"]), mod.REQUIRED_METRICS)
        self.assertTrue(result["annualReport"]["coreMetricsValidated"])
        self.assertEqual(result["latestFiling"]["sourceType"], "issuer-audited-annual-report")
        self.assertIn("derived", result, "Current-year ratios are derived only from the five verified source facts")
        self.assertNotIn("revenueGrowth", result["derived"], "Without verified prior-year period, no growth")

    def test_pdf_comparable_prior_2024_only_after_same_issuer_period_and_currency(self):
        isin = "DE000ENER6Y0"
        ref = mod.ANNUAL_REPORT_REFERENCES[isin]
        source = ref["sourceUrl"]
        current = {"revenue": 400, "netIncome": 40, "assets": 1000,
                   "equity": 450, "operatingCashFlow": 90}
        previous = {"revenue": 320, "netIncome": 30, "assets": 900,
                    "equity": 410, "operatingCashFlow": 70}
        def payload(values,period):
            return {k: {"value": v*1_000_000, "periodEnd":period,
                "currency":"EUR", "sourceUrl":source,
                "sourceType":"issuer-audited-annual-report", "page":151}
                for k,v in values.items()}
        report = {"isin": isin, "periodEnd":"2025-09-30", "currency":"EUR",
                  "sourceUrl":source,"sourceType":"issuer-audited-annual-report",
                  "metrics":payload(current,"2025-09-30"),
                  "priorPeriodEnd":"2024-09-30",
                  "priorMetrics":payload(previous,"2024-09-30")}
        row={"name":"Siemens Energy","status":"issuer-release-only","metrics":{},
             "priorMetrics":{},"priorFiling":None,"derived":{},
             "annualReport":mod.annual_report_reference(isin),"latestFiling":None,"errors":[]}
        result=mod.attach_source_checked_pdf(row,{},isin,extractor=lambda _: report)
        self.assertEqual(result["status"],"issuer-pdf-metrics-complete")
        self.assertEqual(len(result["priorMetrics"]),5)
        self.assertEqual(result["derived"]["revenueGrowth"]["value"],25.0)
        self.assertEqual(result["derived"]["netIncomeGrowth"]["value"],33.33)
        self.assertEqual(result["derived"]["netMargin"]["value"],10.0)
        self.assertEqual(result["priorFiling"]["periodEnd"],"2024-09-30")
        report["priorMetrics"]["revenue"]["currency"]="USD"
        row={"name":"Siemens Energy","status":"issuer-release-only","metrics":{},
             "priorMetrics":{},"priorFiling":None,"derived":{},
             "annualReport":mod.annual_report_reference(isin),"latestFiling":None,"errors":[]}
        rejected=mod.attach_source_checked_pdf(row,{},isin,extractor=lambda _: report)
        self.assertEqual(rejected["priorMetrics"],{})
        self.assertNotIn("revenueGrowth",rejected["derived"])
        self.assertEqual(len(rejected["metrics"]),5,"Annual current data must survive unusable prior year")

    def test_pdf_core_rejected_if_missing_and_old_data_preserved_stale(self):
        isin = "DE0006231004"
        spec = mod.ANNUAL_REPORT_REFERENCES[isin]
        def missing_reader(_):
            return {"isin": isin, "sourceUrl": spec["sourceUrl"],
                    "periodEnd": "2025-09-30", "currency": "EUR",
                    "sourceType": "issuer-audited-annual-report",
                    "metrics": {"revenue": {"value": 14_662_000_000}}}
        first = {"name": "Infineon", "status": "issuer-release-only", "metrics": {},
                 "latestFiling": None, "annualReport": mod.annual_report_reference(isin),
                 "errors": []}
        result = mod.attach_source_checked_pdf(first, {}, isin, extractor=missing_reader)
        self.assertEqual(result["status"], "issuer-release-only")
        self.assertEqual(result["metrics"], {})
        self.assertFalse(result["annualReport"]["coreMetricsValidated"])
        old_metrics = {k: {"value": 100} for k in mod.REQUIRED_METRICS}
        previous = {"status": "issuer-pdf-metrics-complete", "metrics": old_metrics,
                    "latestFiling": {"reportUrl": spec["sourceUrl"],
                                     "sourceType": "issuer-audited-annual-report"},
                    "checkedAt": "2026-11-06T10:00:00Z"}
        second = {"name": "Infineon", "status": "issuer-release-only", "metrics": {},
                  "latestFiling": None, "annualReport": mod.annual_report_reference(isin),
                  "errors": []}
        result = mod.attach_source_checked_pdf(second, previous, isin,
            extractor=lambda _: (_ for _ in ()).throw(ValueError("temporary network outage")))
        self.assertEqual(result["status"], "stale-previous")
        self.assertEqual(result["metrics"], old_metrics)
        self.assertTrue(result["annualReport"]["stale"])
        self.assertFalse(result["annualReport"]["coreMetricsValidated"])
        self.assertEqual(result["previousCheckedAt"], previous["checkedAt"])

    def test_complete_esef_and_other_issuers_are_unchanged(self):
        for isin in ["FR0000121972", "CH0012221716"]:
            row = {"status": "metrics-complete", "metrics": {"revenue": {"value": 1}}}
            self.assertEqual(mod.attach_source_checked_pdf(row, {}, isin), row)
        isin = "DE000ENER6Y0"
        row = {"status": "metrics-complete", "metrics": {"revenue": {"value": 1}}}
        self.assertEqual(mod.attach_source_checked_pdf(row, {}, isin), row)

    def test_abb_us_gaap_five_validated_pdf_values_enter_common_model(self):
        isin = "CH0012221716"
        ref = mod.ANNUAL_REPORT_REFERENCES[isin]
        self.assertEqual(ref["accountingStandard"], "US-GAAP")
        self.assertEqual(ref["accountingCurrency"], "USD")
        self.assertEqual(ref["periodEnd"], "2025-12-31")
        reviewed = {"revenue": 33220, "netIncome": 4823, "assets": 44885,
                    "equity": 16646, "operatingCashFlow": 5469}
        def loader(target):
            self.assertEqual(target, isin)
            return {"isin": isin, "currency": "USD", "periodEnd": "2025-12-31",
                    "sourceUrl": ref["sourceUrl"], "sourceType": "issuer-audited-annual-report",
                    "metrics": {name: {
                        "value": val*1_000_000, "periodEnd": "2025-12-31", "currency": "USD",
                        "sourceUrl": ref["sourceUrl"], "sourceType": "issuer-audited-annual-report",
                        "page": {"revenue":55,"netIncome":55,"assets":57,"equity":57,"operatingCashFlow":58}[name]}
                        for name,val in reviewed.items()}}
        row = {"name": "ABB", "status": "issuer-release-only", "metrics": {},
               "annualReport": mod.annual_report_reference(isin),
               "latestFiling": None, "errors": []}
        result = mod.attach_source_checked_pdf(row, {}, isin, extractor=loader)
        self.assertEqual(result["status"], "issuer-pdf-metrics-complete")
        self.assertTrue(result["annualReport"]["coreMetricsValidated"])
        self.assertEqual(result["latestFiling"]["periodEnd"], "2025-12-31")
        self.assertEqual(set(result["metrics"]), set(reviewed))
        self.assertEqual(result["metrics"]["revenue"]["value"], 33_220_000_000)
        self.assertEqual(result["metrics"]["equity"]["currency"], "USD")

    def test_abb_currency_mismatch_must_not_promote_unverified_data(self):
        isin = "CH0012221716"
        row = {"name": "ABB", "status": "issuer-release-only", "metrics": {},
               "annualReport": mod.annual_report_reference(isin),
               "latestFiling": None, "errors": []}
        def wrong_currency(_):
            return {"isin":isin, "currency":"CHF", "periodEnd":"2025-12-31",
                    "sourceUrl": mod.ANNUAL_REPORT_REFERENCES[isin]["sourceUrl"],
                    "sourceType":"issuer-audited-annual-report", "metrics":{}}
        result = mod.attach_source_checked_pdf(row, {}, isin, extractor=wrong_currency)
        self.assertEqual(result["status"], "issuer-release-only")
        self.assertFalse(result["annualReport"]["coreMetricsValidated"])
        self.assertEqual(result["metrics"], {})
        self.assertTrue(result["errors"])

    def test_annual_period_not_quarterly(self):
        report={"facts":{"f1":{"dimensions":{"concept":"ifrs-full:Revenue","unit":"iso4217:EUR","period":"2025-10-01/2026-01-01"},"value":123}}}
        self.assertNotIn("revenue",mod.extract_metrics(report,"2025-12-31","EUR","https://filings.xbrl.org/a.json"))

if __name__=="__main__":unittest.main()
