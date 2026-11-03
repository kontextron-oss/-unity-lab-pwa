import datetime as dt
import importlib.util
import pathlib
import unittest
import urllib.error

ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('capital_events',ROOT/'scripts'/'refresh_capital_events.py')
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
TODAY=dt.datetime(2026,11,3,8,0,0,tzinfo=dt.timezone.utc)


def item(number="768123-2026", when="2026-11-02+01:00", code="31170000", kind="can-standard", **kw):
    return {"publication-number":number,"publication-date":when,"notice-type":kind,
            "notice-title":"Transformers for electricity grid","buyer-name":"Public grid operator",
            "buyer-country":"DEU","winner-name":"Example Supplier GmbH",
            "winner-identifier":"DE12345","classification-cpv":code,
            "total-value":100000,"total-value-cur":"EUR",**kw}

class CapitalEventsTests(unittest.TestCase):
    def test_official_ted_api_query_is_anonymous_and_bounded(self):
        q=mod.query("31170000","20261001")
        self.assertIn('classification-cpv=31170000',q["query"])
        self.assertIn("notice-type=can-standard",q["query"])
        self.assertEqual(q["limit"],50)
        self.assertEqual(q["scope"],"ALL")
        self.assertTrue(q["onlyLatestVersions"])
        self.assertIn("winner-name",q["fields"])

    def test_strict_identity_date_type_and_cpv(self):
        items=[item(),item(),item("missing-number"),item("712345-2026",code="31320000"),
               item("712346-2026",kind="cn-standard"),
               item("712347-2026",when="2026-12-31"),
               item("712348-2026",when="2024-01-01")]
        got=mod.process(items,"31170000",TODAY.date())
        self.assertEqual([e["id"] for e in got],["768123-2026"])
        e=got[0]
        self.assertEqual(e["url"],"https://ted.europa.eu/en/notice/-/detail/768123-2026")
        self.assertEqual(e["publishedAt"],"2026-11-02")
        self.assertEqual(e["publishedValue"],100000)
        self.assertFalse(e["winnerIdentityVerified"])
        self.assertNotIn("stock",e)

    def test_multilingual_official_titles_and_buyer_not_cleared(self):
        record=item(**{
            "official-language":["DEU"],
            "notice-title":{"eng":"Transformer contract",
                            "deu":"Lieferung von Transformatoren"},
            "buyer-name":{"deu":["Stadtwerke Dresden"]},
            "winner-name":{"deu":["Lieferant GmbH"]},
        })
        result=mod.process([record],"31170000",TODAY.date())
        self.assertEqual(len(result),1)
        self.assertEqual(result[0]["title"],"Lieferung von Transformatoren")
        self.assertEqual(result[0]["titleLanguage"],"deu")
        self.assertEqual(result[0]["buyer"],"Stadtwerke Dresden")
        self.assertEqual(result[0]["winner"],"Lieferant GmbH")
        self.assertFalse(result[0]["winnerIdentityVerified"])

    def test_multilingual_competing_winners_are_not_single_company(self):
        record=item(**{
            "official-language":["ENG"],
            "winner-name":{"eng":["Vendor A", "Vendor B"]},
            "winner-identifier":["ID-A","ID-B"],
        })
        result=mod.process([record],"31170000",TODAY.date())
        self.assertEqual(result[0]["winner"],"")
        self.assertFalse(result[0]["winnerIdentityVerified"])

    def test_wrong_cpv_and_multi_winner_not_attributed(self):
        e=item(**{"winner-name":"Vendor A; Vendor B",
                  "winner-identifier":"id-a; id-b",
                  "classification-cpv":["31170000","31210000"]})
        result=mod.process([e],"31170000",TODAY.date())
        self.assertEqual(len(result),1)
        self.assertEqual(result[0]["winner"],"")
        self.assertFalse(result[0]["winnerIdentityVerified"])

    def test_award_value_without_currency_is_missing(self):
        e=item(**{"total-value":1999999,"total-value-cur":None})
        got=mod.process([e],"31170000",TODAY.date())
        self.assertIsNone(got[0]["publishedValue"])

    def test_first_poll_does_not_fabricate_new_event(self):
        def fake(q):
            cpv=q["query"].split('classification-cpv=')[1][:8]
            return {"notices":[item(code=cpv)],"totalNoticeCount":100}
        got=mod.build(None,source=fake,clock=lambda:TODAY)
        self.assertEqual(got["sourceFailures"],0)
        self.assertEqual(set(got["topics"]),set(mod.TOPICS))
        first=got["topics"]["transformers"]
        self.assertEqual(first["status"],"available")
        self.assertEqual(first["newSincePreviousScan"],0)
        self.assertEqual(first["sampleSize"],1)
        self.assertFalse(first["isComplete"])
        self.assertEqual(first["events"][0]["firstSeenAt"],TODAY.isoformat(timespec="seconds"))
        second=mod.build(got,source=fake,clock=lambda:TODAY+dt.timedelta(days=1))
        self.assertFalse(second["topics"]["transformers"]["events"][0]["newSincePreviousScan"])

    def test_subsequent_new_publication_is_marked_without_equity_ownership_claim(self):
        def fake(q):
            cpv=q["query"].split('classification-cpv=')[1][:8]
            return {"notices":[item(code=cpv)],"totalNoticeCount":1}
        first=mod.build(None,source=fake,clock=lambda:TODAY)
        def new(q):
            cpv=q["query"].split('classification-cpv=')[1][:8]
            return {"notices":[item("999999-2026",code=cpv),item(code=cpv)],"totalNoticeCount":2}
        second=mod.build(first,source=new,clock=lambda:TODAY+dt.timedelta(days=1))
        e=second["topics"]["transformers"]["events"]
        self.assertEqual(second["topics"]["transformers"]["newSincePreviousScan"],1)
        self.assertTrue(e[0]["newSincePreviousScan"])
        self.assertFalse(e[1]["newSincePreviousScan"])

    def test_failed_source_explicitly_stale_no_signal(self):
        def fake(q):
            cpv=q["query"].split('classification-cpv=')[1][:8]
            return {"notices":[item(code=cpv)],"totalNoticeCount":1}
        before=mod.build(None,source=fake,clock=lambda:TODAY)
        def fail(q):raise urllib.error.HTTPError(mod.URL,503,"unavailable",{},None)
        after=mod.build(before,source=fail,clock=lambda:TODAY+dt.timedelta(days=1))
        self.assertEqual(after["sourceFailures"],len(mod.TOPICS))
        self.assertEqual(after["topics"]["transformers"]["status"],"stale")
        self.assertEqual(after["topics"]["transformers"]["newSincePreviousScan"],0)
        self.assertEqual(after["topics"]["transformers"]["events"][0]["id"],"768123-2026")
        self.assertIn("Archiv",after["topics"]["transformers"]["warning"])

    def test_invalid_response_fails_closed(self):
        def fail(q):return {"unexpected":"values"}
        d=mod.build(source=fail,clock=lambda:TODAY)
        self.assertEqual(d["sourceFailures"],3)
        self.assertEqual(d["topics"]["cooling"]["status"],"unavailable")
        self.assertEqual(d["topics"]["cooling"]["events"],[])

if __name__=="__main__":
    unittest.main()
