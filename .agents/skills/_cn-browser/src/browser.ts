import { mkdirSync, writeFileSync } from "node:fs"
import { pathToFileURL } from "node:url"

import { classifyEmpty, delayMs, emptyMessage, sessionLooksLoggedIn, sleep } from "./limits.js"
import { hasLoginMarker, loginMarkerPath, playwrightModulePath, profileDir } from "./paths.js"
import { PortalError, type PortalAdapter, type SearchQuery } from "./types.js"

interface PwResponse {
  url(): string
  text(): Promise<string>
}

interface PwPage {
  goto(url: string, options?: { waitUntil?: string; timeout?: number }): Promise<unknown>
  content(): Promise<string>
  on(event: "response", handler: (response: PwResponse) => void): void
  waitForResponse(
    predicate: (response: PwResponse) => boolean | Promise<boolean>,
    options?: { timeout?: number },
  ): Promise<PwResponse>
}

interface PwContext {
  newPage(): Promise<PwPage>
  close(): Promise<void>
}

interface PwModule {
  chromium: {
    launchPersistentContext(userDataDir: string, options: Record<string, unknown>): Promise<PwContext>
  }
}

async function loadPlaywright(): Promise<PwModule> {
  const spec = playwrightModulePath()
  const href = spec.startsWith("file:") ? spec : pathToFileURL(spec).href
  try {
    return (await import(href)) as PwModule
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    throw new PortalError(
      `Playwright is not installed (${reason}). From the repo root run: python3 tools/install_cn_browser.py — then log in with the portal's login command. Browser binaries stay in the gitignored .browser-deps directory.`,
      "MISSING_BROWSER",
    )
  }
}

export interface BrowseOpts {
  headless: boolean
  /** Skip the polite delay. Tests never call this; live commands leave it unset. */
  delay?: () => number
}

async function openContext(portalId: string, headless: boolean): Promise<PwContext> {
  const dir = profileDir(portalId)
  mkdirSync(dir, { recursive: true })
  const playwright = await loadPlaywright()
  return playwright.chromium.launchPersistentContext(dir, {
    headless,
    locale: "zh-CN",
    viewport: { width: 1366, height: 900 },
    acceptDownloads: false,
  })
}

/**
 * Read the HTML snapshot and every hinted XHR body.
 * `response.text()` is awaited. A fixed sleep is not the synchronization.
 */
export async function readPagePayloads(page: PwPage, url: string, hints: string[], delay: () => number): Promise<string[]> {
  const reads: Promise<string | null>[] = []
  const matches = (response: PwResponse) => hints.some((hint) => response.url().includes(hint))
  page.on("response", (response) => {
    if (!matches(response)) return
    reads.push(
      response.text().then(
        (body) => (body ? body : null),
        () => null,
      ),
    )
  })
  await sleep(delay())
  const navigation = page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 })
  const firstMatch = page.waitForResponse((response) => matches(response), { timeout: 15000 }).then(
    () => true,
    () => false,
  )
  await navigation
  await firstMatch
  const bodies: string[] = []
  let spins = 0
  while (reads.length > 0 && spins < 20) {
    const batch = reads.splice(0, reads.length)
    for (const body of await Promise.all(batch)) {
      if (body) bodies.push(body)
    }
    spins++
  }
  const html = await page.content()
  return [html, ...bodies]
}

function assertHuman(payloads: string[], adapter: PortalAdapter, parsedCount: (payload: string) => number): string {
  let best = payloads[0] ?? ""
  let bestCount = 0
  for (const payload of payloads) {
    let count = 0
    try {
      count = parsedCount(payload)
    } catch {
      count = 0
    }
    if (count > bestCount) {
      best = payload
      bestCount = count
    }
  }
  if (bestCount > 0) return best
  const code = classifyEmpty(payloads.join("\n"), adapter.challengeMarkers)
  if (code !== "NO_RESULTS") throw new PortalError(emptyMessage(code), code)
  return best
}

function requireSession(portalId: string): void {
  if (!hasLoginMarker(portalId)) {
    throw new PortalError(
      `No saved login for ${portalId}. In your own terminal run the login command and scan the QR code once. The session stays in ${profileDir(portalId)}, which is gitignored.`,
      "MISSING_SESSION",
    )
  }
}

export async function loginInteractive(adapter: PortalAdapter): Promise<void> {
  if (!process.stdin.isTTY) {
    throw new PortalError(
      "login must be run in an interactive terminal so you can scan the QR code yourself. An agent session must not complete the login.",
      "LOGIN_NEEDS_TTY",
    )
  }
  const context = await openContext(adapter.id, false)
  try {
    const page = await context.newPage()
    process.stdout.write(
      `A browser window is opening ${adapter.homeUrl}.\nScan the QR code or sign in yourself. This command never types a password and never solves a captcha.\nPress Enter here after the page shows you are logged in (退出 or 我的简历). Enter alone does not save a session.\n`,
    )
    await page.goto(adapter.homeUrl, { waitUntil: "domcontentloaded", timeout: 45000 })
    await new Promise<void>((resolve) => {
      process.stdin.setEncoding("utf8")
      process.stdin.once("data", () => resolve())
    })
    const verdict = sessionLooksLoggedIn(await page.content(), adapter.challengeMarkers)
    if (verdict !== "ok") {
      throw new PortalError(emptyMessage(verdict), verdict)
    }
    mkdirSync(profileDir(adapter.id), { recursive: true })
    writeFileSync(loginMarkerPath(adapter.id), `${new Date().toISOString()}\n`, "utf8")
  } finally {
    await context.close()
  }
}

export async function captureSearch(
  adapter: PortalAdapter,
  query: SearchQuery,
  opts: BrowseOpts,
  parsedCount: (payload: string) => number,
): Promise<string> {
  requireSession(adapter.id)
  const context = await openContext(adapter.id, opts.headless)
  try {
    const page = await context.newPage()
    const payloads = await readPagePayloads(page, adapter.searchPageUrl(query), adapter.responseUrlHints, opts.delay ?? delayMs)
    return assertHuman(payloads, adapter, parsedCount)
  } finally {
    await context.close()
  }
}

export async function captureDetail(
  adapter: PortalAdapter,
  url: string,
  opts: BrowseOpts,
  parsedCount: (payload: string) => number,
): Promise<string> {
  requireSession(adapter.id)
  const context = await openContext(adapter.id, opts.headless)
  try {
    const page = await context.newPage()
    const payloads = await readPagePayloads(page, url, adapter.responseUrlHints, opts.delay ?? delayMs)
    return assertHuman(payloads, adapter, parsedCount)
  } finally {
    await context.close()
  }
}

export async function openJobPage(adapter: PortalAdapter, url: string): Promise<void> {
  requireSession(adapter.id)
  const context = await openContext(adapter.id, false)
  try {
    const page = await context.newPage()
    await sleep(delayMs())
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 })
    process.stdout.write(
      "The job page is open. Paste the draft yourself. This window will close when you press Enter. Nothing is sent.\n",
    )
    if (!process.stdin.isTTY) {
      throw new PortalError(
        "Refusing to leave a job page open from a non-interactive session. Paste the draft yourself.",
        "LOGIN_NEEDS_TTY",
      )
    }
    await new Promise<void>((resolve) => {
      process.stdin.setEncoding("utf8")
      process.stdin.once("data", () => resolve())
    })
  } finally {
    await context.close()
  }
}
