import { collectDetail } from "../../../../_cn-browser/src/collect.js"
import { writeDetail } from "../../../../_cn-browser/src/output.js"
import type { DetailCommandOpts } from "../../../../_cn-browser/src/types.js"

import { liepinAdapter, liepinJobUrl } from "../parse.js"

export async function runDetail(opts: DetailCommandOpts): Promise<number> {
  const target = liepinJobUrl(opts.target)
  const job = await collectDetail(liepinAdapter, { ...opts, target })
  writeDetail(job, opts.format)
  return 0
}
