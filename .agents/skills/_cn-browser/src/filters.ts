import type { PortalJob, SearchQuery } from "./types.js"

export interface SalaryRange {
  /** Monthly CNY. Null is an open end (`以上` has no max, `以下` has no min). */
  min: number | null
  max: number | null
  negotiable: boolean
  /** Pay months when the text says `·N薪`. Null when the posting does not say. */
  months: number | null
}

export type ExperienceSpan = { min: number; max: number } | "graduate" | "student" | "early" | "any"

/**
 * Average pay-days in a Chinese month (月计薪天数). Intern stipends quoted
 * as 元/天 are converted with this, not with a 30-day calendar month.
 */
const PAY_DAYS_PER_MONTH = 21.75

function emptySalary(negotiable: boolean, months: number | null = null): SalaryRange {
  return { min: null, max: null, negotiable, months }
}

function scale(amount: number, factor: number, months: number | null): number {
  const monthly = amount * factor
  const adjusted = months == null ? monthly : (monthly * months) / 12
  return Math.round(adjusted)
}

/**
 * Normalize a salary string to monthly CNY.
 *
 * `20-40` and `20-40K` are monthly thousands. `万` without `/年` is monthly.
 * `万/年` is divided by 12. `元/天` uses {@link PAY_DAYS_PER_MONTH}.
 * `·N薪` is stored on `months` and scales the monthly amount by N/12, so a
 * 15-month package can be compared with a 12-month one. `以上` leaves max
 * open and `以下` leaves min open. `面议` is negotiable and does not overlap
 * a numeric filter unless the search asks to keep unknown salaries.
 */
export function parseSalary(text: string | null | undefined): SalaryRange | null {
  if (!text) return null
  const raw = text.replace(/[\s,]/g, "")
  if (/面议|negotiable/i.test(raw)) return emptySalary(true)

  const monthsMatch = raw.match(/[·•.]?(\d+)薪/)
  const months = monthsMatch ? parseInt(monthsMatch[1], 10) : null
  const body = raw.replace(/[·•.]?\d+薪/g, "")

  let factor = 1000
  let source = body
  if (/元\/天|元\/日|元每天/.test(body)) {
    factor = PAY_DAYS_PER_MONTH
    source = body.replace(/元\/天|元\/日|元每天/g, "")
  } else if (/万/.test(body) && /万\/年|万每年|\/年/.test(body)) {
    factor = 10000 / 12
    source = body.replace(/万\/年|万每年|\/年|万/g, "")
  } else if (/万/.test(body)) {
    factor = 10000
    source = body.replace(/万/g, "")
  } else if (/[kK千]/.test(body)) {
    factor = 1000
    source = body.replace(/[kK千]/g, "")
  } else if (/元/.test(body)) {
    factor = 1
    source = body.replace(/元\/月|元/g, "")
  }

  const num = "(\\d+(?:\\.\\d+)?)"
  const range = source.match(new RegExp(`${num}[-~到至]${num}`))
  const above = source.match(new RegExp(`${num}以上`))
  const below = source.match(new RegExp(`${num}以下`))
  const single = source.match(new RegExp(num))
  const finish = (min: number | null, max: number | null): SalaryRange => ({
    min: min == null ? null : scale(min, factor, months),
    max: max == null ? null : scale(max, factor, months),
    negotiable: false,
    months,
  })
  if (range) return finish(parseFloat(range[1]), parseFloat(range[2]))
  if (above) return finish(parseFloat(above[1]), null)
  if (below) return finish(null, parseFloat(below[1]))
  if (single && source.replace(single[0], "").replace(/以上|以下/g, "") === "") {
    return finish(parseFloat(single[1]), parseFloat(single[1]))
  }
  return null
}

function endMin(range: SalaryRange): number {
  return range.min ?? 0
}

function endMax(range: SalaryRange): number {
  return range.max ?? Number.POSITIVE_INFINITY
}

export function salariesOverlap(job: SalaryRange, wanted: SalaryRange): boolean {
  if (job.negotiable || wanted.negotiable) return false
  if (job.min == null && job.max == null) return false
  if (wanted.min == null && wanted.max == null) return false
  return endMin(job) <= endMax(wanted) && endMin(wanted) <= endMax(job)
}

export function parseExperience(text: string | null | undefined): ExperienceSpan | null {
  if (!text) return null
  const raw = text.replace(/\s+/g, "")
  if (/经验不限/.test(raw)) return "any"
  const student = /在校|实习/.test(raw)
  const graduate = /应届/.test(raw)
  if (student && graduate) return "early"
  if (graduate) return "graduate"
  if (student) return "student"
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

function spansOverlap(
  left: Exclude<ExperienceSpan, "graduate" | "student" | "early" | "any">,
  right: Exclude<ExperienceSpan, "graduate" | "student" | "early" | "any">,
): boolean {
  return left.min <= right.max && right.min <= left.max
}

function isEarly(span: ExperienceSpan): boolean {
  return span === "student" || span === "graduate" || span === "early"
}

function isSpan(span: ExperienceSpan): span is { min: number; max: number } {
  return typeof span === "object"
}

export function experienceMatches(jobText: string | null, wanted: string): boolean {
  const job = parseExperience(jobText)
  if (job == null || job === "any") return true
  const filter = parseExperience(/年|应届|在校|实习|经验不限/.test(wanted) ? wanted : `${wanted}年`)
  if (filter == null || filter === "any") return true
  if (job === "early" && isEarly(filter)) return true
  if (filter === "early" && isEarly(job)) return true
  if (isEarly(job) || isEarly(filter)) return job === filter
  if (!isSpan(job) || !isSpan(filter)) return false
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
        const unknown = !actual || actual.negotiable
        if (unknown) {
          if (!query.includeUnknownSalary) return false
        } else if (!salariesOverlap(actual, wanted)) return false
      }
    }
    if (query.experience && !experienceMatches(job.experience, query.experience)) return false
    if (query.jobage !== undefined && isOlderThan(job.date, query.jobage, today)) return false
    return true
  })
}
