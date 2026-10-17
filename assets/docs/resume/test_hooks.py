from pathlib import Path
import shutil
import shlex
import subprocess
import sys
import tempfile
import unittest


HOOKS = Path(__file__).resolve().parents[3] / ".githooks"


class HookTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="hook-test-", dir=".")
        self.addCleanup(self.temporary.cleanup)
        self.repo = Path(self.temporary.name).resolve()
        self.resume = self.repo / "assets/docs/resume"
        self.resume.mkdir(parents=True)
        shutil.copytree(HOOKS, self.repo / ".githooks")
        (self.repo / "scripts").mkdir()
        shutil.copyfile(HOOKS.parent / "scripts/build_site.py", self.repo / "scripts/build_site.py")
        for name, content in {
            "index.html": '<head><link rel="stylesheet" href="/assets/css/styles.css"></head>',
            "404.html": "Not found",
            "favicon.ico": "icon",
            ".nojekyll": "",
            "assets/css/styles.css": "body { color: green; }",
            "assets/js/main.js": "console.log('site');",
            ".gitignore": "/_site/\n",
        }.items():
            path = self.repo / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content)
        self.git("init", "--quiet")
        self.git("config", "user.name", "Hook Test")
        self.git("config", "user.email", "hook-test@example.invalid")
        self.git("config", "core.hooksPath", ".githooks")
        self.source = self.resume / "resume.yaml"
        self.source.write_text("first version\n")
        python = self.resume / ".venv/bin/python"
        python.parent.mkdir(parents=True)
        python.write_text(
            "#!/bin/sh\n"
            "set -eu\n"
            "case \"$1\" in\n"
            "scripts/build_site.py) exec " + shlex.quote(sys.executable) + " \"$@\" ;;\n"
            "assets/docs/resume/render.py) ;;\n"
            "*) exit 2 ;;\n"
            "esac\n"
            "test ! -f fail-render\n"
            "mkdir -p assets/docs/resume/generated\n"
            "cp assets/docs/resume/resume.yaml assets/docs/resume/generated/resume.pdf\n"
        )
        python.chmod(0o755)
        (self.resume / ".gitignore").write_text(".venv/\n")
        self.git("add", ".")
        self.git("commit", "--quiet", "-m", "Initial")
        self.assert_site_built("first version\n")

    def assert_site_built(self, resume):
        output = self.repo / "_site"
        self.assertIn("<style>", (output / "index.html").read_text())
        self.assertNotIn('<link rel="stylesheet"', (output / "index.html").read_text())
        self.assertEqual((output / "assets/docs/resume/generated/resume.pdf").read_text(), resume)
        self.assertEqual((output / "assets/js/main.js").read_text(), "console.log('site');")
        self.assertEqual(self.git("ls-files", "--", "_site").stdout, "")

    def git(self, *args, check=True):
        return subprocess.run(
            ["git", *args], cwd=self.repo, check=check, capture_output=True, text=True
        )

    def push_hook(self):
        return subprocess.run(
            [str(self.repo / ".githooks/pre-push")],
            cwd=self.repo,
            capture_output=True,
            text=True,
        )

    def test_commit_includes_changed_pdf_and_preserves_other_staged_files(self):
        self.source.write_text("second version\n")
        (self.repo / "unrelated.txt").write_text("keep staged\n")
        stylesheet = self.repo / "assets/css/styles.css"
        stylesheet.write_text("body { color: red; }")
        self.git("add", "assets/docs/resume/resume.yaml", "unrelated.txt", "assets/css/styles.css")
        stylesheet.write_text("body { color: blue; }")
        self.git("commit", "--quiet", "-m", "Update")
        self.assertEqual(
            self.git("show", "HEAD:assets/docs/resume/generated/resume.pdf").stdout,
            "second version\n",
        )
        self.assertEqual(self.git("show", "HEAD:unrelated.txt").stdout, "keep staged\n")
        self.assertEqual(self.git("show", "HEAD:assets/css/styles.css").stdout, "body { color: red; }")
        self.assert_site_built("second version\n")
        self.assertIn("color: blue", (self.repo / "_site/index.html").read_text())
        stylesheet.write_text("body { color: purple; }")
        self.assertEqual(self.push_hook().returncode, 0)
        self.assert_site_built("second version\n")
        self.assertIn("color: purple", (self.repo / "_site/index.html").read_text())
        self.assertEqual(self.git("status", "--porcelain").stdout, " M assets/css/styles.css\n")

    def test_unstaged_sources_block_commit_without_staging_excluded_content(self):
        self.source.write_text("staged version\n")
        self.git("add", "assets/docs/resume/resume.yaml")
        self.source.write_text("excluded version\n")
        result = self.git("commit", "--quiet", "-m", "Update", check=False)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("unstaged changes", result.stderr)
        self.assertEqual(
            self.git("show", ":assets/docs/resume/generated/resume.pdf").stdout,
            "first version\n",
        )

    def test_push_stages_changed_pdf_and_requires_a_commit(self):
        self.source.write_text("second version\n")
        self.git("add", "assets/docs/resume/resume.yaml")
        before = self.git("rev-parse", "HEAD").stdout
        result = self.push_hook()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("commit the resume changes", result.stderr)
        self.assertEqual(self.git("rev-parse", "HEAD").stdout, before)
        self.assertEqual(
            self.git("show", ":assets/docs/resume/generated/resume.pdf").stdout,
            "second version\n",
        )

    def test_export_failure_blocks_commits_and_pushes(self):
        (self.repo / "fail-render").touch()
        result = self.git(
            "commit", "--quiet", "--allow-empty", "-m", "Fail", check=False
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertNotIn("Building production site", result.stderr)
        result = self.push_hook()
        self.assertNotEqual(result.returncode, 0)
        self.assertNotIn("Building production site", result.stderr)

    def test_build_failure_blocks_commits_and_pushes_without_staging_site_edits(self):
        before = self.git("rev-parse", "HEAD").stdout
        (self.repo / "index.html").write_text("<head>missing stylesheet</head>")
        for result in (
            self.git("commit", "--quiet", "--allow-empty", "-m", "Fail", check=False),
            self.push_hook(),
        ):
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("Build failed:", result.stderr)
        self.assertEqual(self.git("rev-parse", "HEAD").stdout, before)
        self.assertEqual(self.git("diff", "--cached", "--name-only").stdout, "")
        self.assert_site_built("first version\n")


if __name__ == "__main__":
    unittest.main()
