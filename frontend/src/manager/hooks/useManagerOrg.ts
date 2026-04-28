import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/context/auth-context'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export interface Organisation {
  id: string
  name: string
  slug: string
  description: string
  manager_auth_id: string
  invite_code: string
  created_at: string
  updated_at: string
}

/**
 * Hook to fetch and manage the academic manager's organisation.
 */
export function useManagerOrg() {
  const { session } = useAuth()
  const [org, setOrg] = useState<Organisation | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchOrg = useCallback(async () => {
    if (!session?.access_token) return
    try {
      const resp = await fetch(`${API_BASE}/api/org/mine?token=${session.access_token}`)
      if (resp.ok) {
        const data = await resp.json()
        setOrg(data.organisation || null)
      }
    } catch (err) {
      console.error('Failed to fetch org:', err)
    } finally {
      setLoading(false)
    }
  }, [session?.access_token])

  useEffect(() => { fetchOrg() }, [fetchOrg])

  const createOrg = async (name: string, description?: string) => {
    if (!session?.access_token) return null
    const resp = await fetch(`${API_BASE}/api/org?token=${session.access_token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description }),
    })
    if (!resp.ok) {
      const err = await resp.json()
      throw new Error(err.detail || 'Failed to create organisation')
    }
    const data = await resp.json()
    setOrg(data.organisation)
    return data.organisation
  }

  const updateOrg = async (name?: string, description?: string) => {
    if (!session?.access_token) return null
    const resp = await fetch(`${API_BASE}/api/org/mine?token=${session.access_token}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description }),
    })
    if (!resp.ok) throw new Error('Failed to update organisation')
    const data = await resp.json()
    setOrg(data.organisation)
    return data.organisation
  }

  const regenerateInviteCode = async () => {
    if (!session?.access_token) return null
    const resp = await fetch(`${API_BASE}/api/org/mine/invite-code/regenerate?token=${session.access_token}`, {
      method: 'POST',
    })
    if (!resp.ok) throw new Error('Failed to regenerate invite code')
    const data = await resp.json()
    setOrg(prev => prev ? { ...prev, invite_code: data.invite_code } : null)
    return data.invite_code
  }

  return { org, loading, createOrg, updateOrg, regenerateInviteCode, refetch: fetchOrg }
}
