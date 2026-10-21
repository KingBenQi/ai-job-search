#!/usr/bin/env bun
// 猎聘 search via the user's own logged-in browser. Parsers are pure and
// tested on fixtures. The live path never solves a captcha and never sends
// 打招呼 or 投递.

import { runPortalCli } from "../../../_cn-browser/src/cli.js"

import { runDetail } from "./commands/detail.js"
import { runSearch } from "./commands/search.js"
import { liepinAdapter } from "./parse.js"

const code = await runPortalCli({ adapter: liepinAdapter, runSearch, runDetail })
process.exit(code)
