import importlib.util
import pathlib
import unittest

path = pathlib.Path(__file__).resolve().parents[1] / "scripts" / "verify_issuer_pdf.py"
spec = importlib.util.spec_from_file_location("issuerpdf", path)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

def word(x, y, s):
    return (x-10, y-5, x+10, y+5, s, 0, 0, 0)

def make_words(lines, headers, width=1000):
    out = [word(x, 90, "2025") for x in headers]
    for y, elements in lines:
        for x, piece in elements:
            for i, token in enumerate(piece.split()):
                out.append(word(x+i*25, y, token))
    return out

class PdfStatementsTest(unittest.TestCase):
    def test_source_allowlist_and_period_binding(self):
        self.assertEqual(set(mod.SOURCES), {"CH0012221716", "DE000ENER6Y0", "DE0006231004"})
        for issuer in mod.SOURCES.values():
            self.assertTrue(issuer["url"].startswith("https://" + issuer["host"] + "/"))
            self.assertEqual(issuer["periodEnd"], "2025-12-31" if issuer["name"] == "ABB" else "2025-09-30")
            self.assertEqual(set(issuer["facts"]), {"revenue","netIncome","assets","equity","operatingCashFlow"})
        with self.assertRaises(ValueError):
            mod.fetch_pdf("https://evil.example/report.pdf", "www.infineon.com")

    def test_selects_exact_2025_column_and_ignores_previous_year(self):
        words = make_words([(170, [(40, "Revenue"), (800, "39,077"), (915, "34,465")]),
                            (210, [(40, "Net income (loss)"), (800, "1,685"), (915, "1,335")])], [800])
        self.assertEqual(mod.parse_statement_row(words, 1000, 1200, 2025, 0, "Revenue"), 39077)
        self.assertEqual(mod.parse_statement_row(words, 1000, 1200, 2025, 0, "Net income (loss)"), 1685)

    def test_both_columns_on_one_statement_page(self):
        words = make_words([(170, [(40, "Total assets"), (320, "30,470"), (420, "28,639"),
                                     (510, "Total equity"), (770, "17,051"), (880, "17,219")])],
                           [320, 770])
        self.assertEqual(mod.parse_statement_row(words,1000,1200,2025,0,"Total assets"),30470)
        self.assertEqual(mod.parse_statement_row(words,1000,1200,2025,1,"Total equity"),17051)

    def test_excludes_continuing_operations_and_no_invented_values(self):
        words = make_words([
            (170, [(40, "Cash flows from operating activities from continuing operations"), (320, "3,178")]),
            (210, [(40, "Cash flows from operating activities"), (320, "3,217"), (415, "2,780")]),
        ], [320])
        self.assertEqual(mod.parse_statement_row(words,1000,1200,2025,0,
                         "Cash flows from operating activities"),3217)
        with self.assertRaises(ValueError):
            mod.parse_statement_row(words,1000,1200,2025,0,"Total assets")

    def test_abb_gaap_group_values_and_correct_company(self):
        abb = mod.SOURCES["CH0012221716"]
        self.assertEqual(abb["standard"], "US-GAAP")
        self.assertEqual(abb["currency"], "USD")
        self.assertEqual(abb["facts"]["revenue"][:4], (54, 0, "Total revenues", 33220))
        self.assertEqual(abb["facts"]["netIncome"][:4], (54, 0, "Net income", 4823))
        self.assertEqual(abb["facts"]["assets"][:4], (56, 0, "Total assets", 44885))
        self.assertEqual(abb["facts"]["equity"][:4], (56, 0, "Total stockholders’ equity", 16646))
        self.assertEqual(abb["facts"]["operatingCashFlow"][:4],
                         (57, 0, "Net cash provided by operating activities", 5469))
        self.assertLess(abb["facts"]["netIncome"][4], 1.0,
                        "Duplicate income-per-share rows must remain outside selected region")

    def test_conflicting_2025_rows_rejected(self):
        words = make_words([
            (170, [(40, "Revenue"), (800, "39,077")]),
            (210, [(40, "Revenue"), (800, "40,000")]),
        ], [800])
        with self.assertRaises(ValueError):
            mod.parse_statement_row(words,1000,1200,2025,0,"Revenue")

if __name__ == "__main__":
    unittest.main()
