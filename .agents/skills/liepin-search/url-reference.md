# 猎聘 — URL and parse notes

Personal use only. The live path opens the user's own browser profile. It does
not call the site from CI, and it does not solve captchas.

The user-facing entry named in this fork is `https://c.liepin.com/`. Job URLs
and the search results page used here are on `https://www.liepin.com/`. One
browser profile is shared. The anchors below come from public descriptions of
the candidate site and were **not** re-checked against a logged-in session in
this environment. Update `cli/tests/fixtures/` and this file together when the
live page drifts.

## Pages

| Purpose | URL |
|---|---|
| Login home | `https://c.liepin.com/` |
| Search | `https://www.liepin.com/zhaopin/?key=<关键词>&city=<code>&dq=<code>&currentPage=<n>` |
| Job | `https://www.liepin.com/job/<jobId>.shtml` |

The CLI `--page` flag is 1-indexed, matching every other portal skill.
猎聘's `currentPage` is 0-indexed, so CLI page 1 becomes `currentPage=0`.

## XHR hints

Responses whose URL contains `pc-search-job`, `com.liepin.search`, or
`searchfront4c` are captured. A typical body is:

```
{ flag, data: { data: { jobCardList: [ { job, comp } ] } } }
```

`job`: `jobId`, `title`, `dq`, `salary`, `requireWorkYears`, `requireEduLevel`,
`link`, `refreshTime` (`YYYYMMDDHHMMSS`, stored as `YYYY-MM-DD`).
`comp.compName` is the company.

HTML fallback classes, exact tokens:

- card: `job-card-pc-container` (also `job-card-box`)
- title: `job-title-box`
- company: `company-name`
- location: `job-dq-box`
- salary on a card: `job-salary`
- detail salary of **this** job: `salary` (not `job-salary`, which is a different card)
- detail body: `job-intro-content`

## City codes (unverified)

| City | Code |
|---|---|
| 北京 | 010 |
| 上海 | 020 |
| 天津 | 030 |
| 重庆 | 040 |
| 广州 | 050020 |
| 深圳 | 050090 |
| 杭州 | 070020 |
| 南京 | 060020 |
| 成都 | 280020 |
| 武汉 | 170020 |
| 苏州 | 060080 |

Unknown names are not guessed. Salary is filtered on the parsed cards, same
rules as Boss直聘 (`20-40` overlaps `25-40k`).

## Limits

Same as the shared adapter: 20 results, 3 pages, a delay before navigation,
no captcha bypass, no send.
