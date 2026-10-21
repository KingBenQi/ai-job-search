import { existsSync, readFileSync } from "node:fs"
import { dirname, isAbsolute, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { PortalError } from "./types.js"

/** Repo root: `.agents/skills/_cn-browser/src` is four levels down. */
export function repoRoot(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), "../../../..")
}

export function profileDir(portalId: string): string {
  const override = process.env.CN_PORTALS_PROFILE_DIR
  const root = override && override.trim() ? resolve(override.trim()) : join(repoRoot(), ".browser-profiles")
  return join(root, portalId)
}

export function loginMarkerPath(portalId: string): string {
  return join(profileDir(portalId), ".login-complete")
}

export function hasLoginMarker(portalId: string): boolean {
  return existsSync(loginMarkerPath(portalId))
}

export function readFixture(path: string): string {
  if (/^https?:/i.test(path)) {
    throw new PortalError("--fixture must be a local file. It never fetches a URL.", "FIXTURE_NOT_FOUND")
  }
  const file = isAbsolute(path) ? path : resolve(path)
  if (!existsSync(file)) throw new PortalError(`fixture not found: ${path}`, "FIXTURE_NOT_FOUND")
  return readFileSync(file, "utf8")
}

export function playwrightModulePath(): string {
  const fromEnv = process.env.CN_PORTALS_PLAYWRIGHT?.trim()
  if (fromEnv) {
    if (!fromEnv.includes("playwright")) {
      throw new PortalError(
        "CN_PORTALS_PLAYWRIGHT must point at a playwright package path.",
        "MISSING_BROWSER",
      )
    }
    return fromEnv
  }
  return join(repoRoot(), ".browser-deps", "node_modules", "playwright", "index.js")
}
