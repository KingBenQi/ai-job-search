import { absoluteUrl, asRecord, asString, asStringList, joinList, parseJson, parseJsonLdJob, splitByClass, stripTags, textByClass } from "../../../_cn-browser/src/html.js"
import { registerPortal } from "../../../_cn-browser/src/registry.js"
import type { PortalAdapter, PortalJob, SearchQuery } from "../../../_cn-browser/src/types.js"

import { ZHIPIN_JOB_URL, ZHIPIN_ORIGIN, ZHIPIN_SEARCH_PAGE } from "./helpers.js"

/**
 * City codes cited by public write-ups of Boss直聘's web app.
 * They are unverified against a live session in this repo. An unknown city
 * name is not guessed: the URL omits `city` and cards are filtered by name.
 */
export const ZHIPIN_CITIES: Record<string, string> = {
  北京: "101010100",
  上海: "101020100",
  广州: "101280100",
  深圳: "101280600",
  杭州: "101210100",
  成都: "101270100",
  南京: "101190100",
  武汉: "101200100",
  西安: "101110100",
  苏州: "101190400",
  全国: "100010000",
}

/**
 * Experience codes from the same public write-ups. Unverified live.
 * Unknown labels are not sent to the site; the client-side filter still runs.
 */
export function zhipinExperienceCode(text: string | undefined): string | undefined {
  if (!text) return undefined
  const raw = text.replace(/\s+/g, "")
  if (/^\d{3}$/.test(raw)) return raw
  const table: Array<[RegExp, string]> = [
    [/在校|实习/, "101"],
    [/应届/, "102"],
    [/1年以内|一年以内/, "103"],
    [/1[-~到至]3/, "104"],
    [/3[-~到至]5/, "105"],
    [/5[-~到至]10/, "106"],
    [/10年以上|十年以上/, "107"],
  ]
  for (const [pattern, code] of table) {
    if (pattern.test(raw)) return code
  }
  return undefined
}

function cityNameFor(code: string): string | undefined {
  return Object.entries(ZHIPIN_CITIES).find(([, value]) => value === code)?.[0]
}

export function normalizeZhipinQuery(query: SearchQuery): SearchQuery {
  const warnings = [...query.warnings]
  if (!query.location || query.location === "全国") {
    return {
      ...query,
      cityName: query.location === "全国" ? "全国" : undefined,
      cityCode: query.location === "全国" ? ZHIPIN_CITIES["全国"] : undefined,
      warnings,
    }
  }
  if (/^\d+$/.test(query.location)) {
    const cityName = cityNameFor(query.location)
    if (!cityName) {
      warnings.push(
        `city code ${query.location} is not in the local Boss直聘 map; cards are not filtered by city name`,
      )
    }
    return { ...query, cityCode: query.location, cityName, warnings }
  }
  const cityCode = ZHIPIN_CITIES[query.location]
  if (!cityCode) {
    warnings.push(
      `no Boss直聘 city code for ${query.location}; the site search is not city-scoped, and cards are filtered by that name`,
    )
  }
  return { ...query, cityName: query.location, cityCode, warnings }
}

function locationOf(city: string | null, area: string | null, business: string | null): string | null {
  const parts = [city, area, business].filter((part): part is string => Boolean(part))
  return parts.length ? parts.join("·") : null
}

function zhipinDate(record: Record<string, unknown>): string | null {
  for (const key of ["showDate", "updateDate"]) {
    const value = asString(record[key])
    const match = value ? /^(\d{4}-\d{2}-\d{2})/.exec(value) : null
    if (match) return match[1]
  }
  return null
}

function jobFromRecord(record: Record<string, unknown>): PortalJob | null {
  const title = asString(record.jobName) ?? asString(record.title)
  const id = asString(record.encryptJobId) ?? asString(record.encryptId) ?? asString(record.jobId)
  if (!title || !id) return null
  const skills = asStringList(record.skills)
  return {
    id,
    title,
    company: asString(record.brandName) ?? asString(record.companyName),
    location: locationOf(asString(record.cityName), asString(record.areaDistrict), asString(record.businessDistrict)),
    date: zhipinDate(record),
    url: `${ZHIPIN_JOB_URL}${id}.html`,
    salary: asString(record.salaryDesc),
    experience: asString(record.jobExperience) ?? asString(record.experienceName),
    education: asString(record.jobDegree) ?? asString(record.degreeName),
    requirements: joinList(skills),
    description: asString(record.postDescription) ?? asString(record.jobDesc) ?? asString(record.description),
  }
}

function jobLists(root: Record<string, unknown>): unknown[] {
  const zp = asRecord(root.zpData)
  const data = asRecord(root.data)
  const lists = [zp?.jobList, data?.jobList, root.jobList]
  for (const list of lists) {
    if (Array.isArray(list)) return list
  }
  return []
}

export function parseZhipinSearchJson(payload: string): PortalJob[] {
  const root = asRecord(parseJson(payload))
  if (!root) return []
  const jobs: PortalJob[] = []
  for (const item of jobLists(root)) {
    const record = asRecord(item)
    if (!record) continue
    const job = jobFromRecord(record)
    if (job) jobs.push({ ...job, description: null })
  }
  return jobs
}

export function parseZhipinSearchHtml(html: string): PortalJob[] {
  const jobs: PortalJob[] = []
  for (const chunk of splitByClass(html, "job-card-wrapper")) {
    const title = textByClass(chunk, "job-name")
    const href = firstJobHref(chunk)
    if (!title || !href) continue
    const url = absoluteUrl(href, ZHIPIN_ORIGIN)
    const id = jobIdFromUrl(url) ?? href
    jobs.push({
      id,
      title,
      company: textByClass(chunk, "company-name"),
      location: textByClass(chunk, "job-area"),
      date: null,
      url,
      salary: textByClass(chunk, "salary"),
      experience: textByClass(chunk, "job-limit") ?? textByClass(chunk, "job-info"),
      education: null,
      requirements: textByClass(chunk, "tag-list")?.replace(/\s*\n\s*/g, ", ") ?? null,
      description: null,
    })
  }
  return jobs
}

function firstJobHref(chunk: string): string | null {
  const match = chunk.match(/href\s*=\s*"([^"]*job_detail[^"]*)"/i)
  return match ? match[1] : null
}

export function jobIdFromUrl(url: string): string | null {
  const match = /job_detail\/([^./?#]+)/.exec(url)
  return match ? match[1] : null
}

export function parseZhipinSearch(payload: string): PortalJob[] {
  const trimmed = payload.trim()
  if (!trimmed) return []
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return parseZhipinSearchJson(trimmed)
  return parseZhipinSearchHtml(trimmed)
}

function detailFromJson(root: Record<string, unknown>, pageUrl: string): PortalJob | null {
  const zp = asRecord(root.zpData) ?? asRecord(root.data) ?? root
  const info = asRecord(zp.jobInfo) ?? asRecord(zp.jobDetail) ?? asRecord(zp.job)
  if (!info) return null
  const brand = asRecord(zp.brandComInfo) ?? asRecord(zp.brand) ?? {}
  const job = jobFromRecord({ ...info, brandName: asString(info.brandName) ?? asString(brand.brandName) })
  if (!job) return null
  const description = job.description ? stripTags(job.description) : null
  return {
    ...job,
    url: pageUrl.startsWith("http") ? pageUrl : job.url,
    description,
    company: job.company ?? asString(brand.brandName),
  }
}

export function parseZhipinDetail(payload: string, pageUrl: string): PortalJob {
  const trimmed = payload.trim()
  if (trimmed.startsWith("{")) {
    const root = asRecord(parseJson(trimmed))
    const fromJson = root ? detailFromJson(root, pageUrl) : null
    if (fromJson && (fromJson.description || fromJson.title)) return fromJson
  }
  const title = textByClass(trimmed, "job-name") ?? textByClass(trimmed, "name")
  const descriptionHtml = innerDescription(trimmed)
  const ld = parseJsonLdJob(trimmed)
  const ldOrg = ld ? asRecord(ld.hiringOrganization) : null
  const id = jobIdFromUrl(pageUrl) ?? "unknown"
  return {
    id,
    title: title ?? asString(ld?.title) ?? asString(ld?.name) ?? "职位",
    company: textByClass(trimmed, "company-name") ?? asString(ldOrg?.name),
    location: textByClass(trimmed, "job-area") ?? asString(ld?.jobLocation),
    date: null,
    url: pageUrl,
    salary: textByClass(trimmed, "salary"),
    experience: textByClass(trimmed, "job-limit"),
    education: null,
    requirements: textByClass(trimmed, "job-tags"),
    description: descriptionHtml ? stripTags(descriptionHtml) : ld ? stripTags(asString(ld.description) ?? "") || null : null,
  }
}

function innerDescription(html: string): string | null {
  return textByClass(html, "job-sec-text") ?? textByClass(html, "job-detail-section")
}

export function zhipinJobUrl(target: string): string {
  if (target.startsWith("http://") || target.startsWith("https://")) return target
  return `${ZHIPIN_JOB_URL}${target}.html`
}

export function zhipinSearchPage(query: SearchQuery): string {
  const params = new URLSearchParams()
  params.set("query", query.query)
  if (query.cityCode) params.set("city", query.cityCode)
  const experience = zhipinExperienceCode(query.experience)
  if (experience) params.set("experience", experience)
  if (query.page > 1) params.set("page", String(query.page))
  return `${ZHIPIN_SEARCH_PAGE}?${params.toString()}`
}

export const zhipinAdapter: PortalAdapter = {
  id: "zhipin",
  displayName: "Boss直聘",
  refusesSubmit: true,
  hosts: ["zhipin.com"],
  challengeMarkers: ["验证码", "安全验证", "滑动验证", "访问过于频繁", "请完成验证"],
  responseUrlHints: ["joblist.json", "zpgeek/search", "job/detail.json"],
  homeUrl: `${ZHIPIN_ORIGIN}/`,
  searchPageUrl: zhipinSearchPage,
  normalizeQuery: normalizeZhipinQuery,
  parseSearch: parseZhipinSearch,
  parseDetail: parseZhipinDetail,
}

registerPortal(zhipinAdapter)
