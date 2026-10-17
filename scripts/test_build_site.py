from pathlib import Path
import tempfile
import unittest

from build_site import MANIFEST, build_site


class BuildSiteTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory(prefix="build-site-test-", dir=".")
        self.addCleanup(self.directory.cleanup)
        self.source = Path(self.directory.name).resolve()
        self.html = '<!doctype html>\n<head><link rel="stylesheet" href="/assets/css/styles.css"></head>'
        self.css = "body { color: green; }\n"
        for name, content in {
            "index.html": self.html,
            "404.html": "Not found",
            "favicon.ico": "icon",
            ".nojekyll": "",
            "assets/css/styles.css": self.css,
            "assets/js/main.js": "console.log('hello');",
            "assets/img/profile/profile-small.webp": "image",
            "assets/img/favicon.svg": "<svg/>",
            "assets/docs/Alex_Gorevski_Resume_2025.pdf": "legacy PDF",
            "assets/docs/resume/generated/resume.pdf": "current PDF",
        }.items():
            self.write(name, content)

    def write(self, name, content):
        path = self.source / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")

    def test_inlines_canonical_css_without_changing_sources(self):
        before = {path.relative_to(self.source): path.read_bytes() for path in self.source.rglob("*") if path.is_file()}
        output = build_site(self.source)
        html = (output / "index.html").read_text()
        self.assertIn(f"<style>\n{self.css}\n</style>", html)
        self.assertNotIn('<link rel="stylesheet"', html)
        self.assertNotIn("/assets/css/styles.css", html)
        for relative, content in before.items():
            self.assertEqual((self.source / relative).read_bytes(), content)
            if relative != Path("index.html"):
                self.assertEqual((output / relative).read_bytes(), content)
        second = build_site(self.source, self.source / "_site-second")
        self.assertEqual(
            {path.relative_to(output): path.read_bytes() for path in output.rglob("*") if path.is_file()},
            {path.relative_to(second): path.read_bytes() for path in second.rglob("*") if path.is_file()},
        )

    def test_excludes_non_public_files(self):
        expected = {path.relative_to(self.source) for path in self.source.rglob("*") if path.is_file()}
        for private in (
            "README.md", ".git/config", ".github/workflows/deploy-pages.yml",
            ".githooks/pre-commit", "scripts/build_site.py",
            "assets/docs/resume/render.py", "assets/docs/resume/resume.yaml",
            "assets/docs/resume/resume.css", "assets/docs/resume/template.html",
            "assets/docs/resume/fonts/Carlito-Regular.ttf",
            "assets/docs/resume/test_render.py", "assets/docs/resume/__pycache__/render.pyc",
            "assets/docs/resume/generated/resume.html",
            "assets/img/__pycache__/hidden.png", "assets/js/.hidden.js",
        ):
            self.write(private, "private")
        output = build_site(self.source)
        self.assertEqual(
            {path.relative_to(output) for path in output.rglob("*") if path.is_file()},
            expected | {Path(MANIFEST)},
        )

    def test_repeat_build_refreshes_content_and_removes_obsolete_assets(self):
        output = build_site(self.source)
        (self.source / "assets/img/profile/profile-small.webp").unlink()
        self.write("assets/img/new.webp", "new image")
        self.write("assets/css/styles.css", "body { color: blue; }")
        build_site(self.source)
        self.assertFalse((output / "assets/img/profile").exists())
        self.assertEqual((output / "assets/img/new.webp").read_text(), "new image")
        self.assertIn("color: blue", (output / "index.html").read_text())
        build_site(self.source)

    def test_adopts_identical_legacy_output_but_rejects_modified_output(self):
        output = build_site(self.source)
        (output / MANIFEST).unlink()
        build_site(self.source)
        self.assertTrue((output / MANIFEST).is_file())
        (output / MANIFEST).unlink()
        (output / "index.html").write_text("local edits")
        with self.assertRaisesRegex(ValueError, "does not match"):
            build_site(self.source)
        self.assertEqual((output / "index.html").read_text(), "local edits")

    def test_repeat_build_preserves_unknown_files_and_rejects_symlinks(self):
        output = build_site(self.source)
        before = (output / "index.html").read_bytes()
        self.write("assets/css/styles.css", "body { color: blue; }")
        for name in ("notes.txt", "assets/img/local.webp", "empty-directory"):
            with self.subTest(name=name):
                path = output / name
                if name == "empty-directory":
                    path.mkdir()
                else:
                    path.write_text("keep")
                with self.assertRaisesRegex(ValueError, "unknown"):
                    build_site(self.source)
                self.assertEqual((output / "index.html").read_bytes(), before)
                if path.is_dir():
                    path.rmdir()
                else:
                    self.assertEqual(path.read_text(), "keep")
                    path.unlink()
        target = output / "assets/js/main.js"
        target.unlink()
        target.symlink_to(self.source / "assets/js/main.js")
        with self.assertRaisesRegex(ValueError, "unknown"):
            build_site(self.source)
        self.assertEqual((self.source / "assets/js/main.js").read_text(), "console.log('hello');")

    def test_missing_required_inputs_fail_before_creating_output(self):
        for name in ("index.html", "404.html", "favicon.ico", ".nojekyll", "assets/css/styles.css"):
            with self.subTest(name=name):
                path = self.source / name
                content = path.read_bytes()
                path.unlink()
                with self.assertRaisesRegex(FileNotFoundError, "Missing required public file"):
                    build_site(self.source)
                self.assertFalse((self.source / "_site").exists())
                path.write_bytes(content)

    def test_stylesheet_mismatches_fail_before_creating_output(self):
        for html in (
            "<head></head>",
            self.html.replace("styles.css", "other.css"),
            self.html + '<link rel="stylesheet" href="/extra.css">',
            self.html.replace('rel="stylesheet"', 'rel="stylesheet" media="print"'),
        ):
            with self.subTest(html=html):
                self.write("index.html", html)
                with self.assertRaises(ValueError):
                    build_site(self.source)
                self.assertFalse((self.source / "_site").exists())

    def test_unsafe_css_fails_explicitly(self):
        for css in ("</style><script>alert(1)</script>", "a { background: url(../img/a.png); }", '@import "/other.css";'):
            with self.subTest(css=css):
                self.write("assets/css/styles.css", css)
                with self.assertRaises(ValueError):
                    build_site(self.source)
                self.assertFalse((self.source / "_site").exists())

    def test_output_safety_and_existing_files_are_preserved(self):
        output = self.source / "_site"
        output.mkdir()
        marker = output / "keep.txt"
        marker.write_text("keep")
        for destination in (output, self.source, self.source.parent / "outside-site", self.source / "assets/new"):
            with self.subTest(destination=destination):
                with self.assertRaises(ValueError):
                    build_site(self.source, destination)
        self.assertEqual(marker.read_text(), "keep")

    def test_public_symlinks_are_rejected(self):
        (self.source / "assets/js/leak.js").symlink_to(self.source / "index.html")
        with self.assertRaisesRegex(ValueError, "symlinks"):
            build_site(self.source)
        self.assertFalse((self.source / "_site").exists())


if __name__ == "__main__":
    unittest.main()
