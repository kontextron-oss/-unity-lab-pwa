import importlib.util
import pathlib
import json
import tempfile
import unittest
from unittest import mock

path=pathlib.Path(__file__).resolve().parents[1]/"scripts"/"refresh_sec_fundamentals.py"
spec=importlib.util.spec_from_file_location("sec_fundamentals",path)
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

class SecValuationInputsTests(unittest.TestCase):
    def test_eaton_original_edgar_filer_is_linked_to_correct_isin(self):
        etn=mod.ISSUERS["ETN"]
        self.assertEqual(etn["cik"], "0001551182")
        self.assertEqual(etn["isin"], "IE00B8KQN827")
        self.assertEqual(etn["name"], "Eaton")
        self.assertEqual(mod.BASE+"/CIK"+etn["cik"]+".json",
                         "https://data.sec.gov/api/xbrl/companyfacts/CIK0001551182.json")

    def test_ge_vernova_and_vertiv_identity_registry(self):
        expected = {
            "GEV": ("0001996810", "US36828A1016", "GE Vernova"),
            "VRT": ("0001674101", "US92537N1081", "Vertiv"),
        }
        for ticker, (cik, isin, name) in expected.items():
            record = mod.ISSUERS[ticker]
            self.assertEqual(record["cik"], cik)
            self.assertEqual(record["isin"], isin)
            self.assertEqual(record["name"], name)
            self.assertTrue(record["ir"].startswith("https://"))

    def test_failed_sec_download_keeps_last_good_values_but_marks_stale(self):
        sample = {
            "name": "GE Vernova", "ticker": "GEV", "isin": "US36828A1016",
            "cik": "0001996810", "reportCurrency": "USD",
            "status": "metrics-complete", "checkedAt": "2026-11-05T12:00:00Z",
            "metrics": {"revenue": {"value": 38068000000}},
            "latestFiling": {"periodEnd": "2025-12-31", "reportUrl": "https://data.sec.gov/ok"}
        }
        bad = {**sample, "ticker": "VRT", "isin": "US92537N1081", "cik": "bad-cik"}
        with tempfile.TemporaryDirectory() as tmp:
            output = pathlib.Path(tmp) / "test.json"
            output.write_text(json.dumps({"items": {"GEV": sample, "VRT": bad}}), encoding="utf-8")
            with mock.patch.object(mod, "OUTPUT", output), mock.patch.object(
                    mod, "get_json", side_effect=RuntimeError("temporary SEC outage")):
                mod.main()
            data = json.loads(output.read_text(encoding="utf-8"))
        gev = data["items"]["GEV"]
        vrt = data["items"]["VRT"]
        self.assertEqual(gev["status"], "stale-previous")
        self.assertEqual(gev["metrics"], sample["metrics"])
        self.assertEqual(gev["lastVerifiedAt"], sample["checkedAt"])
        self.assertEqual(vrt["status"], "source-unavailable")
        self.assertEqual(vrt["metrics"], {})

    def test_balance_sheet_shares_cash_and_debt_are_not_confused_with_annual_average(self):
        end = "2025-12-31"
        def row(value, unit="USD", *, instant=False):
            result={"form":"10-K","fp":"FY","val":value,"end":end,
                    "filed":"2026-02-03","accn":"0001234567"}
            if not instant:
                result["start"]="2025-01-01"
            return result
        data = {"us-gaap": {
            "RevenueFromContractWithCustomerExcludingAssessedTax":{"units":{"USD":[row(1000)]}},
            "NetIncomeLoss":{"units":{"USD":[row(100)]}},
            "Assets":{"units":{"USD":[row(2000,instant=True)]}},
            "StockholdersEquity":{"units":{"USD":[row(500,instant=True)]}},
            "NetCashProvidedByUsedInOperatingActivities":{"units":{"USD":[row(180)]}},
            "EarningsPerShareDiluted":{"units":{"USD/shares":[row(5,"USD/shares")]}},
            "WeightedAverageNumberOfDilutedSharesOutstanding":{"units":{"shares":[row(22,"shares")]}},
            "CommonStockSharesOutstanding":{"units":{"shares":[row(20,"shares",instant=True)]}},
            "PaymentsToAcquirePropertyPlantAndEquipment":{"units":{"USD":[row(30)]}},
            "CashAndCashEquivalentsAtCarryingValue":{"units":{"USD":[row(120,instant=True)]}},
            "LongTermDebtNoncurrent":{"units":{"USD":[row(300,instant=True)]}},
            "ShortTermBorrowings":{"units":{"USD":[row(20,instant=True)]}},
        }}
        issuer={"name":"Example","isin":"US0000000001","cik":"0000000001","ir":"https://example.com"}
        with mock.patch.object(mod,"get_json",return_value={"facts":data}):
            item=mod.build_issuer("EX",issuer,"2026-02-04T00:00:00Z")
        self.assertEqual(item["status"],"metrics-complete")
        self.assertEqual(item["metrics"]["sharesOutstanding"]["value"],20)
        self.assertEqual(item["metrics"]["sharesOutstanding"]["unit"],"shares")
        self.assertEqual(item["metrics"]["sharesDiluted"]["value"],22)
        self.assertEqual(item["metrics"]["cashAndEquivalents"]["value"],120)
        self.assertEqual(item["metrics"]["debtLongTermNoncurrent"]["value"],300)
        self.assertEqual(item["metrics"]["shortTermBorrowings"]["value"],20)
        self.assertFalse(item["valuationInputs"]["completeDebtKnown"])
        self.assertFalse(item["valuationInputs"]["forwardGuidanceVerified"])
        self.assertNotIn("netDebt",item["metrics"])

    def test_never_fill_missing_shares_outstanding_from_diluted_average(self):
        end="2025-12-31"
        eps = {"form":"10-K","fp":"FY","val":3.0,"end":end,"filed":"2026-02-03"}
        shares={"form":"10-K","fp":"FY","val":1000,"end":end,"filed":"2026-02-03"}
        eps["start"]="2025-01-01"
        shares["start"]="2025-01-01"
        payload={"facts":{"us-gaap":{
            "EarningsPerShareDiluted":{"units":{"USD/shares":[eps]}},
            "WeightedAverageNumberOfDilutedSharesOutstanding":{"units":{"shares":[shares]}}
        }}}
        issuer={"name":"Test","isin":"US0000000001","cik":"0000000001","ir":"https://example.com"}
        with mock.patch.object(mod,"get_json",return_value=payload):
            item=mod.build_issuer("EX",issuer,"2026-02-04T00:00:00Z")
        self.assertNotIn("sharesOutstanding",item["metrics"])
        self.assertIn("sharesDiluted",item["metrics"])
        self.assertFalse(item["valuationInputs"]["completeDebtKnown"])

    def test_latest_fiscal_year_wins_over_more_numerous_old_rows(self):
        periods=[("2018-06-30","2017-07-01",20,"2018-08-01"),
                 ("2025-06-30","2024-07-01",90,"2025-08-01")]
        gaap={}
        for metric in ("RevenueFromContractWithCustomerExcludingAssessedTax","NetIncomeLoss",
                       "Assets","StockholdersEquity",
                       "NetCashProvidedByUsedInOperatingActivities"):
            rows=[]
            for end,start,value,filed in periods:
                for _ in range(12 if end.startswith("2018") else 1):
                    obj={"form":"10-K","fp":"FY","val":value,"end":end,
                         "filed":filed,"accn":"0001"}
                    if metric not in ("Assets","StockholdersEquity"):
                        obj["start"]=start
                    rows.append(obj)
            gaap[metric]={"units":{"USD":rows}}
        issuer={"name":"Microsoft","isin":"US5949181045","cik":"0000789019",
                "ir":"https://www.microsoft.com/en-us/Investor/"}
        with mock.patch.object(mod,"get_json",return_value={"facts":{"us-gaap":gaap}}):
            data=mod.build_issuer("MSFT",issuer,"2026-11-07T00:00:00Z")
        self.assertEqual(data["latestFiling"]["periodEnd"],"2025-06-30")
        self.assertEqual(data["status"],"metrics-complete")
        self.assertEqual(data["metrics"]["revenue"]["value"],90)
        self.assertEqual(data["periodQuality"]["status"],"current")
        self.assertIsNone(data["priorFiling"])
        self.assertNotIn("revenueGrowth",data["derived"])

    def test_quarterly_10k_comparatives_are_not_annual_flows(self):
        def flow(start,val,filed="2026-02-10"):
            return {"form":"10-K","fp":"FY","start":start,"end":"2025-12-31",
                    "val":val,"filed":filed}
        def instant(val):
            return {"form":"10-K","fp":"FY","end":"2025-12-31",
                    "val":val,"filed":"2026-02-10"}
        gaap={}
        for metric,value in (
            ("RevenueFromContractWithCustomerExcludingAssessedTax",1000),
            ("NetIncomeLoss",150),
            ("NetCashProvidedByUsedInOperatingActivities",180)):
            gaap[metric]={"units":{"USD":[flow("2025-10-01",value/4,"2026-02-11"),
                                             flow("2025-01-01",value)]}}
        gaap["Assets"]={"units":{"USD":[instant(2000)]}}
        gaap["StockholdersEquity"]={"units":{"USD":[instant(700)]}}
        issuer={"name":"Test","isin":"US0000000001","cik":"0000000001","ir":"https://example.com"}
        with mock.patch.object(mod,"get_json",return_value={"facts":{"us-gaap":gaap}}):
            r=mod.build_issuer("TEST",issuer,"2026-11-07T00:00:00Z")
        self.assertEqual(r["status"],"metrics-complete")
        self.assertEqual(r["metrics"]["revenue"]["value"],1000)
        self.assertEqual(r["metrics"]["operatingCashFlow"]["value"],180)

    def test_old_complete_company_is_not_approved_as_current(self):
        gaap={}
        for metric in ("RevenueFromContractWithCustomerExcludingAssessedTax","NetIncomeLoss",
                       "Assets","StockholdersEquity",
                       "NetCashProvidedByUsedInOperatingActivities"):
            row={"form":"10-K","fp":"FY","end":"2009-11-27",
                 "filed":"2010-01-15","val":200}
            if metric not in ("Assets","StockholdersEquity"):
                row["start"]="2008-11-29"
            gaap[metric]={"units":{"USD":[row]}}
        issuer={"name":"Adobe","isin":"US00724F1012","cik":"0000796343","ir":"https://adobe.com"}
        with mock.patch.object(mod,"get_json",return_value={"facts":{"us-gaap":gaap}}):
            r=mod.build_issuer("ADBE",issuer,"2026-11-07T00:00:00Z")
        self.assertEqual(r["status"],"filing-stale")
        self.assertEqual(r["periodQuality"]["status"],"stale")
        self.assertEqual(r["derived"],{})
        self.assertTrue(r["errors"])

    def test_newer_incomplete_year_blocks_backfilled_complete_older_filing(self):
        names=["RevenueFromContractWithCustomerExcludingAssessedTax","NetIncomeLoss",
               "Assets","StockholdersEquity","NetCashProvidedByUsedInOperatingActivities"]
        gaap={}
        for idx,key in enumerate(names):
            old={"form":"10-K","fp":"FY","end":"2024-12-31","filed":"2025-02-15","val":100}
            if key not in ("Assets","StockholdersEquity"): old["start"]="2024-01-01"
            rows=[old]
            if idx<2:
                recent={"form":"10-K","fp":"FY","end":"2025-12-31","filed":"2026-02-15","val":110}
                if key not in ("Assets","StockholdersEquity"):recent["start"]="2025-01-01"
                rows.append(recent)
            gaap[key]={"units":{"USD":rows}}
        issuer={"name":"Test","isin":"US0000000001","cik":"0000000001","ir":"https://example.com"}
        with mock.patch.object(mod,"get_json",return_value={"facts":{"us-gaap":gaap}}):
            r=mod.build_issuer("TEST",issuer,"2026-11-07T00:00:00Z")
        self.assertEqual(r["latestFiling"]["periodEnd"],"2025-12-31")
        self.assertEqual(r["status"],"metrics-partial")
        self.assertEqual(len(mod.REQUIRED_CORE.intersection(r["metrics"])),2)
        self.assertEqual(r["derived"],{})

    def test_annual_valuation_inputs_keep_exact_units_and_same_period(self):
        end="2025-12-31"
        def row(value,unit="USD", *, instant=False):
            result={"form":"10-K","fp":"FY","val":value,"end":end,"filed":"2026-02-01","accn":"0001"}
            if not instant:
                result["start"]="2025-01-01"
            return result
        concepts={
          "RevenueFromContractWithCustomerExcludingAssessedTax":{"units":{"USD":[row(1000)]}},
          "NetIncomeLoss":{"units":{"USD":[row(100)]}},
          "Assets":{"units":{"USD":[row(2000,instant=True)]}},
          "StockholdersEquity":{"units":{"USD":[row(500,instant=True)]}},
          "NetCashProvidedByUsedInOperatingActivities":{"units":{"USD":[row(180)]}},
          "EarningsPerShareDiluted":{"units":{"USD/shares":[row(5)]}},
          "WeightedAverageNumberOfDilutedSharesOutstanding":{"units":{"shares":[row(20)]}},
          "PaymentsToAcquirePropertyPlantAndEquipment":{"units":{"USD":[row(30)]}},
        }
        payload={"facts":{"us-gaap":concepts}}
        issuer={"name":"Example","isin":"US0000000001","cik":"0000000001","ir":"https://example.com/ir"}
        with mock.patch.object(mod,"get_json",return_value=payload):
            item=mod.build_issuer("EX",issuer,"2026-02-02T00:00:00Z")
        self.assertEqual(item["status"],"metrics-complete")
        self.assertEqual(item["metrics"]["epsDiluted"]["unit"],"USD/shares")
        self.assertEqual(item["metrics"]["sharesDiluted"]["unit"],"shares")
        self.assertEqual(item["derived"]["freeCashFlow"]["value"],150)
        self.assertEqual(item["derived"]["freeCashFlow"]["periodEnd"],end)

if __name__=="__main__":
    unittest.main()
