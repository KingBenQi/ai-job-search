---
name: liepin-search
version: 1.0.0
description: >
  Search 猎聘 (liepin.com, c.liepin.com) jobs for the Chinese market using the
  user's own logged-in browser. Invoke for 猎聘, liepin, 找工作, 招聘, Chinese
  professional jobs, and any liepin.com or c.liepin.com job URL. Trigger phrases:
  猎聘, liepin, c.liepin, 找工作 上海, job search China, 中高端招聘.
context: fork
enabled: true
allowed-tools: Bash(bun run .agents/skills/liepin-search/cli/src/cli.ts *)
---

# 猎聘 Search Skill

Search 猎聘 with the browser profile you logged into yourself. Login starts at
`https://c.liepin.com/`. Job pages and the search results used here are on
`https://www.liepin.com/`. There is no public job API. Fixture mode (`--fixture`)
parses a saved file and does not open a browser.

## Personal use only

Keep volume low. The CLI caps a command at 20 results and 3 pages and waits a few
seconds before each navigation. It does not solve captchas, does not retry a
challenge, and does not send messages or applications. You stay in control of
any 打招呼 or 投递.

## Setup

```bash
python3 tools/install_cn_browser.py
bun run .agents/skills/liepin-search/cli/src/cli.ts login
```

`login` must run in your own terminal. You sign in, then press Enter.

## Commands

### Search

```bash
bun run .agents/skills/liepin-search/cli/src/cli.ts search --query "数据工程师" --location "上海" [flags]
```

Flags match `zhipin-search`: `--query`/`-q`, `--location`/`-l`, `--salary`,
`--experience`, `--jobage`, `--page` (1-indexed; the site's `currentPage` is
0-indexed and the CLI converts), `--limit`/`-n` (hard cap 20), `--fixture`,
`--format json|table|plain`, `--headless`.

Salary is filtered on the parsed cards (`25-40k` overlaps `--salary 20-40`).
City codes are listed in `url-reference.md` and are unverified against a live session.

### Detail

```bash
bun run .agents/skills/liepin-search/cli/src/cli.ts detail <id|url> [--format plain]
```

### Greet (draft only)

```bash
bun run .agents/skills/liepin-search/cli/src/cli.ts greet --company "示例数据" --role "数据工程师"
```

`--send` and `--batch` exit 1 with `SEND_REFUSED`. `--record` prints a confirm
gate and, only after you type `y` in a terminal, appends a `drafted` row to
`job_search_tracker.csv`. It still does not send.

## Output

Same JSON contract as the other portal CLIs: `id`, `title`, `company`, `location`,
`date`, `url`, plus salary, experience, education, and requirements. `date` comes
from `refreshTime` when the payload has one, otherwise `null`.

Errors are JSON on stderr. `MISSING_SESSION` and `CHALLENGE_REQUIRED` are stops.
Do not fall back to WebSearch for liepin.com.

## Notes

- Detail salary is read from `class="salary"`. `class="job-salary"` is a different card and is ignored.
- Do not commit `.browser-profiles/` or `.browser-deps/`.
