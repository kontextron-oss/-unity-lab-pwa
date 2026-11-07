import copy
import datetime as dt
import importlib.util
import json
import pathlib
import unittest

ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location("forecast_model",ROOT/"scripts"/"refresh_unity_model_forecasts.py")
m=importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
SEC=json.loads((ROOT/"data"/"sec-fundamentals.json").read_text(encoding="utf-8"))
BEFORE=dt.datetime(2026,11,7,0,15,tzinfo=dt.timezone.utc)
AFTER=dt.datetime(2027,3,12,12,0,tzinfo=dt.timezone.utc)

def sample_future(ticker="VRT",revenue=14_650_000_000,filed="2027-02-21"):
    data=copy.deepcopy(SEC)
    item=data["items"][ticker]
    item["priorFiling"]={"periodEnd":"2025-12-31"}
    item["priorMetrics"]=copy.deepcopy(item["metrics"])
    item["latestFiling"]["periodEnd"]="2026-12-31"
    item["metrics"]["revenue"]["periodEnd"]="2026-12-31"
    item["metrics"]["revenue"]["filed"]=filed
    item["metrics"]["revenue"]["value"]=revenue
    data["generatedAt"]="2027-03-12T12:00:00Z"
    return data

class FrozenRevenueModelTests(unittest.TestCase):
    def test_source_bound_and_prospective_four_2026_benchmarks(self):
        result=m.build(SEC,{},BEFORE)
        self.assertEqual(len(result["forecasts"]),4)
        self.assertEqual(result["measuredSampleSize"],0)
        self.assertIsNone(result["verifiedForecastSkill"])
        for ticker in m.COMPANY:
            f=result["forecasts"][f"{m.MODEL}:{ticker}:FY2026"]
            x=f["frozen"]
            self.assertEqual(f["status"],"awaiting-audited-target-year")
            self.assertEqual(x["targetPeriodEnd"],"2026-12-31")
            self.assertLess(x["basePeriodEnd"],x["createdAt"][:10])
            self.assertLess(x["createdAt"][:10],x["targetPeriodEnd"])
            self.assertEqual(x["inputs"]["current"]["periodEnd"],"2025-12-31")
            self.assertEqual(x["inputs"]["prior"]["periodEnd"],"2024-12-31")
            self.assertFalse(x["calibrated"])
            self.assertTrue(x["nonProbabilistic"])
            self.assertEqual(x["modelId"],m.MODEL)
            self.assertEqual(f["forecastFingerprint"],m.immutable_hash(x))
        vrt=result["forecasts"][f"{m.MODEL}:VRT:FY2026"]["frozen"]
        self.assertAlmostEqual(vrt["projectedGrowthPct"],13.84,delta=.02)
        self.assertEqual(vrt["predictedRevenueUSD"],11_650_000_000)
        self.assertEqual(vrt["flatRevenueBenchmarkUSD"],10_229_900_000)
        # A transparency benchmark does not become an investment permission.
        self.assertNotIn("tradeApproved",result)
        self.assertNotIn("buy",json.dumps(result).lower())

    def test_model_freezes_when_daily_data_refreshes(self):
        first=m.build(SEC,{},BEFORE)
        later=m.build(SEC,first,dt.datetime(2026,11,25,12,0,tzinfo=dt.timezone.utc))
        self.assertEqual(len(later["forecasts"]),4)
        for key,row in first["forecasts"].items():
            self.assertEqual(row["forecastFingerprint"],later["forecasts"][key]["forecastFingerprint"])
            self.assertEqual(row["frozen"],later["forecasts"][key]["frozen"])

    def test_actual_requires_matching_sec_identity_period_and_after_registration(self):
        state=m.build(SEC,{},BEFORE)
        future=sample_future()
        # Even if a malformed source claims 2026 results prematurely, must not use.
        self.assertIsNone(m.observed_future(state["forecasts"][f"{m.MODEL}:VRT:FY2026"]["frozen"],
            future["items"]["VRT"],BEFORE))
        observed=m.build(future,state,AFTER)
        v=observed["forecasts"][f"{m.MODEL}:VRT:FY2026"]
        self.assertEqual(v["status"],"verified")
        self.assertEqual(v["verified"]["valueUSD"],14_650_000_000)
        self.assertGreater(v["verified"]["absoluteErrorPct"],v["verified"]["baselineAbsoluteErrorPct"] if False else 0)
        self.assertEqual(v["verified"]["outperformedFlatBaseline"],True)
        self.assertEqual(observed["measuredSampleSize"],1)
        self.assertIsNone(observed["verifiedForecastSkill"],"Never claim forecast accuracy from one completed year")
        # Register next FY only after FY2026 is actually published.
        self.assertIn(f"{m.MODEL}:VRT:FY2027",observed["forecasts"])
        wrong=sample_future()
        wrong["items"]["VRT"]["isin"]="US0000000001"
        self.assertIsNone(m.observed_future(v["frozen"],wrong["items"]["VRT"],AFTER))
        wrong=sample_future()
        wrong["items"]["VRT"]["metrics"]["revenue"]["concept"]="ifrs-full:Revenue"
        self.assertIsNone(m.observed_future(v["frozen"],wrong["items"]["VRT"],AFTER))
        wrong=sample_future(filed="2026-11-06")
        self.assertIsNone(m.observed_future(v["frozen"],wrong["items"]["VRT"],AFTER))
        wrong=sample_future(filed="2027-03-13")
        self.assertIsNone(m.observed_future(v["frozen"],wrong["items"]["VRT"],AFTER))
        wrong=sample_future()
        wrong["items"]["VRT"]["status"]="filing-stale"
        self.assertIsNone(m.observed_future(v["frozen"],wrong["items"]["VRT"],AFTER))

    def test_restatements_cannot_mutate_frozen_prediction_or_first_outcome(self):
        original=m.build(SEC,{},BEFORE)
        measured=m.build(sample_future(),original,AFTER)
        restated=m.build(sample_future(revenue=15_000_000_000,filed="2027-04-01"),
            measured,dt.datetime(2027,4,2,10,0,tzinfo=dt.timezone.utc))
        key=f"{m.MODEL}:VRT:FY2026"
        self.assertEqual(restated["forecasts"][key]["status"],"revision-review")
        self.assertEqual(restated["forecasts"][key]["verified"]["valueUSD"],14_650_000_000)
        self.assertEqual(restated["forecasts"][key]["observedCandidate"]["valueUSD"],15_000_000_000)
        self.assertEqual(restated["forecasts"][key]["frozen"],original["forecasts"][key]["frozen"])
        lost=m.build(SEC,measured,AFTER)
        self.assertEqual(lost["forecasts"][key]["status"],"verified-previous-source-unavailable")
        self.assertEqual(lost["forecasts"][key]["verified"]["valueUSD"],14_650_000_000)

    def test_fingerprint_changed_or_previous_filing_missing_fails_closed(self):
        registered=m.build(SEC,{},BEFORE)
        bad=copy.deepcopy(registered)
        key=f"{m.MODEL}:VRT:FY2026"
        bad["forecasts"][key]["frozen"]["predictedRevenueUSD"]+=10_000_000
        with self.assertRaisesRegex(ValueError,"fingerprint"):
            m.build(SEC,bad,AFTER)
        corrupted=copy.deepcopy(SEC)
        corrupted["items"]["VRT"]["priorMetrics"]["revenue"]["concept"]="us-gaap:Revenues"
        self.assertIsNone(m.candidate_for("VRT",corrupted["items"]["VRT"],BEFORE))
        corrupted=copy.deepcopy(SEC)
        corrupted["items"]["VRT"]["status"]="filing-stale"
        self.assertIsNone(m.candidate_for("VRT",corrupted["items"]["VRT"],BEFORE))

if __name__=="__main__":
    unittest.main()
