import { loginInteractive, openJobPage } from "./browser.js"
import { collectDetail, collectSearch } from "./collect.js"
import { confirmAccepted, renderConfirm } from "./confirm.js"
import { assertNoSend, draftGreeting } from "./greet.js"
import { upsertDraft } from "./tracker.js"
import { PortalError, type DetailCommandOpts, type PortalAdapter, type SearchCommandOpts } from "./types.js"
import { writeError } from "./output.js"

interface Flags {
  _: string[]
  [key: string]: string | boolean | string[]
}

const ALIAS: Record<string, string> = {
  q: "query",
  l: "location",
  n: "limit",
  h: "help",
}

function parseFlags(argv: string[]): Flags {
  const flags: Flags = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg.startsWith("--") || (arg.startsWith("-") && arg !== "-")) {
      const key = ALIAS[arg.replace(/^-+/, "")] ?? arg.replace(/^-+/, "")
      const next = argv[i + 1]
      if (next === undefined || next.startsWith("-")) flags[key] = true
      else {
        flags[key] = next
        i++
      }
    } else {
      ;(flags._ as string[]).push(arg)
    }
  }
  return flags
}

function flagString(flags: Flags, key: string): string | undefined {
  const value = flags[key]
  return typeof value === "string" ? value : undefined
}

function flagBool(flags: Flags, key: string): boolean {
  return flags[key] === true || flags[key] === "true"
}

function formatOf(flags: Flags): "json" | "table" | "plain" {
  const format = flagString(flags, "format") ?? "json"
  if (format !== "json" && format !== "table" && format !== "plain") {
    throw new PortalError(`unknown format ${format}`, "INVALID_FORMAT")
  }
  return format
}

function optionalInt(flags: Flags, key: string): number | undefined {
  const raw = flagString(flags, key)
  if (raw === undefined) return undefined
  if (!/^\d+$/.test(raw)) throw new PortalError(`${key} must be an integer`, "INVALID_NUMBER")
  return parseInt(raw, 10)
}

const SEARCH_FLAGS = new Set([
  "query",
  "location",
  "salary",
  "experience",
  "jobage",
  "page",
  "limit",
  "format",
  "fixture",
  "headless",
  "help",
])
const DETAIL_FLAGS = new Set(["format", "fixture", "headless", "help"])
const LOGIN_FLAGS = new Set(["help"])
const GREET_FLAGS = new Set([
  "company",
  "role",
  "highlight",
  "name",
  "open",
  "send",
  "batch",
  "record",
  "format",
  "help",
])

function unknownFlag(command: string, flags: Flags, known: Set<string>): void {
  for (const key of Object.keys(flags)) {
    if (key === "_") continue
    if (!known.has(key)) {
      throw new PortalError(`unknown flag --${key} for ${command}`, "UNKNOWN_FLAG")
    }
  }
}

function help(adapter: PortalAdapter): string {
  return `${adapter.id}-cli — search ${adapter.displayName} with your own logged-in browser

USAGE
  search --query <关键词> [flags]
  detail <id|url> [--format json|plain]
  login
  greet --company <公司> --role <职位> [--highlight <一句经验>] [--record]
  --send and --batch are refused. --record asks for y before writing a drafted tracker row. Nothing is sent.

SEARCH FLAGS
  --query, -q <text>       Keywords. Required.
  --location, -l <text>    City name (北京) or the portal's city code.
  --salary <range>         Client-side filter, e.g. 20-40 or 20-40K. Not sent as a site code.
  --experience <text>      e.g. 3-5年, 应届, 5-10. Filtered on the parsed cards.
  --jobage <days>          Drop dated postings older than N days. Undated cards are kept.
  --page <n>               1-indexed. Hard cap 3. One page per command.
  --limit, -n <n>          Hard cap 20. Default 10.
  --fixture <file>         Parse a saved HTML or JSON file. No browser, no network.
  --format <fmt>           json (default) | table | plain.
  --headless               Hide the browser. Challenges are still not solved.

LOGIN
  Opens the site in a persistent profile and waits until you press Enter.
  You scan the QR code. The command never types credentials.

GREET
  Prints a short 打招呼 draft. --send and --batch are refused.
  --open <url> shows that one job page and stops for you to paste the draft.

Personal use only. Keep volume low. Do not bypass captchas.
`
}

export interface PortalCli {
  adapter: PortalAdapter
  runSearch(opts: SearchCommandOpts): Promise<number>
  runDetail(opts: DetailCommandOpts): Promise<number>
}

export async function runPortalCli(portal: PortalCli, argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    const flags = parseFlags(argv)
    const command = (flags._ as string[])[0]
    if (!command || command === "help" || flagBool(flags, "help") && !command) {
      process.stdout.write(help(portal.adapter))
      return 0
    }
    if (command === "search") {
      unknownFlag(command, flags, SEARCH_FLAGS)
      if (flagBool(flags, "help")) {
        process.stdout.write(help(portal.adapter))
        return 0
      }
      return await portal.runSearch({
        query: flagString(flags, "query"),
        location: flagString(flags, "location"),
        salary: flagString(flags, "salary"),
        experience: flagString(flags, "experience"),
        jobage: optionalInt(flags, "jobage"),
        page: optionalInt(flags, "page") ?? 1,
        limit: optionalInt(flags, "limit") ?? 10,
        format: formatOf(flags),
        fixture: flagString(flags, "fixture"),
        headless: flagBool(flags, "headless"),
      })
    }
    if (command === "detail") {
      unknownFlag(command, flags, DETAIL_FLAGS)
      const target = (flags._ as string[])[1]
      if (!target) throw new PortalError("detail requires a job id or URL", "MISSING_ID")
      return await portal.runDetail({
        target,
        format: formatOf(flags),
        fixture: flagString(flags, "fixture"),
        headless: flagBool(flags, "headless"),
      })
    }
    if (command === "login") {
      unknownFlag(command, flags, LOGIN_FLAGS)
      await loginInteractive(portal.adapter)
      process.stdout.write(JSON.stringify({ ok: true, profile: portal.adapter.id }, null, 2) + "\n")
      return 0
    }
    if (command === "greet") {
      unknownFlag(command, flags, GREET_FLAGS)
      assertNoSend({ send: flagBool(flags, "send"), batch: flagBool(flags, "batch") })
      const company = flagString(flags, "company") ?? ""
      const role = flagString(flags, "role") ?? ""
      const text = draftGreeting({
        name: flagString(flags, "name"),
        company,
        role,
        highlight: flagString(flags, "highlight"),
      })
      const open = flags.open
      if (open === true) throw new PortalError("--open requires one job URL", "MISSING_URL")
      const url = typeof open === "string" ? open : ""
      const summary = renderConfirm({
        portal: portal.adapter.displayName,
        jobTitle: role,
        company,
        url,
        fields: [text],
        notes: ["不会自动发送。你自己粘贴。"],
      })
      if (flagBool(flags, "record")) {
        if (!process.stdin.isTTY) {
          throw new PortalError(
            "Recording a draft needs a typed confirmation. Re-run in a terminal.",
            "CONFIRM_NEEDS_TTY",
          )
        }
        process.stdout.write(summary + "\n")
        const answer = await new Promise<string>((resolve) => {
          process.stdin.setEncoding("utf8")
          process.stdin.once("data", (chunk) => resolve(String(chunk)))
        })
        if (!confirmAccepted(answer)) {
          throw new PortalError("Draft was not recorded.", "CONFIRM_DENIED")
        }
        const recorded = upsertDraft({ company, role, portal: portal.adapter.id, url, status: "drafted" })
        process.stdout.write(JSON.stringify({ text, sent: false, recorded }, null, 2) + "\n")
        return 0
      }
      if (typeof open === "string") {
        process.stdout.write(text + "\n" + summary + "\n")
        await openJobPage(portal.adapter, open)
        return 0
      }
      if (formatOf(flags) === "json") {
        process.stdout.write(JSON.stringify({ text, sent: false, confirm: summary }, null, 2) + "\n")
      } else {
        process.stdout.write(text + "\n" + summary + "\n")
      }
      return 0
    }
    throw new PortalError(`unknown command ${command}`, "UNKNOWN_COMMAND")
  } catch (err) {
    if (err instanceof PortalError) {
      writeError(err.message, err.code)
      return 1
    }
    writeError(err instanceof Error ? err.message : String(err), "FAILED")
    return 1
  }
}

export { collectDetail, collectSearch }
