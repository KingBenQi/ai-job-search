# Browser-session portal adapter

Boss直聘 and 猎聘 have no public job API. This folder is the shared runtime
those skills use. A later board (前程无忧, 拉勾) plugs in here instead of
copying the browser code.

## Add a portal

1. Create `.agents/skills/<name>-search/` with the same shape as `zhipin-search`:
   `SKILL.md`, `url-reference.md`, and a `cli/` whose `src/cli.ts` calls
   `runPortalCli`.
2. Implement a `PortalAdapter` (`types.ts`): `searchPageUrl`, `normalizeQuery`,
   `parseSearch`, `parseDetail`, `hosts`, `responseUrlHints`, `challengeMarkers`.
3. Call `registerPortal` when the module loads.
4. Map search hits through a `toSearchHit` in that skill's `helpers.ts` so the
   `/scrape` contract fields (`title`, `company`, `location`, `date`, `url`)
   are present. Missing values are `null`.
5. Add fixture HTML/JSON and bun tests. Tests must not open a browser or the
   network. `--fixture` is the offline path.
6. Grant `Bash(bun run .agents/skills/<name>-search/cli/src/cli.ts:*)` in
   `.claude/settings.json` and in `ALLOWED_PERMISSIONS` in
   `tools/security_guards.py` in the same change.

Keep the limits in `limits.ts`: at most 20 results, at most 3 pages, a delay
before each navigation, no captcha solving, no `--send`. `refusesSubmit` stays
true. `greet --record` shows the confirm gate and, only after an explicit yes,
appends a `drafted` row to gitignored `job_search_tracker.csv`. It never sends.

The confirm gate (`confirm.ts`), the tracker row (`tracker.ts`), and the
read-only Boss直聘 boundary are adapted from
[JiemsLBJ/offer-harvester](https://github.com/JiemsLBJ/offer-harvester) (MIT;
`automation/apply_bot/confirm.py`, `tracker.py`, and `portals/boss.py`). That
project does not support 猎聘. Copyright notices are in the adapted files.

`login` requires a TTY. The user scans the QR code. Cookies stay under
`.browser-profiles/<id>/`, which is gitignored.

Playwright is loaded from `.browser-deps/` (see `tools/install_cn_browser.py`).
Do not add it to a tracked `package.json`.
