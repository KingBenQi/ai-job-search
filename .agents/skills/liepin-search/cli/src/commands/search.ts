import { collectSearch } from "../../../../_cn-browser/src/collect.js"
import { writeSearch } from "../../../../_cn-browser/src/output.js"
import type { SearchCommandOpts } from "../../../../_cn-browser/src/types.js"

import { toSearchHit } from "../helpers.js"
import { liepinAdapter } from "../parse.js"

export async function runSearch(opts: SearchCommandOpts): Promise<number> {
  const { jobs, query } = await collectSearch(liepinAdapter, opts)
  const results = jobs.map((job) => toSearchHit(job))
  writeSearch(results, opts.format, opts.page, query.warnings)
  return 0
}
