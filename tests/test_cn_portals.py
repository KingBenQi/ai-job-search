"""Chinese portal wiring: fixtures stay valid, personal data stays ignored.

The parsers themselves are exercised by the bun suites
(.agents/skills/zhipin-search/cli/tests and liepin-search). Those suites read
the saved HTML/JSON fixtures and do not open a network connection. This file
guards the repo rules around them: gitignore, the workflow docs, and that the
fixture files the bun tests name are still on disk.
"""

import json
import subprocess
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent


def check_ignore(path: str) -> bool:
    result = subprocess.run(
        ["git", "check-ignore", "-q", "--", path],
        cwd=REPO,
        capture_output=True,
    )
    return result.returncode == 0


class ChinesePortalIgnoreTests(unittest.TestCase):
    def test_browser_session_and_deps_are_ignored(self):
        self.assertTrue(check_ignore(".browser-profiles/zhipin/Default/Cookies"))
        self.assertTrue(check_ignore(".browser-deps/node_modules/playwright/index.js"))
        self.assertTrue(check_ignore("profile.local.md"))
        self.assertTrue(check_ignore("profile.local/CLAUDE.md"))
        self.assertTrue(check_ignore("profile.local/01-candidate-profile.md"))
        self.assertTrue(check_ignore("cover_letters/greeting_acme_engineer.md"))

    def test_greeting_example_stays_tracked(self):
        self.assertFalse(
            check_ignore("cover_letters/greeting_zh_example.md"),
            "the structural greeting example must not be gitignored",
        )


class ChinesePortalWorkflowTests(unittest.TestCase):
    def test_apply_selects_chinese_templates_for_a_chinese_jd(self):
        apply_md = (REPO / ".claude/commands/apply.md").read_text(encoding="utf-8")
        self.assertIn("main_zh_example.tex", apply_md)
        self.assertIn("greeting_", apply_md)
        self.assertIn("ctex", apply_md)
        profile = (REPO / ".claude/skills/job-application-assistant/01-candidate-profile.md").read_text(encoding="utf-8")
        for field in ("期望城市", "期望薪资", "到岗时间", "学历"):
            self.assertIn(field, profile)

    def test_skills_document_login_limits_and_no_send(self):
        for name in ("zhipin-search", "liepin-search"):
            text = (REPO / ".agents/skills" / name / "SKILL.md").read_text(encoding="utf-8")
            self.assertIn("login", text)
            self.assertIn("--fixture", text)
            self.assertIn("SEND_REFUSED", text)
            self.assertIn("20", text)

    def test_readme_explains_setup_in_english_and_chinese(self):
        readme = (REPO / "README.md").read_text(encoding="utf-8")
        self.assertIn("Boss直聘", readme)
        self.assertIn("猎聘", readme)
        self.assertIn("## 中文：Boss直聘与猎聘", readme)
        self.assertIn("install_cn_browser.py", readme)
        self.assertIn("验证码", readme)
        self.assertIn("JiemsLBJ/offer-harvester", readme)
        self.assertIn("profile.local/", readme)
        confirm = (REPO / ".agents/skills/_cn-browser/src/confirm.ts").read_text(encoding="utf-8")
        tracker = (REPO / ".agents/skills/_cn-browser/src/tracker.ts").read_text(encoding="utf-8")
        for source in (confirm, tracker):
            self.assertIn("Copyright (c) 2026 JiemsLBJ", source)
            self.assertIn("Permission is hereby granted", source)

    def test_saved_fixtures_are_present_and_json_parses(self):
        pairs = [
            REPO / ".agents/skills/zhipin-search/cli/tests/fixtures/search.json",
            REPO / ".agents/skills/zhipin-search/cli/tests/fixtures/search.html",
            REPO / ".agents/skills/zhipin-search/cli/tests/fixtures/detail.json",
            REPO / ".agents/skills/liepin-search/cli/tests/fixtures/search.json",
            REPO / ".agents/skills/liepin-search/cli/tests/fixtures/search.html",
            REPO / ".agents/skills/liepin-search/cli/tests/fixtures/detail.html",
        ]
        for path in pairs:
            self.assertTrue(path.is_file(), path)
        zhipin = json.loads((REPO / ".agents/skills/zhipin-search/cli/tests/fixtures/search.json").read_text(encoding="utf-8"))
        self.assertIn("jobName", zhipin["zpData"]["jobList"][0])
        liepin = json.loads((REPO / ".agents/skills/liepin-search/cli/tests/fixtures/search.json").read_text(encoding="utf-8"))
        self.assertEqual(liepin["data"]["data"]["jobCardList"][0]["job"]["title"], "数据工程师")

    def test_adapter_interface_is_shared(self):
        types_src = (REPO / ".agents/skills/_cn-browser/src/types.ts").read_text(encoding="utf-8")
        self.assertIn("export interface PortalAdapter", types_src)
        registry = (REPO / ".agents/skills/_cn-browser/src/registry.ts").read_text(encoding="utf-8")
        self.assertIn("registerPortal", registry)
        for name in ("zhipin-search", "liepin-search"):
            source = (REPO / ".agents/skills" / name / "cli/src/parse.ts").read_text(encoding="utf-8")
            self.assertIn("registerPortal", source)
            self.assertNotIn("fetch(", source)

    def test_install_script_dry_run_does_not_touch_the_network(self):
        result = subprocess.run(
            ["python3", "tools/install_cn_browser.py", "--dry-run"],
            cwd=REPO,
            capture_output=True,
            text=True,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn(".browser-deps", result.stdout)
        self.assertIn("dry-run", result.stdout)
        self.assertFalse((REPO / ".browser-deps").exists())


if __name__ == "__main__":
    unittest.main()
