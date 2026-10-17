from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest


HOOKS = Path(__file__).resolve().parents[3] / ".githooks"


class HookTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.repo = Path(self.temporary.name)
        self.resume = self.repo / "assets/docs/resume"
        self.resume.mkdir(parents=True)
        shutil.copytree(HOOKS, self.repo / ".githooks")
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
            "test ! -f fail-render\n"
            "mkdir -p assets/docs/resume/generated\n"
            "cp assets/docs/resume/resume.yaml assets/docs/resume/generated/resume.pdf\n"
        )
        python.chmod(0o755)
        (self.resume / ".gitignore").write_text(".venv/\n")
        self.git("add", ".")
        self.git("commit", "--quiet", "-m", "Initial")

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
        self.git("add", "assets/docs/resume/resume.yaml", "unrelated.txt")
        self.git("commit", "--quiet", "-m", "Update")
        self.assertEqual(
            self.git("show", "HEAD:assets/docs/resume/generated/resume.pdf").stdout,
            "second version\n",
        )
        self.assertEqual(self.git("show", "HEAD:unrelated.txt").stdout, "keep staged\n")
        self.assertEqual(self.push_hook().returncode, 0)
        self.assertEqual(self.git("status", "--porcelain").stdout, "")

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
        self.assertNotEqual(self.push_hook().returncode, 0)


if __name__ == "__main__":
    unittest.main()
