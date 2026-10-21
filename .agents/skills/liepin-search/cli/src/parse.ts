import {
  absoluteUrl,
  asRecord,
  asString,
  joinList,
  parseJson,
  parseJsonLdJob,
  splitByClass,
  stripTags,
  textByClass,
} from "../../../_cn-browser/src/html.js"
import { registerPortal } from "../../../_cn-browser/src/registry.js"
import type { PortalAdapter, PortalJob, SearchQuery } from "../../../_cn-browser/src/types.js"

import { LIEPIN_CANDIDATE_HOME, LIEPIN_ORIGIN, LIEPIN_SEARCH_PAGE } from "./helpers.js"

/**
 * City codes cited by public write-ups of 猎聘's candidate search.
 * Unverified against a live session in this repo. Unknown names are not
 * guessed: the URL omits `dq` and cards are filtered by the city text.
 */
export const LIEPIN_CITIES: Record<string, string> = {
  北京: "010",
  上海: "020",
  天津: "030",
  重庆: "040",
  广州: "050020",
  深圳: "050090",
  杭州: "070020",
  南京: "060020",
  成都: "280020",
  武汉: "170020",
  苏州: "060080",
}

function cityNameFor(code: string): string | undefined {
  return Object.entries(LIEPIN_CITIES).find(([, value]) => value === code)?.[0]
}

export function normalizeLiepinQuery(query: SearchQuery): SearchQuery {
  const warnings = [...query.warnings]
  if (!query.location) return { ...query, warnings }
  if (/^\d+$/.test(query.location)) {
    const cityName = cityNameFor(query.location)
    if (!cityName) {
      warnings.push(`city code ${query.location} is not in the local 猎聘 map; cards are not filtered by city name`)
    }
    return { ...query, cityCode: query.location, cityName, warnings }
  }
  const cityCode = LIEPIN_CITIES[query.location]
  if (!cityCode) {
    warnings.push(
      `no 猎聘 city code for ${query.location}; the site search is not city-scoped, and cards are filtered by that name`,
    )
  }
  return { ...query, cityName: query.location, cityCode, warnings }
}

/** `YYYYMMDDHHMMSS` (猎聘 refreshTime) -> `YYYY-MM-DD`. */
export function liepinDate(value: unknown): string | null {
  const text = asString(value)
  if (!text) return null
  const compact = /^(\d{4})(\d{2})(\d{2})/.exec(text)
  if (compact) return `${compact[1]}-${compact[2]}-${compact[3]}`
  const iso = /^(\d{4}-\d{2}-\d{2})/.exec(text)
  return iso ? iso[1] : null
}

function jobIdFromLink(link: string | null, explicit: string | null): string | null {
  if (explicit) return explicit
  if (!link) return null
  const match = /\/job\/([^./?#]+)/.exec(link) ?? /[?&]jobId=([^&#]+)/.exec(link)
  return match ? match[1] : null
}

function cardToJob(card: Record<string, unknown>): PortalJob | null {
  const job = asRecord(card.job) ?? card
  const comp = asRecord(card.comp) ?? {}
  const title = asString(job.title) ?? asString(job.jobTitle)
  const link = asString(job.link)
  const id = jobIdFromLink(link, asString(job.jobId))
  if (!title || !id) return null
  const url = link ? absoluteUrl(link, LIEPIN_ORIGIN) : `${LIEPIN_ORIGIN}/job/${id}.shtml`
  return {
    id,
    title,
    company: asString(comp.compName) ?? asString(job.compName),
    location: asString(job.dq) ?? asString(job.city),
    date: liepinDate(job.refreshTime),
    url,
    salary: asString(job.salary),
    experience: asString(job.requireWorkYears),
    education: asString(job.requireEduLevel),
    requirements: joinList(
      [asString(job.requireWorkYears), asString(job.requireEduLevel)].filter((item): item is string => Boolean(item)),
    ),
    description: asString(job.jobDuty) ?? asString(job.detailDuty),
  }
}

function cardLists(root: Record<string, unknown>): unknown[] {
  const data = asRecord(root.data)
  const nested = data ? asRecord(data.data) : null
  const lists = [nested?.jobCardList, data?.jobCardList, root.jobCardList]
  for (const list of lists) {
    if (Array.isArray(list)) return list
  }
  return []
}

export function parseLiepinSearchJson(payload: string): PortalJob[] {
  const root = asRecord(parseJson(payload))
  if (!root) return []
  const jobs: PortalJob[] = []
  for (const item of cardLists(root)) {
    const record = asRecord(item)
    if (!record) continue
    const job = cardToJob(record)
    if (job) jobs.push({ ...job, description: null })
  }
  return jobs
}

export function parseLiepinSearchHtml(html: string): PortalJob[] {
  const jobs: PortalJob[] = []
  const chunks = [
    ...splitByClass(html, "job-card-pc-container"),
    ...splitByClass(html, "job-card-box"),
  ]
  for (const chunk of chunks) {
    const href = firstJobHref(chunk)
    const title = textByClass(chunk, "job-title-box") ?? textByClass(chunk, "ellipsis-1") ?? anchorTitle(chunk)
    if (!title || !href) continue
    const url = absoluteUrl(href, LIEPIN_ORIGIN)
    const id = jobIdFromLink(url, null)
    if (!id) continue
    jobs.push({
      id,
      title,
      company: textByClass(chunk, "company-name"),
      location: textByClass(chunk, "job-dq-box") ?? textByClass(chunk, "dq"),
      date: null,
      url,
      salary: textByClass(chunk, "job-salary"),
      experience: textByClass(chunk, "job-exp"),
      education: textByClass(chunk, "job-edu"),
      requirements: null,
      description: null,
    })
  }
  return jobs
}

function firstJobHref(chunk: string): string | null {
  const match = chunk.match(/href\s*=\s*"([^"]*\/job\/[^"]+)"/i)
  return match ? match[1] : null
}

function anchorTitle(chunk: string): string | null {
  const match = chunk.match(/<a[^>]*href="[^"]*\/job\/[^"]*"[^>]*>([\s\S]*?)<\/a>/i)
  if (!match) return null
  const text = stripTags(match[1])
  return text || null
}

export function parseLiepinSearch(payload: string): PortalJob[] {
  const trimmed = payload.trim()
  if (!trimmed) return []
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return parseLiepinSearchJson(trimmed)
  return parseLiepinSearchHtml(trimmed)
}

export function parseLiepinDetail(payload: string, pageUrl: string): PortalJob {
  const trimmed = payload.trim()
  if (trimmed.startsWith("{")) {
    const root = asRecord(parseJson(trimmed))
    const data = root ? asRecord(root.data) ?? root : null
    const card = data ? cardToJob(data) : null
    if (card && (card.description || card.title)) {
      return {
        ...card,
        url: pageUrl.startsWith("http") ? pageUrl : card.url,
        description: card.description ? stripTags(card.description) : null,
      }
    }
  }
  const ld = parseJsonLdJob(trimmed)
  const ldOrg = ld ? asRecord(ld.hiringOrganization) : null
  const duty =
    textByClass(trimmed, "job-intro-content") ??
    textByClass(trimmed, "job-description") ??
    textByClass(trimmed, "paragraph")
  const id = jobIdFromLink(pageUrl, null) ?? "unknown"
  return {
    id,
    title: textByClass(trimmed, "job-title") ?? textByClass(trimmed, "name") ?? asString(ld?.title) ?? "职位",
    company: textByClass(trimmed, "company-name") ?? asString(ldOrg?.name),
    location: textByClass(trimmed, "job-dq") ?? null,
    date: null,
    url: pageUrl,
    salary: textByClass(trimmed, "salary"),
    experience: textByClass(trimmed, "job-exp"),
    education: textByClass(trimmed, "job-edu"),
    requirements: null,
    description: duty ?? (ld ? stripTags(asString(ld.description) ?? "") || null : null),
  }
}

export function liepinJobUrl(target: string): string {
  if (target.startsWith("http://") || target.startsWith("https://")) return target
  return `${LIEPIN_ORIGIN}/job/${target}.shtml`
}

export function liepinSearchPage(query: SearchQuery): string {
  const params = new URLSearchParams()
  params.set("key", query.query)
  if (query.cityCode) {
    params.set("city", query.cityCode)
    params.set("dq", query.cityCode)
  }
  // The portal flag is 1-indexed. 猎聘's currentPage is 0-indexed.
  params.set("currentPage", String(Math.max(query.page - 1, 0)))
  return `${LIEPIN_SEARCH_PAGE}?${params.toString()}`
}

export const liepinAdapter: PortalAdapter = {
  id: "liepin",
  displayName: "猎聘",
  refusesSubmit: true,
  hosts: ["liepin.com", "c.liepin.com"],
  challengeMarkers: ["验证码", "安全验证", "滑动验证", "访问过于频繁", "请完成验证"],
  responseUrlHints: ["pc-search-job", "com.liepin.search", "searchfront4c"],
  homeUrl: LIEPIN_CANDIDATE_HOME,
  searchPageUrl: liepinSearchPage,
  normalizeQuery: normalizeLiepinQuery,
  parseSearch: parseLiepinSearch,
  parseDetail: parseLiepinDetail,
}

registerPortal(liepinAdapter)
