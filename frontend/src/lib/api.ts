import axios from 'axios'

const API_URL = 'http://localhost:8000/api' // FastAPI default port

export const api = axios.create({
  baseURL: API_URL,
})

export const getJobs = async () => {
  const res = await api.get('/jobs')
  return res.data.jobs
}

export const getProfile = async (userId: string) => {
  const res = await api.get(`/profile/${userId}`)
  return res.data.skills
}

export const saveProfile = async (userId: string, name: string, skills: string[]) => {
  const res = await api.post('/profile', { user_id: userId, name, skills })
  return res.data
}

export const getRecommendations = async (userId: string) => {
  const res = await api.get(`/recommend/${userId}`)
  return res.data.recommendations
}

export const getTaxonomy = async () => {
  const res = await api.get('/taxonomy')
  return res.data.skills
}
