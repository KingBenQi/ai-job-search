import type { PortalJob } from "../../../_cn-browser/src/types.js"

export const ZHIPIN_ORIGIN = "https://www.zhipin.com"
export const ZHIPIN_SEARCH_PAGE = "https://www.zhipin.com/web/geek/job"
export const ZHIPIN_JOB_URL = "https://www.zhipin.com/job_detail/"

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

/** Fields /scrape reads off every portal search result. Missing values are null. */
export function toSearchHit(job: PortalJob): SearchHit {
  return {
    id: job.id,
    title: job.title,
    company: job.company,
    location: job.location,
    date: job.date,
    url: job.url,
    salary: job.salary,
    experience: job.experience,
    education: job.education,
    requirements: job.requirements,
  }
}
