# Boss直聘 — URL and parse notes

Personal use only. The live path opens the user's own browser profile. It does
not call the site from CI, and it does not solve captchas.

These anchors are taken from public descriptions of the web app. They were
**not** re-checked against a logged-in session in this environment. When a
live search comes back empty or with null companies, capture the page (or the
`joblist.json` body the page itself requested) and update the fixtures under
`cli/tests/fixtures/` together with this file.

## Pages

| Purpose | URL |
|---|---|
| Login home | `https://www.zhipin.com/` |
| Search | `https://www.zhipin.com/web/geek/job?query=<关键词>&city=<code>&experience=<code>&page=<n>` |
| Job | `https://www.zhipin.com/job_detail/<encryptJobId>.html` |

`--page` on the CLI is 1-indexed and matches `page` on this URL. Page 1 omits the parameter.

## XHR hints

The browser records responses whose URL contains one of:

- `joblist.json`
- `zpgeek/search`
- `job/detail.json`

JSON wins over the HTML snapshot when it parses to more jobs. The HTML
fallback looks for `.job-card-wrapper`, `.job-name`, `.job-area`, `.salary`,
`.company-name`, and `.job-sec-text` on the detail page. Class tokens are
exact: `.salary` does not match `.job-salary`.

## JSON fields (search)

`zpData.jobList[]`: `encryptJobId`, `jobName`, `brandName`, `salaryDesc`,
`jobExperience`, `jobDegree`, `skills`, `cityName`, `areaDistrict`,
`businessDistrict`, optional `showDate` / `updateDate` (`YYYY-MM-DD`).
No date field means `date: null`. The CLI does not invent one.

## City codes (unverified)

| City | Code |
|---|---|
| 北京 | 101010100 |
| 上海 | 101020100 |
| 广州 | 101280100 |
| 深圳 | 101280600 |
| 杭州 | 101210100 |
| 成都 | 101270100 |
| 南京 | 101190100 |
| 武汉 | 101200100 |
| 西安 | 101110100 |
| 苏州 | 101190400 |
| 全国 | 100010000 |

An unknown city name is not given a guessed code. The URL omits `city`, and
cards are filtered by the name.

## Experience codes (unverified)

| Label | Code |
|---|---|
| 在校 / 实习 | 101 |
| 应届 | 102 |
| 1年以内 | 103 |
| 1-3年 | 104 |
| 3-5年 | 105 |
| 5-10年 | 106 |
| 10年以上 | 107 |

Salary is **not** sent as a site code. `--salary 20-40` keeps cards whose
monthly range overlaps that band (`20-40K` means 20–40 thousand CNY per
month). `面议` does not match a numeric filter.

## Limits

- `--limit` hard cap 20, default 10
- `--page` hard cap 3
- 2.5–7 seconds before each navigation
- `CHALLENGE_REQUIRED` and `LOGIN_REQUIRED` are terminal
