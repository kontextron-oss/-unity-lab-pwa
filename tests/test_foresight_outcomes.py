import copy
import datetime as dt
import importlib.util
import json
import pathlib
import unittest

ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location("monitor",ROOT/"scripts"/"refresh_foresight_outcomes.py")
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
now=dt.datetime(2026,11,7,0,40,tzinfo=dt.timezone.utc)
next_year=dt.datetime(2027,3,10,12,0,tzinfo=dt.timezone.utc)
checkpoints=json.loads((ROOT/"data"/"foresight-checkpoints.json").read_text())
sec=json.loads((ROOT/"data"/"sec-fundamentals.json").read_text())
eaton=next(c for c in checkpoints["checkpoints"] if c["ticker"]=="ETN")
vertiv_rev=next(c for c in checkpoints["checkpoints"] if c["ticker"]=="VRT" and c["metric"]=="revenue")
vertiv_eps=next(c for c in checkpoints["checkpoints"] if c["ticker"]=="VRT" and c["metric"]=="epsDiluted")

def filed_sec(ticker,metric,value,filed="2027-02-21"):
    cloned=copy.deepcopy(sec)
    issuer=cloned["items"][ticker]
    issuer["latestFiling"]["periodEnd"]="2026-12-31"
    m=issuer["metrics"][metric]
    m["value"]=value
    m["periodEnd"]="2026-12-31"
    m["filed"]=filed
    cloned["generatedAt"]="2027-03-10T12:00:00Z"
    return cloned

class ForesightAnnualAuditTest(unittest.TestCase):
    def test_current_source_has_only_pending_outcomes(self):
        result=mod.build(checkpoints,sec,{},now)
        self.assertEqual(len(result["entries"]),3)
        self.assertEqual(result["counts"]["verified"],0)
        self.assertEqual(result["counts"]["awaiting-audited-FY2026"],3)
        for cid,row in result["entries"].items():
            self.assertEqual(row["verified"],None)
            self.assertEqual(row["status"],"awaiting-audited-FY2026")
            self.assertEqual(row["lastCheckedAt"],"2026-11-07T00:40:00Z")
            self.assertEqual(row["forecastFingerprint"],mod.fingerprint(next(
                c for c in checkpoints["checkpoints"] if c["id"]==cid)))

    def test_verified_eaton_range_only_after_2026_filing(self):
        sample=filed_sec("ETN","epsDiluted",10.44)
        rows=mod.build(checkpoints,sample,{},next_year)["entries"]
        r=rows[eaton["id"]]
        self.assertEqual(r["status"],"verified")
        self.assertEqual(r["verified"]["value"],10.44)
        self.assertEqual(r["verified"]["category"],"within-guidance")
        self.assertEqual(r["verified"]["errorPercent"],0.0)
        self.assertEqual(rows[vertiv_rev["id"]]["status"],"awaiting-audited-FY2026")

    def test_vertiv_range_and_midpoint_are_not_confused(self):
        sample=filed_sec("VRT","revenue",15_200_000_000)
        rows=mod.build(checkpoints,sample,{},next_year)["entries"]
        self.assertEqual(rows[vertiv_rev["id"]]["verified"]["category"],"above-guidance")
        self.assertEqual(rows[vertiv_eps["id"]]["status"],"awaiting-audited-FY2026")
        sample=filed_sec("VRT","revenue",14_000_000_000)
        rows=mod.build(checkpoints,sample,{},next_year)["entries"]
        self.assertEqual(rows[vertiv_rev["id"]]["verified"]["category"],"below-guidance")
        sample=filed_sec("VRT","epsDiluted",6.59)
        rows=mod.build(checkpoints,sample,{},next_year)["entries"]
        self.assertEqual(rows[vertiv_eps["id"]]["verified"]["category"],"point-deviation")
        self.assertAlmostEqual(rows[vertiv_eps["id"]]["verified"]["errorPercent"],4.77,delta=0.01)

    def test_previous_published_result_is_immutable_after_restatement(self):
        original=filed_sec("ETN","epsDiluted",10.44)
        first=mod.build(checkpoints,original,{},next_year)
        changed=filed_sec("ETN","epsDiluted",11.09,filed="2027-04-04")
        refreshed=mod.build(checkpoints,changed,first,
                          dt.datetime(2027,4,5,10,0,tzinfo=dt.timezone.utc))
        row=refreshed["entries"][eaton["id"]]
        self.assertEqual(row["status"],"revision-review")
        self.assertEqual(row["verified"]["value"],10.44)
        self.assertEqual(row["observedCandidate"]["value"],11.09)
        unavailable=mod.build(checkpoints,sec,first,next_year)
        row=unavailable["entries"][eaton["id"]]
        self.assertEqual(row["status"],"verified-previous-source-unavailable")
        self.assertEqual(row["verified"]["value"],10.44)

    def test_only_exact_cik_isin_gaap_concept_period_and_filed_date(self):
        good=filed_sec("VRT","revenue",14_650_000_000)
        self.assertIsNotNone(mod.sec_value(vertiv_rev,good["items"],next_year))
        cases=[]
        for field,value in [("cik","0000000001"),("isin","US0000000001"),
                            ("status","stale-previous"),("reportCurrency","EUR")]:
            item=copy.deepcopy(good)
            item["items"]["VRT"][field]=value
            cases.append(item)
        item=copy.deepcopy(good);item["items"]["VRT"]["metrics"]["revenue"]["concept"]="ifrs-full:Revenue";cases.append(item)
        item=copy.deepcopy(good);item["items"]["VRT"]["metrics"]["revenue"]["sourceUrl"]="https://bad.example/";cases.append(item)
        item=copy.deepcopy(good);item["items"]["VRT"]["metrics"]["revenue"]["filed"]="2026-11-06";cases.append(item)
        item=copy.deepcopy(good);item["items"]["VRT"]["metrics"]["revenue"]["filed"]="2027-03-11";cases.append(item)
        item=copy.deepcopy(good);item["items"]["VRT"]["latestFiling"]["reportUrl"]="https://data.sec.gov/api/xbrl/companyfacts/CIK0000000001.json";cases.append(item)
        for case in cases:
            with self.subTest(field=len(cases)):
                self.assertIsNone(mod.sec_value(vertiv_rev,case["items"],next_year))

    def test_registered_forecast_cannot_change_or_vanish(self):
        first=mod.build(checkpoints,sec,{},now)
        revised=copy.deepcopy(checkpoints)
        revised["checkpoints"][0]["forecast"]["low"]+=0.01
        with self.assertRaisesRegex(ValueError,"Previously registered forecast changed"):
            mod.build(revised,sec,first,next_year)
        reduced=copy.deepcopy(checkpoints)
        reduced["checkpoints"].pop()
        with self.assertRaisesRegex(ValueError,"Previously registered checkpoint removed"):
            mod.build(reduced,sec,first,next_year)

    def test_no_backdating_without_source_identity(self):
        bad=copy.deepcopy(checkpoints)
        bad["checkpoints"][0]["recordedAt"]="2026-10-01"
        with self.assertRaises(ValueError):
            mod.build(bad,sec,{},now)
        bad=copy.deepcopy(checkpoints)
        bad["checkpoints"][0]["recordedAt"]="2026-11-08"
        with self.assertRaises(ValueError):
            mod.build(bad,sec,{},now)

if __name__=="__main__":
    unittest.main()
