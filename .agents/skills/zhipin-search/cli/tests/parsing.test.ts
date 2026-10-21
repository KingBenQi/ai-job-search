import { describe, expect, test } from "bun:test"
import { mkdtempSync, readFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { applyFilters, parseSalary } from "../../../_cn-browser/src/filters.js"
import { classifyEmpty, delayMs } from "../../../_cn-browser/src/limits.js"
import { hasClass } from "../../../_cn-browser/src/html.js"
import { portalForHost, registerPortal } from "../../../_cn-browser/src/registry.js"
import { confirmAccepted, renderConfirm } from "../../../_cn-browser/src/confirm.js"
import { assertNoSend, draftGreeting } from "../../../_cn-browser/src/greet.js"
import { TRACKER_HEADER, upsertDraft } from "../../../_cn-browser/src/tracker.js"
import { PortalError, type PortalAdapter, type SearchQuery } from "../../../_cn-browser/src/types.js"

import { fixture, runCLI } from "./helpers.ts"
import {
  parseZhipinDetail,
  parseZhipinSearch,
  zhipinAdapter,
  zhipinExperienceCode,
  zhipinSearchPage,
} from "../src/parse.ts"

const searchJson = () => readFileSync(fixture("search.json"), "utf8")
const searchHtml = () => readFileSync(fixture("search.html"), "utf8")

describe("Boss直聘 search JSON", () => {
  test("reads the contract fields and skips a card with no title", () => {
    const jobs = parseZhipinSearch(searchJson())
    expect(jobs.map((job) => job.id)).toEqual(["abc123", "lowpay", "shenzhen"])
    const first = jobs[0]
    expect(first.title).toBe("后端&数据工程师")
    expect(first.company).toBe("示例科技")
    expect(first.location).toBe("北京·朝阳区·望京")
    expect(first.date).toBe("2099-01-15")
    expect(first.url).toBe("https://www.zhipin.com/job_detail/abc123.html")
    expect(first.salary).toBe("20-40K·15薪")
    expect(first.experience).toBe("3-5年")
    expect(first.education).toBe("本科")
    expect(first.requirements).toBe("Java, Spring")
    expect(first.description).toBeNull()
  })

  test("filters salary, city, and experience without dropping undated cards", () => {
    const jobs = parseZhipinSearch(searchJson())
    const query: SearchQuery = {
      query: "后端",
      cityName: "北京",
      salary: "20-40",
      experience: "3-5年",
      jobage: 14,
      page: 1,
      limit: 10,
      warnings: [],
    }
    const kept = applyFilters(jobs, query, new Date("2026-10-21T00:00:00Z"))
    expect(kept.map((job) => job.id)).toEqual(["abc123"])
  })
})

describe("Boss直聘 search HTML", () => {
  test("parses complete cards and skips a card with no title", () => {
    const jobs = parseZhipinSearch(searchHtml())
    expect(jobs).toHaveLength(2)
    expect(jobs[0].title).toBe("后端&数据工程师")
    expect(jobs[0].company).toBe("示例科技")
    expect(jobs[0].location).toBe("北京·朝阳区·望京")
    expect(jobs[0].salary).toBe("20-40K")
    expect(jobs[0].requirements).toBe("Java, Spring")
    expect(jobs[0].url).toBe("https://www.zhipin.com/job_detail/htmljob1.html")
    expect(jobs[1].id).toBe("htmljob3")
    expect(jobs[1].url).toBe("https://www.zhipin.com/job_detail/htmljob3.html")
  })

  test("does not treat job-salary as the salary class", () => {
    expect(hasClass('<span class="job-salary">', "salary")).toBe(false)
    expect(hasClass('<span class="salary">', "salary")).toBe(true)
  })
})

describe("Boss直聘 detail", () => {
  test("JSON description is decoded text", () => {
    const job = parseZhipinDetail(readFileSync(fixture("detail.json"), "utf8"), "https://www.zhipin.com/job_detail/abc123.html")
    expect(job.title).toBe("后端工程师")
    expect(job.company).toBe("示例科技")
    expect(job.description).toBe("负责支付系统的接口设计。\n要求熟悉 Java。")
    expect(job.requirements).toBe("Java, MySQL")
    expect(job.education).toBe("本科")
  })

  test("HTML description ignores the similar-job salary", () => {
    const job = parseZhipinDetail(readFileSync(fixture("detail.html"), "utf8"), "https://www.zhipin.com/job_detail/abc123.html")
    expect(job.salary).toBe("20-40K")
    expect(job.description).toContain("支付系统")
    expect(job.description).not.toContain("8-12K")
  })
})

describe("query building", () => {
  test("maps a known city and experience onto the search page", () => {
    const query = zhipinAdapter.normalizeQuery({
      query: "后端",
      location: "杭州",
      experience: "3-5年",
      page: 2,
      limit: 10,
      warnings: [],
    })
    expect(query.cityCode).toBe("101210100")
    expect(zhipinExperienceCode("3-5年")).toBe("105")
    const url = new URL(zhipinSearchPage(query))
    expect(url.hostname).toBe("www.zhipin.com")
    expect(url.searchParams.get("query")).toBe("后端")
    expect(url.searchParams.get("city")).toBe("101210100")
    expect(url.searchParams.get("experience")).toBe("105")
    expect(url.searchParams.get("page")).toBe("2")
  })

  test("does not invent a city code", () => {
    const query = zhipinAdapter.normalizeQuery({
      query: "后端",
      location: "不存在市",
      page: 1,
      limit: 10,
      warnings: [],
    })
    expect(query.cityCode).toBeUndefined()
    expect(query.warnings.join(" ")).toContain("不存在市")
    expect(new URL(zhipinSearchPage(query)).searchParams.get("city")).toBeNull()
  })
})

describe("portal adapter", () => {
  test("resolves zhipin hosts and accepts another adapter", () => {
    expect(portalForHost("www.zhipin.com")?.id).toBe("zhipin")
    expect(portalForHost("evil-zhipin.com")).toBeUndefined()
    const extra: PortalAdapter = {
      id: "lagou",
      displayName: "拉勾",
      refusesSubmit: true,
      hosts: ["lagou.com"],
      challengeMarkers: [],
      responseUrlHints: [],
      homeUrl: "https://www.lagou.com/",
      searchPageUrl: () => "https://www.lagou.com/",
      normalizeQuery: (query) => query,
      parseSearch: () => [],
      parseDetail: () => ({
        id: "x",
        title: "x",
        company: null,
        location: null,
        date: null,
        url: "https://www.lagou.com/job/x",
        salary: null,
        experience: null,
        education: null,
        requirements: null,
        description: null,
      }),
    }
    registerPortal(extra)
    expect(portalForHost("www.lagou.com")?.id).toBe("lagou")
  })
})

describe("politeness", () => {
  test("delay stays inside the polite window", () => {
    expect(delayMs(() => 0)).toBe(2500)
    expect(delayMs(() => 0.999)).toBeLessThanOrEqual(7000)
    expect(delayMs(() => 0.999)).toBeGreaterThanOrEqual(2500)
  })

  test("a challenge is not an empty result", () => {
    expect(classifyEmpty('{"message":"请完成验证"}', zhipinAdapter.challengeMarkers)).toBe("CHALLENGE_REQUIRED")
    expect(classifyEmpty('{"message":"请登录"}', zhipinAdapter.challengeMarkers)).toBe("LOGIN_REQUIRED")
    expect(classifyEmpty('{"zpData":{"jobList":[]}}', zhipinAdapter.challengeMarkers)).toBe("NO_RESULTS")
  })

  test("greeting is short and send is refused", () => {
    const text = draftGreeting({ company: "示例科技", role: "后端工程师", highlight: "支付系统" })
    expect(text).toContain("示例科技")
    expect(text).toContain("后端工程师")
    expect(text.length).toBeLessThanOrEqual(120)
    expect(() => assertNoSend({ send: true })).toThrow(PortalError)
    expect(parseSalary("20-40K·15薪")?.min).toBe(20000)
    expect(zhipinAdapter.refusesSubmit).toBe(true)
  })

  test("confirm accepts an explicit yes and a draft row stays drafted", () => {
    expect(confirmAccepted("确认")).toBe(true)
    expect(confirmAccepted("no")).toBe(false)
    const shown = renderConfirm({
      portal: "Boss直聘",
      jobTitle: "后端工程师",
      company: "示例科技",
      fields: ["草稿"],
      notes: ["不会自动发送"],
    })
    expect(shown).toContain("提交前确认")
    expect(shown).not.toContain("http")
    const path = join(mkdtempSync(join(tmpdir(), "cn-tracker-")), "job_search_tracker.csv")
    upsertDraft({ path, company: "示例科技", role: "后端工程师", portal: "zhipin", status: "drafted" })
    upsertDraft({ path, company: "示例科技", role: "后端工程师", portal: "zhipin", status: "drafted" })
    const lines = readFileSync(path, "utf8").trim().split("\n")
    expect(lines[0]).toBe(TRACKER_HEADER)
    expect(lines).toHaveLength(2)
    expect(lines[1]).toContain("drafted")
    expect(lines[1]).toContain("greeting-draft")
    expect(lines[1]).not.toContain("applied")
    expect(lines[1]).not.toContain("auto-submit")
  })
})

describe("CLI fixtures", () => {
  test("search json fixture applies filters and does not need a browser", async () => {
    const result = await runCLI([
      "search",
      "-q",
      "后端",
      "-l",
      "北京",
      "--salary",
      "20-40",
      "--experience",
      "3-5年",
      "--fixture",
      fixture("search.json"),
      "--format",
      "json",
    ])
    expect(result.exitCode).toBe(0)
    const body = JSON.parse(result.stdout)
    expect(body.results).toHaveLength(1)
    expect(body.results[0].title).toBe("后端&数据工程师")
    expect(body.results[0].company).toBe("示例科技")
    expect(body.meta.count).toBe(1)
  })

  test("detail plain fixture prints the description", async () => {
    const result = await runCLI([
      "detail",
      "https://www.zhipin.com/job_detail/abc123.html",
      "--fixture",
      fixture("detail.json"),
      "--format",
      "plain",
    ])
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain("负责支付系统")
    expect(result.stdout).toContain("示例科技")
  })

  test("unknown flag and oversize limit fail before any browser", async () => {
    const unknown = await runCLI(["search", "-q", "后端", "--nope"])
    expect(unknown.exitCode).toBe(1)
    expect(JSON.parse(unknown.stderr).code).toBe("UNKNOWN_FLAG")
    const capped = await runCLI(["search", "-q", "后端", "--fixture", fixture("search.json"), "--limit", "50"])
    expect(capped.exitCode).toBe(1)
    expect(JSON.parse(capped.stderr).code).toBe("LIMIT_EXCEEDED")
  })

  test("greet refuses to send", async () => {
    const refused = await runCLI(["greet", "--company", "示例科技", "--role", "后端工程师", "--send"])
    expect(refused.exitCode).toBe(1)
    expect(JSON.parse(refused.stderr).code).toBe("SEND_REFUSED")
    const draft = await runCLI(["greet", "--company", "示例科技", "--role", "后端工程师", "--highlight", "支付"])
    expect(draft.exitCode).toBe(0)
    expect(draft.stdout).toContain("示例科技")
    expect(draft.stdout).not.toContain("http")
    const recorded = await runCLI(["greet", "--company", "示例科技", "--role", "后端工程师", "--record"])
    expect(recorded.exitCode).toBe(1)
    expect(JSON.parse(recorded.stderr).code).toBe("CONFIRM_NEEDS_TTY")
  })

  test("parser source does not fetch", () => {
    const source = readFileSync(new URL("../src/parse.ts", import.meta.url), "utf8")
    expect(source.includes("fetch(")).toBe(false)
    expect(source.includes("launchPersistentContext")).toBe(false)
  })
})
