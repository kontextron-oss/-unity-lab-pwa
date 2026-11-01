import datetime as dt
import importlib.util
import pathlib
import unittest

path = pathlib.Path(__file__).resolve().parents[1] / "scripts" / "refresh_intraday.py"
spec = importlib.util.spec_from_file_location("refresh_intraday", path)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class TestEuropeanPilot(unittest.TestCase):
    def setUp(self):
        self.now = dt.datetime(2026, 11, 2, 15, 0, tzinfo=dt.timezone.utc)
        stamp = int(self.now.timestamp()) - 1800
        self.chart = {
            "meta": {"symbol": "IFX.DE", "currency": "EUR", "fullExchangeName": "Xetra"},
            "timestamp": [stamp - 1800, stamp - 900, stamp],
            "indicators": {"quote": [{"close": [33.1, 33.2, 33.3]}]},
        }

    def test_quote_has_source_timestamp_and_currency(self):
        q = module.extract_quote(self.chart, "DE0006231004", "IFX.DE", "EUR", "Infineon", self.now)
        self.assertEqual(q["price"], 33.3)
        self.assertEqual(q["currency"], "EUR")
        self.assertEqual(q["quotePrecision"], "15m-bar")
        self.assertIsNone(q["delayedMinutes"])
        self.assertIn("2026-11-02T14:30:00", q["quotedAt"])

    def test_currency_conflict_fails_closed(self):
        with self.assertRaisesRegex(ValueError, "currency mismatch"):
            module.extract_quote(self.chart, "DE0006231004", "IFX.DE", "USD", "Infineon", self.now)

    def test_symbol_conflict_fails_closed(self):
        with self.assertRaisesRegex(ValueError, "symbol mismatch"):
            module.extract_quote(self.chart, "DE0006231004", "IFX", "EUR", "Infineon", self.now)

    def test_no_future_or_old_bars(self):
        self.chart["timestamp"] = [int(self.now.timestamp()) + 7200] * 3
        with self.assertRaisesRegex(ValueError, "insufficient"):
            module.extract_quote(self.chart, "DE0006231004", "IFX.DE", "EUR", "Infineon", self.now)
        self.chart["timestamp"] = [int(self.now.timestamp()) - 10 * 86400 - i * 900 for i in (2, 1, 0)]
        with self.assertRaisesRegex(ValueError, "too old"):
            module.extract_quote(self.chart, "DE0006231004", "IFX.DE", "EUR", "Infineon", self.now)

if __name__ == "__main__":
    unittest.main()
