import type { PortalJob } from "./types.js"

export interface SearchHit {
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
}

export function writeJson(value: unknown): void {
  process.stdout.write(JSON.stringify(value, null, 2) + "\n")
}

export function writeError(error: string, code: string): void {
  process.stderr.write(JSON.stringify({ error, code }) + "\n")
}

export function writeSearch(
  hits: SearchHit[],
  format: "json" | "table" | "plain",
  page: number,
  warnings: string[],
): void {
  if (format === "table") {
    process.stdout.write(renderTable(hits) + "\n")
    for (const warning of warnings) process.stdout.write(`warning: ${warning}\n`)
    return
  }
  if (format === "plain") {
    const body = hits
      .map(
        (hit) =>
          `${hit.title}\n  ${hit.company ?? "—"} · ${hit.location ?? "—"} · ${hit.salary ?? "—"} · ${hit.date ?? "—"}\n  id: ${hit.id}\n  ${hit.url}`,
      )
      .join("\n\n")
    process.stdout.write((body || "No results.") + "\n")
    return
  }
  writeJson({ meta: { count: hits.length, page, warnings }, results: hits })
}

export function writeDetail(job: PortalJob, format: "json" | "table" | "plain"): void {
  if (format === "json") {
    writeJson(job)
    return
  }
  const lines = [
    job.title,
    [job.company, job.location, job.salary, job.experience, job.education].filter(Boolean).join(" · "),
    job.requirements ? `要求: ${job.requirements}` : "",
    "",
    job.description ?? "",
    "",
    job.url,
  ].filter((line, index, all) => line !== "" || all[index - 1] !== "")
  process.stdout.write(lines.join("\n").trim() + "\n")
}

function renderTable(hits: SearchHit[]): string {
  if (hits.length === 0) return "No results."
  const rows = hits.map((hit) => {
    const title = hit.title.slice(0, 28).padEnd(28)
    const company = (hit.company ?? "—").slice(0, 18).padEnd(18)
    const salary = (hit.salary ?? "—").slice(0, 14).padEnd(14)
    const location = (hit.location ?? "—").slice(0, 16).padEnd(16)
    return `${title} ${company} ${salary} ${location}`
  })
  const header = `${"TITLE".padEnd(28)} ${"COMPANY".padEnd(18)} ${"SALARY".padEnd(14)} LOCATION`
  return [header, "-".repeat(header.length), ...rows].join("\n")
}
