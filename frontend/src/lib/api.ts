import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'

export const api = axios.create({
  baseURL: API_URL,
})

export const getJobs = async () => {
  const res = await api.get('/jobs')
  return res.data.jobs
}

export const getUserProfile = async (userId: string) => {
  const res = await api.get(`/user/profile/${userId}`)
  return res.data.skills
}

export const saveUserProfile = async (userId: string, name: string, skills: string[]) => {
  const res = await api.post('/user/profile', { user_id: userId, name, skills })
  return res.data
}

export const getRecommendations = async (userId: string) => {
  const res = await api.get(`/recommend/${userId}`)
  return res.data
}

export const getTaxonomy = async () => {
  const res = await api.get('/taxonomy')
  return res.data.skills
}

export const triggerScrape = async () => {
  const res = await api.post('/scrape/run')
  return res.data
}
