export interface Job {
  id: number
  title: string
  company: string
  location: string
  source: string
  url: string
  skills: string[]
}

export interface Recommendation {
  job: Job
  match_score: number
  matched_skills: string[]
  missing_skills: string[]
  title: string
  company: string
  url: string
  source: string
}

export interface ProfileResponse {
  skills: string[]
}
