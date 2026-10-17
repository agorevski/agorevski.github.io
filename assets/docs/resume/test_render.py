import unittest
from pathlib import Path
import tempfile

import yaml
from pypdf import PdfReader, PdfWriter

from render import ROOT, fragment, render, write_pdf


class RenderTests(unittest.TestCase):
    def setUp(self):
        self.data = yaml.safe_load((ROOT / "resume.yaml").read_text(encoding="utf-8"))

    def test_variant_content_is_escaped_without_losing_formatting(self):
        self.data["name"] = 'Example <Name> & "Team"'
        self.data["experience"]["earlier"] = []
        self.data["publications"]["items"] = [
            [
                {"text": "Research & <results>", "style": "italic"},
                {"text": " reference", "url": 'https://example.com/?a=1&b="two"'},
            ]
        ]
        html = render(self.data)
        self.assertIn("Example &lt;Name&gt; &amp; &quot;Team&quot;", html)
        self.assertIn("<em>Research &amp; &lt;results&gt;</em>", html)
        self.assertIn('href="https://example.com/?a=1&amp;b=&quot;two&quot;"', html)
        self.assertNotIn("Analog Data Insights", html)

    def test_unquoted_numeric_dates_fail_explicitly(self):
        self.data["experience"]["current"]["dates"] = 2026
        with self.assertRaisesRegex(ValueError, "Quote numeric dates"):
            render(self.data)

    def test_scalar_highlights_fail_instead_of_rendering_character_by_character(self):
        self.data["experience"]["current"]["highlights"] = "Not a YAML list"
        with self.assertRaisesRegex(ValueError, "Expected a YAML list"):
            render(self.data)

    def test_invalid_links_and_styles_fail_explicitly(self):
        for invalid in (
            {"text": "link", "url": "javascript:alert(1)"},
            {"text": "link", "url": "/missing/scheme"},
            {"text": "text", "style": "unknown"},
        ):
            with self.subTest(fragment=invalid), self.assertRaises(ValueError):
                fragment(invalid)

    def test_pdf_timestamps_do_not_create_changes(self):
        with tempfile.TemporaryDirectory() as folder:
            directory = Path(folder)
            outputs = []
            for index in (1, 2):
                source = directory / f"source-{index}.pdf"
                output = directory / f"output-{index}.pdf"
                writer = PdfWriter()
                writer.add_blank_page(width=612, height=792)
                writer.add_metadata(
                    {
                        "/Title": "Resume",
                        "/CreationDate": f"D:2026010100000{index}Z",
                        "/ModDate": f"D:2026010100000{index}Z",
                    }
                )
                writer.write(source)
                write_pdf(source, output)
                outputs.append(output.read_bytes())
            self.assertEqual(outputs[0], outputs[1])
            self.assertEqual(PdfReader(output).metadata.title, "Resume")


if __name__ == "__main__":
    unittest.main()
