/**
 * Local application tracker row for a greeting draft.
 *
 * Adapted from automation/apply_bot/tracker.py in
 * https://github.com/JiemsLBJ/offer-harvester (MIT).
 * The header matches this repo's /apply and /outcome tracker.
 *
 * Copyright (c) 2026 JiemsLBJ (China-market automation pipeline)
 * Copyright (c) 2026 Mads Lorentzen (upstream ai-job-search)
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 * A recorded greeting is status `drafted`, never `applied`. The CSV is
 * job_search_tracker.csv, which this repo gitignores.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"

import { repoRoot } from "./paths.js"

export const TRACKER_HEADER =
  "date,company,sector,role,role_type,channel,status,contact_person,fit_rating,notes,cv_file,cover_letter_file,source,deadline"

const HEADER = TRACKER_HEADER.split(",")

export interface TrackerDraft {
  path?: string
  company: string
  role: string
  portal: string
  url?: string
  status?: string
}

function cell(value: string): string {
  return value.replace(/[",\r\n]/g, " ").trim()
}

function readRows(path: string): string[][] {
  try {
    const text = readFileSync(path, "utf8").replace(/^\uFEFF/, "")
    const lines = text.split(/\r?\n/).filter((line) => line.length > 0)
    if (!lines.length) return []
    const first = lines[0].split(",")
    const body = first[0] === "date" ? lines.slice(1) : lines
    return body.map((line) => line.split(","))
  } catch {
    return []
  }
}

export function trackerPath(): string {
  const override = process.env.CN_PORTALS_TRACKER?.trim()
  return override && override.length > 0 ? override : `${repoRoot()}/job_search_tracker.csv`
}

/** Insert or update one drafted row. Does not mark the row applied. */
export function upsertDraft(draft: TrackerDraft): string {
  const path = draft.path ?? trackerPath()
  const rows = readRows(path)
  const today = new Date().toISOString().slice(0, 10)
  const company = cell(draft.company)
  const role = cell(draft.role)
  const status = draft.status ?? "drafted"
  const marker = "greeting-draft"
  const idx = Object.fromEntries(HEADER.map((name, i) => [name, i]))
  let match = rows.find(
    (row) =>
      (row[idx.company] ?? "").trim().toLowerCase() === company.toLowerCase() &&
      (row[idx.role] ?? "").trim().toLowerCase() === role.toLowerCase(),
  )
  if (!match) {
    match = HEADER.map(() => "")
    match[idx.date] = today
    match[idx.company] = company
    match[idx.role] = role
    rows.push(match)
  }
  match[idx.channel] = cell(draft.portal)
  match[idx.status] = cell(status)
  match[idx.source] = cell(draft.url ?? "")
  const note = match[idx.notes] ?? ""
  if (!note.includes(marker)) match[idx.notes] = `${note} ${marker}`.trim()
  while (match.length < HEADER.length) match.push("")
  mkdirSync(dirname(path), { recursive: true })
  const body = [TRACKER_HEADER, ...rows.map((row) => row.slice(0, HEADER.length).join(","))]
  writeFileSync(path, body.join("\n") + "\n", "utf8")
  return path
}
