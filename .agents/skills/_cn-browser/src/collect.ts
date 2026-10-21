import { captureDetail, captureSearch } from "./browser.js"
import { applyFilters } from "./filters.js"
import { assertLimit, assertPage } from "./limits.js"
import { readFixture } from "./paths.js"
import {
  PortalError,
  type DetailCommandOpts,
  type PortalAdapter,
  type PortalJob,
  type SearchCommandOpts,
  type SearchQuery,
} from "./types.js"

export function toQuery(adapter: PortalAdapter, opts: SearchCommandOpts): SearchQuery {
  if (!opts.query || !opts.query.trim()) {
    throw new PortalError("search requires --query", "MISSING_QUERY")
  }
  assertLimit(opts.limit)
  assertPage(opts.page)
  const base: SearchQuery = {
    query: opts.query.trim(),
    location: opts.location?.trim() || undefined,
    salary: opts.salary?.trim() || undefined,
    experience: opts.experience?.trim() || undefined,
    jobage: opts.jobage,
    page: opts.page,
    limit: opts.limit,
    warnings: [],
  }
  return adapter.normalizeQuery(base)
}

export async function collectSearch(adapter: PortalAdapter, opts: SearchCommandOpts): Promise<{ jobs: PortalJob[]; query: SearchQuery }> {
  const query = toQuery(adapter, opts)
  const payload = opts.fixture
    ? readFixture(opts.fixture)
    : await captureSearch(adapter, query, { headless: opts.headless }, (body) => adapter.parseSearch(body).length)
  const jobs = applyFilters(adapter.parseSearch(payload), query).slice(0, query.limit)
  return { jobs, query }
}

export async function collectDetail(adapter: PortalAdapter, opts: DetailCommandOpts): Promise<PortalJob> {
  if (!opts.target.trim()) throw new PortalError("detail requires a job id or URL", "MISSING_ID")
  const pageUrl = opts.target.startsWith("http") ? opts.target : opts.target
  const payload = opts.fixture
    ? readFixture(opts.fixture)
    : await captureDetail(
        adapter,
        pageUrl.startsWith("http") ? pageUrl : opts.target,
        { headless: opts.headless },
        (body) => {
          try {
            const job = adapter.parseDetail(body, pageUrl)
            return job.description || job.title ? 1 : 0
          } catch {
            return 0
          }
        },
      )
  return adapter.parseDetail(payload, pageUrl.startsWith("http") ? pageUrl : payloadUrlFallback(adapter, opts.target))
}

function payloadUrlFallback(adapter: PortalAdapter, target: string): string {
  if (target.startsWith("http")) return target
  return `${adapter.homeUrl.replace(/\/$/, "")}/${target}`
}
