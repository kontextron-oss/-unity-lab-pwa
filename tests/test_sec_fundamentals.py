import importlib.util
import pathlib
import unittest
from unittest import mock

path=pathlib.Path(__file__).resolve().parents[1]/"scripts"/"refresh_sec_fundamentals.py"
spec=importlib.util.spec_from_file_location("sec_fundamentals",path)
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

class SecValuationInputsTests(unittest.TestCase):
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
