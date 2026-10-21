import type { PortalJob, SearchQuery } from "./types.js"

export interface SalaryRange {
  min: number | null
  max: number | null
  negotiable: boolean
}

export type ExperienceSpan = { min: number; max: number } | "graduate" | "student"

/** Monthly CNY. `20-40K` and a user filter of `20-40` are both monthly thousands. */
export function parseSalary(text: string | null | undefined): SalaryRange | null {
  if (!text) return null
  const raw = text.replace(/\s+/g, "")
  if (/面议|negotiable/i.test(raw)) return { min: null, max: null, negotiable: true }
  const wan = raw.match(/(\d+(?:\.\d+)?)[-~到至](\d+(?:\.\d+)?)万/)
  if (wan) {
    return {
      min: Math.round(parseFloat(wan[1]) * 10000),
      max: Math.round(parseFloat(wan[2]) * 10000),
      negotiable: false,
    }
  }
  const k = raw.match(/(\d+(?:\.\d+)?)[-~到至](\d+(?:\.\d+)?)[kK千]/)
  if (k) {
    return {
      min: Math.round(parseFloat(k[1]) * 1000),
      max: Math.round(parseFloat(k[2]) * 1000),
      negotiable: false,
    }
  }
  const bare = raw.match(/(\d+(?:\.\d+)?)[-~到至](\d+(?:\.\d+)?)/)
  if (bare) {
    return {
      min: Math.round(parseFloat(bare[1]) * 1000),
      max: Math.round(parseFloat(bare[2]) * 1000),
      negotiable: false,
    }
  }
  return null
}

export function salariesOverlap(job: SalaryRange, wanted: SalaryRange): boolean {
  if (job.negotiable || wanted.negotiable) return false
  if (job.min == null || job.max == null || wanted.min == null || wanted.max == null) return false
  return job.min <= wanted.max && wanted.min <= job.max
}

export function parseExperience(text: string | null | undefined): ExperienceSpan | null {
  if (!text) return null
  const raw = text.replace(/\s+/g, "")
  if (/应届/.test(raw)) return "graduate"
  if (/在校|实习/.test(raw)) return "student"
  const atLeast = raw.match(/(\d+)年以上/)
  if (atLeast) return { min: parseInt(atLeast[1], 10), max: 99 }
  if (/十年以上/.test(raw)) return { min: 10, max: 99 }
  if (/1年以内|一年以内|1年以下/.test(raw)) return { min: 0, max: 1 }
  const range = raw.match(/(\d+)[-~到至](\d+)年?/)
  if (range) return { min: parseInt(range[1], 10), max: parseInt(range[2], 10) }
  const one = raw.match(/(\d+)年/)
  if (one) {
    const n = parseInt(one[1], 10)
    return { min: n, max: n }
  }
  return null
}

function spansOverlap(left: Exclude<ExperienceSpan, "graduate" | "student">, right: Exclude<ExperienceSpan, "graduate" | "student">): boolean {
  return left.min <= right.max && right.min <= left.max
}

export function experienceMatches(jobText: string | null, wanted: string): boolean {
  const job = parseExperience(jobText)
  if (job == null) return true
  const filter = parseExperience(/年|应届|在校|实习/.test(wanted) ? wanted : `${wanted}年`)
  if (filter == null) return true
  if (job === "graduate" || job === "student" || filter === "graduate" || filter === "student") {
    return job === filter
  }
  return spansOverlap(job, filter)
}

/** `true` when `date` is strictly older than `days` before `today`. Null dates are kept. */
export function isOlderThan(date: string | null, days: number, today: Date = new Date()): boolean {
  if (!date) return false
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!match) return false
  const posted = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  const now = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
  return (now - posted) / 86400000 > days
}

export function applyFilters(jobs: PortalJob[], query: SearchQuery, today?: Date): PortalJob[] {
  return jobs.filter((job) => {
    if (query.cityName && query.cityName !== "全国") {
      if (!job.location || !job.location.includes(query.cityName)) return false
    }
    if (query.salary) {
      const wanted = parseSalary(query.salary)
      const actual = parseSalary(job.salary)
      if (wanted && !wanted.negotiable) {
        if (!actual || actual.negotiable || !salariesOverlap(actual, wanted)) return false
      }
    }
    if (query.experience && !experienceMatches(job.experience, query.experience)) return false
    if (query.jobage !== undefined && isOlderThan(job.date, query.jobage, today)) return false
    return true
  })
}
