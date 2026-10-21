import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"

import { applyFilters } from "../../../_cn-browser/src/filters.js"
import { portalForHost } from "../../../_cn-browser/src/registry.js"
import type { SearchQuery } from "../../../_cn-browser/src/types.js"

import { fixture, runCLI } from "./helpers.ts"
import { liepinAdapter, liepinDate, liepinSearchPage, parseLiepinDetail, parseLiepinSearch } from "../src/parse.ts"

describe("猎聘 search JSON", () => {
  test("reads contract fields and skips a card with no id", () => {
    const jobs = parseLiepinSearch(readFileSync(fixture("search.json"), "utf8"))
    expect(jobs.map((job) => job.id)).toEqual(["1970001", "1970002"])
    expect(jobs[0].title).toBe("数据工程师")
    expect(jobs[0].company).toBe("示例数据")
    expect(jobs[0].location).toBe("上海-浦东新区")
    expect(jobs[0].date).toBe("2099-01-15")
    expect(jobs[0].url).toBe("https://www.liepin.com/job/1970001.shtml")
    expect(jobs[0].salary).toBe("25-40k·15薪")
    expect(jobs[0].experience).toBe("3-5年")
    expect(jobs[0].education).toBe("本科")
    expect(liepinDate("20261001120000")).toBe("2026-10-01")
  })

  test("drops an old dated card and a non-overlapping salary", () => {
    const jobs = parseLiepinSearch(readFileSync(fixture("search.json"), "utf8"))
    const query: SearchQuery = {
      query: "数据",
      cityName: "上海",
      salary: "20-40",
      jobage: 14,
      page: 1,
      limit: 10,
      warnings: [],
    }
    const kept = applyFilters(jobs, query, new Date("2026-10-21T00:00:00Z"))
    expect(kept.map((job) => job.id)).toEqual(["1970001"])
  })
})

describe("猎聘 HTML", () => {
  test("search card and detail salary stay on the current job", () => {
    const jobs = parseLiepinSearch(readFileSync(fixture("search.html"), "utf8"))
    expect(jobs).toHaveLength(1)
    expect(jobs[0].title).toBe("数据工程师")
    expect(jobs[0].salary).toBe("25-40k")
    expect(jobs[0].company).toBe("示例数据")
    const detail = parseLiepinDetail(
      readFileSync(fixture("detail.html"), "utf8"),
      "https://www.liepin.com/job/1970001.shtml",
    )
    expect(detail.salary).toBe("25-40k·15薪")
    expect(detail.description).toContain("数仓建模")
    expect(detail.description).not.toContain("8-10k")
    expect(detail.company).toBe("示例数据")
  })
})

describe("猎聘 hosts and pages", () => {
  test("c.liepin.com and www.liepin.com belong to this adapter", () => {
    expect(portalForHost("c.liepin.com")?.id).toBe("liepin")
    expect(portalForHost("www.liepin.com")?.id).toBe("liepin")
    expect(portalForHost("liepin.com.evil.com")).toBeUndefined()
  })

  test("page is 1-indexed on the CLI and 0-indexed on the site URL", () => {
    const query = liepinAdapter.normalizeQuery({
      query: "数据",
      location: "上海",
      page: 1,
      limit: 10,
      warnings: [],
    })
    const url = new URL(liepinSearchPage(query))
    expect(url.hostname).toBe("www.liepin.com")
    expect(url.searchParams.get("key")).toBe("数据")
    expect(url.searchParams.get("dq")).toBe("020")
    expect(url.searchParams.get("currentPage")).toBe("0")
  })
})

describe("CLI fixtures", () => {
  test("search fixture returns json and a batch greet is refused", async () => {
    const result = await runCLI([
      "search",
      "-q",
      "数据",
      "-l",
      "上海",
      "--salary",
      "20-40",
      "--jobage",
      "14",
      "--fixture",
      fixture("search.json"),
    ])
    expect(result.exitCode).toBe(0)
    const body = JSON.parse(result.stdout)
    expect(body.results).toHaveLength(1)
    expect(body.results[0].company).toBe("示例数据")
    expect(body.results[0].date).toBe("2099-01-15")
    const refused = await runCLI(["greet", "--company", "示例数据", "--role", "数据工程师", "--batch"])
    expect(refused.exitCode).toBe(1)
    expect(JSON.parse(refused.stderr).code).toBe("SEND_REFUSED")
  })

  test("detail fixture is plain text", async () => {
    const result = await runCLI([
      "detail",
      "https://www.liepin.com/job/1970001.shtml",
      "--fixture",
      fixture("detail.html"),
      "--format",
      "plain",
    ])
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain("数仓建模")
    expect(result.stdout).toContain("25-40k")
  })

  test("parser source does not fetch", () => {
    const source = readFileSync(new URL("../src/parse.ts", import.meta.url), "utf8")
    expect(source.includes("fetch(")).toBe(false)
    expect(source.includes("launchPersistentContext")).toBe(false)
  })
})
