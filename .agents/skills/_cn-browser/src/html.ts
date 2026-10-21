function codePoint(cp: number): string {
  return cp >= 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : ""
}

export function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, dec) => codePoint(parseInt(dec, 10)))
    .replace(/&#[xX]([0-9a-fA-F]+);/g, (_, hex) => codePoint(parseInt(hex, 16)))
}

export function stripTags(html: string): string {
  const text = decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|h\d|tr)>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
  return text
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim()
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/** Exact class token. `salary` must not match `job-salary` (the hyphen is a word boundary). */
export function hasClass(tag: string, className: string): boolean {
  const match = /class\s*=\s*"([^"]*)"/i.exec(tag) ?? /class\s*=\s*'([^']*)'/i.exec(tag)
  if (!match) return false
  return match[1].split(/\s+/).includes(className)
}

const OPEN_TAG = /<([a-zA-Z][\w:-]*)(\s[^<>]*?)?>/g

/** Chunks that start at each element carrying `className`. One bad chunk cannot drop the rest. */
export function splitByClass(html: string, className: string): string[] {
  const starts: number[] = []
  for (let match = OPEN_TAG.exec(html); match; match = OPEN_TAG.exec(html)) {
    if (hasClass(match[0], className)) starts.push(match.index)
  }
  OPEN_TAG.lastIndex = 0
  return starts.map((start, index) => html.slice(start, starts[index + 1] ?? html.length))
}

export function innerByClass(html: string, className: string): string | null {
  let open: RegExpExecArray | null = null
  for (let match = OPEN_TAG.exec(html); match; match = OPEN_TAG.exec(html)) {
    if (hasClass(match[0], className)) {
      open = match
      break
    }
  }
  OPEN_TAG.lastIndex = 0
  if (!open) return null
  const tag = open[1].toLowerCase()
  const start = open.index + open[0].length
  const token = new RegExp(`<\\/?${escapeRegExp(tag)}\\b[^>]*>`, "gi")
  token.lastIndex = start
  let depth = 1
  for (let match = token.exec(html); match; match = token.exec(html)) {
    if (match[0].startsWith("</")) depth -= 1
    else depth += 1
    if (depth === 0) return html.slice(start, match.index)
  }
  return null
}

export function textByClass(html: string, className: string): string | null {
  const inner = innerByClass(html, className)
  if (inner == null) return null
  const text = stripTags(inner)
  return text || null
}

export function firstHref(html: string): string | null {
  const match = html.match(/href\s*=\s*"([^"]+)"/i) ?? html.match(/href\s*=\s*'([^']+)'/i)
  return match ? decodeEntities(match[1]) : null
}

export function absoluteUrl(href: string, origin: string): string {
  if (href.startsWith("https://") || href.startsWith("http://")) return href
  if (href.startsWith("//")) return `https:${href}`
  const base = origin.replace(/\/$/, "")
  if (href.startsWith("/")) return base + href
  return `${base}/${href}`
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

export function asString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = decodeEntities(value).trim()
    return trimmed || null
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value)
  return null
}

export function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => asString(item)).filter((item): item is string => Boolean(item))
}

export function parseJson(payload: string): unknown | null {
  try {
    return JSON.parse(payload)
  } catch {
    return null
  }
}

/** schema.org JobPosting embedded in a detail page, when the DOM classes have drifted. */
export function parseJsonLdJob(html: string): Record<string, unknown> | null {
  const re = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi
  for (let match = re.exec(html); match; match = re.exec(html)) {
    const data = parseJson(decodeEntities(match[1].trim()))
    const nodes = Array.isArray(data) ? data : [data]
    for (const node of nodes) {
      const record = asRecord(node)
      if (!record) continue
      const kind = record["@type"]
      const types = Array.isArray(kind) ? kind.map(String) : [String(kind ?? "")]
      if (types.includes("JobPosting")) return record
    }
  }
  return null
}

export function joinList(values: string[]): string | null {
  const unique = [...new Set(values.map((value) => value.trim()).filter(Boolean))]
  return unique.length ? unique.join(", ") : null
}
