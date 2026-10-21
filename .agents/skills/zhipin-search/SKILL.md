---
name: zhipin-search
version: 1.0.0
description: >
  Search Boss直聘 (zhipin.com) jobs for the Chinese market using the user's own
  logged-in browser. Invoke for 北京/上海/深圳/杭州 roles, 招聘, 找工作, Boss直聘,
  直聘, zhipin, and any zhipin.com job URL. Trigger phrases: Boss直聘, 直聘,
  zhipin, 找工作 北京, 搜索职位, job search China, Chinese tech jobs.
context: fork
enabled: true
allowed-tools: Bash(bun run .agents/skills/zhipin-search/cli/src/cli.ts *)
---

# Boss直聘 Search Skill

Search job listings on Boss直聘 with the browser profile you logged into yourself.
There is no public job API. The command opens Playwright against `.browser-profiles/zhipin`,
reads the page the site renders for you, and parses it. Fixture mode (`--fixture`)
parses a saved file and does not open a browser.

## Personal use only

Keep volume low. The CLI caps a command at 20 results and 3 pages and waits a few
seconds before each navigation. It does not solve captchas, does not retry a
challenge, and does not send 打招呼 or 投递. You paste any greeting yourself.

## Setup

```bash
python3 tools/install_cn_browser.py
bun run .agents/skills/zhipin-search/cli/src/cli.ts login
```

`login` must run in your own terminal. It opens a visible window. You scan the QR
code, then press Enter. An agent session without a TTY is refused.

## Commands

### Search

```bash
bun run .agents/skills/zhipin-search/cli/src/cli.ts search --query "后端" [flags]
```

- `--query` / `-q` — required keyword
- `--location` / `-l` — city name (`北京`) or a city code. Unknown names are not guessed.
- `--salary` — client-side overlap filter in monthly CNY. `20-40` and `20-40K` are thousands per month. `万/年` is divided by 12, `元/天` uses 21.75 pay-days, and `·N薪` is stored and scales the monthly amount by N/12. `25K以上` and `15K以下` are open on one side.
- `--include-unknown-salary` — when `--salary` is set, also keep `面议` and salaries the parser cannot read. Without this flag those cards are dropped.
- `--experience` — e.g. `3-5年`, `应届`, `1-3年`. Also sent as a site code when the label is known (see `url-reference.md`; those codes are unverified live).
- `--jobage <days>` — drop cards whose date is older than N days. Cards with no date are kept.
- `--page <n>` — 1-indexed, hard cap 3
- `--limit` / `-n` — hard cap 20, default 10
- `--fixture <file>` — parse saved HTML or JSON. No network.
- `--format json|table|plain` — default `json`
- `--headless` — hide the window. Challenges are still not solved.

### Detail

```bash
bun run .agents/skills/zhipin-search/cli/src/cli.ts detail <id|url> [--format json|plain]
```

### Greet (draft only)

```bash
bun run .agents/skills/zhipin-search/cli/src/cli.ts greet --company "示例科技" --role "后端工程师" --highlight "支付系统"
```

`--send` and `--batch` exit 1 with `SEND_REFUSED`. `--record` prints a confirm
gate and, only after you type `y` in a terminal, appends a `drafted` row to
`job_search_tracker.csv`. It still does not send. `--open <url>` shows that one
job page and waits. It does not type into the composer.

## Output

`search` prints `{ "meta": { "count", "page", "warnings" }, "results": [...] }`.
Each result has `id`, `title`, `company`, `location`, `date`, `url`, plus
`salary`, `experience`, `education`, `requirements`. Missing values are `null`.

Errors go to stderr as `{ "error", "code" }` and the process exits 1.
`MISSING_SESSION` means login has not been completed. `CHALLENGE_REQUIRED` means
stop and solve the prompt yourself.

## Notes

- City and experience codes are documented in `url-reference.md` and still need a live check.
- `/scrape` should not fall back to WebSearch for zhipin.com when this CLI fails.
- Do not commit `.browser-profiles/` or `.browser-deps/`.
