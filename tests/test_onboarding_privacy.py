"""Guards for the onboarding privacy warnings (issue #345).

The README's quick start walks a new user into creating a public fork
(forks of public repos cannot be private). /setup used to write personal
data into tracked files, with the only complete warning sitting in
SETUP.md section 8. These tests pin that the warning still lives at the
point of decision, and that /setup now writes personal data only under
gitignored profile.local/ and says so before it writes anything.
"""
import re
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
README = REPO / "README.md"
SETUP_GUIDE = REPO / "SETUP.md"
SETUP_COMMAND = REPO / ".claude" / "commands" / "setup.md"


def section(text: str, heading: str) -> str:
    """Body of a markdown section up to the next heading of the same level."""
    level = heading.split(" ")[0]
    pattern = re.compile(
        rf"^{re.escape(heading)}\n(.*?)(?=^{level} |\Z)", re.MULTILINE | re.DOTALL
    )
    match = pattern.search(text)
    return match.group(1) if match else ""


class TestForkWarningsAtTheDecisionPoint(unittest.TestCase):
    def assert_warns(self, body: str, where: str):
        self.assertRegex(
            body,
            re.compile(r"public", re.IGNORECASE),
            f"{where}'s fork section must say the fork will be public",
        )
        self.assertIn(
            "personal data",
            body,
            f"{where}'s fork section must say what happens to personal data",
        )
        self.assertIn("profile.local", body, f"{where} must name the gitignored profile directory")
        self.assertNotIn(
            "into **tracked** files",
            body,
            f"{where} must not tell the user that /setup personalizes tracked files",
        )
        self.assertRegex(
            body,
            re.compile(r"section 8|§8|#8-pulling", re.IGNORECASE),
            f"{where}'s fork section must point at SETUP.md section 8's private-remote recipe",
        )

    def test_readme_quick_start_warns_next_to_the_fork_command(self):
        body = section(README.read_text(encoding="utf-8"), "### 1. Fork and clone")
        self.assertIn("gh repo fork", body, "sanity: the fork command lives in this section")
        self.assert_warns(body, "README")

    def test_setup_guide_warns_next_to_the_fork_command(self):
        body = section(SETUP_GUIDE.read_text(encoding="utf-8"), "## 2. Fork and clone")
        self.assertIn("gh repo fork", body, "sanity: the fork command lives in this section")
        self.assert_warns(body, "SETUP.md")


class TestSetupChecksOriginBeforeWriting(unittest.TestCase):
    def test_preflight_exists_and_precedes_profile_generation(self):
        text = SETUP_COMMAND.read_text(encoding="utf-8")
        self.assertIn(
            "git remote get-url origin",
            text,
            "/setup must check where the working copy would publish to",
        )
        preflight_at = text.index("git remote get-url origin")
        writes_at = text.index("## Step 3: Generate Profile Files")
        self.assertLess(
            preflight_at,
            writes_at,
            "the origin check must run before any profile file is written - the "
            "existing Step 4 note fires after everything is already on disk",
        )
        self.assertIn(
            "public",
            text[max(0, preflight_at - 2000) : preflight_at + 2000].lower(),
            "the preflight must be about public visibility, not just remote presence",
        )

    def test_step3_writes_only_the_gitignored_profile(self):
        text = SETUP_COMMAND.read_text(encoding="utf-8")
        step3 = text[text.index("## Step 3:") : text.index("## Step 4:")]
        self.assertIn("profile.local/", step3)
        self.assertIn("Never modify the tracked template", step3)
        self.assertNotIn("into **tracked** files", text)


if __name__ == "__main__":
    unittest.main()
