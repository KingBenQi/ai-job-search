#!/usr/bin/env python3
"""Install Playwright into the gitignored .browser-deps directory.

Boss直聘 and 猎聘 CLIs load Playwright from that directory at runtime.
Nothing here is added to a tracked package.json, and this script is not
part of CI. It does not log in and it does not open a job site.

    python3 tools/install_cn_browser.py
    python3 tools/install_cn_browser.py --dry-run
"""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEST = ROOT / ".browser-deps"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Install Playwright for the Chinese job-board CLIs.")
    parser.add_argument("--dry-run", action="store_true", help="print the target directory and exit")
    args = parser.parse_args(argv)
    print(f"browser dependencies: {DEST}")
    if args.dry_run:
        print("dry-run: not installing")
        return 0
    npm = shutil.which("npm")
    node = shutil.which("node")
    if not npm or not node:
        print("npm and node are required to install Playwright.", file=sys.stderr)
        return 1
    DEST.mkdir(parents=True, exist_ok=True)
    subprocess.check_call([npm, "install", "--prefix", str(DEST), "playwright"])
    cli = DEST / "node_modules" / "playwright" / "cli.js"
    subprocess.check_call([node, str(cli), "install", "chromium"])
    print("Playwright is installed. Log in next, in your own terminal:")
    print("  bun run .agents/skills/zhipin-search/cli/src/cli.ts login")
    print("  bun run .agents/skills/liepin-search/cli/src/cli.ts login")
    return 0


if __name__ == "__main__":
    sys.exit(main())
