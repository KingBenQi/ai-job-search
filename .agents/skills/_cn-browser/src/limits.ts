import { PortalError } from "./types.js"

/** One search opens one page and returns at most this many jobs. */
export const MAX_LIMIT = 20
export const DEFAULT_LIMIT = 10
/** `--page` is 1-indexed. Page 4+ is refused so a loop cannot walk the site. */
export const MAX_PAGE = 3
/** Polite gap before each navigation. Not a retry budget. */
export const MIN_DELAY_MS = 2500
export const MAX_DELAY_MS = 7000

export const LOGIN_MARKERS = ["扫码登录", "请登录", "登录后查看", "请先登录", "登录/注册"]

/** Visible copy that means the browser is past the login wall. */
export const LOGGED_IN_MARKERS = ["退出登录", "退出", "我的简历", "个人中心", "我的猎聘"]

/**
 * Enter alone is not a login. The marker is written only when the page shows
 * a logged-in session and is not sitting on a captcha or a login wall.
 */
export function sessionLooksLoggedIn(
  text: string,
  challengeMarkers: string[],
): "ok" | "CHALLENGE_REQUIRED" | "LOGIN_REQUIRED" {
  if (challengeMarkers.some((marker) => marker && text.includes(marker))) return "CHALLENGE_REQUIRED"
  const loginWall = LOGIN_MARKERS.some((marker) => text.includes(marker))
  const signedIn = LOGGED_IN_MARKERS.some((marker) => text.includes(marker))
  if (signedIn && !loginWall) return "ok"
  return "LOGIN_REQUIRED"
}

export function assertLimit(limit: number): number {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new PortalError("limit must be a positive integer", "INVALID_LIMIT")
  }
  if (limit > MAX_LIMIT) {
    throw new PortalError(
      `limit ${limit} exceeds the hard cap of ${MAX_LIMIT}. This tool will not page through a board in bulk.`,
      "LIMIT_EXCEEDED",
    )
  }
  return limit
}

export function assertPage(page: number): number {
  if (!Number.isInteger(page) || page < 1) {
    throw new PortalError("page must be an integer >= 1", "INVALID_PAGE")
  }
  if (page > MAX_PAGE) {
    throw new PortalError(
      `page ${page} exceeds the hard cap of ${MAX_PAGE}. Fetch one page per command.`,
      "PAGE_EXCEEDED",
    )
  }
  return page
}

export function delayMs(random: () => number = Math.random): number {
  const span = MAX_DELAY_MS - MIN_DELAY_MS
  return MIN_DELAY_MS + Math.floor(random() * (span + 1))
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Decide why a live page produced no jobs. A captcha is never retried and
 * never solved here. `NO_RESULTS` is a normal empty search.
 */
export function classifyEmpty(
  payload: string,
  challengeMarkers: string[],
): "CHALLENGE_REQUIRED" | "LOGIN_REQUIRED" | "NO_RESULTS" {
  for (const marker of challengeMarkers) {
    if (marker && payload.includes(marker)) return "CHALLENGE_REQUIRED"
  }
  for (const marker of LOGIN_MARKERS) {
    if (payload.includes(marker)) return "LOGIN_REQUIRED"
  }
  return "NO_RESULTS"
}

export function emptyMessage(code: "CHALLENGE_REQUIRED" | "LOGIN_REQUIRED"): string {
  if (code === "CHALLENGE_REQUIRED") {
    return "The site is showing a verification challenge. Solve it yourself in the browser window if one is open. This tool does not bypass captchas and will not retry."
  }
  return "The site is asking for a login. Run the login command in your own terminal and scan the QR code. This tool does not store or type credentials."
}
