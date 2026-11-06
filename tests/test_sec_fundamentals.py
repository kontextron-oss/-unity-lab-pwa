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
        def row(value, unit="USD"):
            return {"form":"10-K","fp":"FY","val":value,"end":end,
                    "filed":"2026-02-03","accn":"0001234567"}
        data = {"us-gaap": {
            "RevenueFromContractWithCustomerExcludingAssessedTax":{"units":{"USD":[row(1000)]}},
            "NetIncomeLoss":{"units":{"USD":[row(100)]}},
            "Assets":{"units":{"USD":[row(2000)]}},
            "StockholdersEquity":{"units":{"USD":[row(500)]}},
            "NetCashProvidedByUsedInOperatingActivities":{"units":{"USD":[row(180)]}},
            "EarningsPerShareDiluted":{"units":{"USD/shares":[row(5,"USD/shares")]}},
            "WeightedAverageNumberOfDilutedSharesOutstanding":{"units":{"shares":[row(22,"shares")]}},
            "CommonStockSharesOutstanding":{"units":{"shares":[row(20,"shares")]}},
            "PaymentsToAcquirePropertyPlantAndEquipment":{"units":{"USD":[row(30)]}},
            "CashAndCashEquivalentsAtCarryingValue":{"units":{"USD":[row(120)]}},
            "LongTermDebtNoncurrent":{"units":{"USD":[row(300)]}},
            "ShortTermBorrowings":{"units":{"USD":[row(20)]}},
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

    def test_annual_valuation_inputs_keep_exact_units_and_same_period(self):
        end="2025-12-31"
        def row(value,unit="USD"):
            return {"form":"10-K","fp":"FY","val":value,"end":end,"filed":"2026-02-01","accn":"0001"}
        concepts={
          "RevenueFromContractWithCustomerExcludingAssessedTax":{"units":{"USD":[row(1000)]}},
          "NetIncomeLoss":{"units":{"USD":[row(100)]}},
          "Assets":{"units":{"USD":[row(2000)]}},
          "StockholdersEquity":{"units":{"USD":[row(500)]}},
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
