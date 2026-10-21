// Shared types for login-walled job boards. A new board (前程无忧, 拉勾, …)
// implements PortalAdapter and registers it. Parsers stay pure: no network.

export interface PortalJob {
  id: string
  title: string
  company: string | null
  location: string | null
  date: string | null
  url: string
  salary: string | null
  experience: string | null
  education: string | null
  requirements: string | null
  description: string | null
}

export interface SearchQuery {
  query: string
  /** City name or portal code, as the user typed it. */
  location?: string
  /** Resolved city name used for the client-side location check. */
  cityName?: string
  /** Resolved portal city code, when the map knows one. */
  cityCode?: string
  salary?: string
  experience?: string
  /** Drop postings whose `date` is older than this many days. Null dates stay. */
  jobage?: number
  /** 1-indexed, matching the portal-skill contract. */
  page: number
  limit: number
  warnings: string[]
}

export interface SearchCommandOpts {
  query?: string
  location?: string
  salary?: string
  experience?: string
  jobage?: number
  page: number
  limit: number
  format: "json" | "table" | "plain"
  fixture?: string
  headless: boolean
}

export interface DetailCommandOpts {
  target: string
  format: "json" | "table" | "plain"
  fixture?: string
  headless: boolean
}

export interface PortalAdapter {
  id: string
  displayName: string
  /**
   * These boards are read-only. The adapter has no submit method.
   * Boss直聘's read-only boundary is the same one offer-harvester documents
   * for its BossAdapter; 猎聘 is held to that boundary too.
   */
  refusesSubmit: true
  /** Hostnames this adapter owns, without a leading www. */
  hosts: string[]
  /** Page or JSON text that means "stop, the site wants a human". */
  challengeMarkers: string[]
  /** Substrings matched against XHR response URLs captured in the browser. */
  responseUrlHints: string[]
  /** Page opened by `login`. */
  homeUrl: string
  searchPageUrl(query: SearchQuery): string
  normalizeQuery(query: SearchQuery): SearchQuery
  parseSearch(payload: string): PortalJob[]
  parseDetail(payload: string, pageUrl: string): PortalJob
}

export class PortalError extends Error {
  code: string
  constructor(message: string, code: string) {
    super(message)
    this.name = "PortalError"
    this.code = code
  }
}
