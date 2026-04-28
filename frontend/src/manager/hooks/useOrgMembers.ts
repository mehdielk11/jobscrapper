import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/context/auth-context'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export interface OrgMember {
  id: string
  auth_user_id: string
  first_name: string
  last_name: string
  email: string
  skills: string[]
  joined_at: string
}

/**
 * Hook to manage organisation members — list, add, remove.
 */
export function useOrgMembers() {
  const { session } = useAuth()
  const [members, setMembers] = useState<OrgMember[]>([])
  const [loading, setLoading] = useState(true)

  const fetchMembers = useCallback(async () => {
    if (!session?.access_token) return
    setLoading(true)
    try {
      const resp = await fetch(`${API_BASE}/api/org/mine/members?token=${session.access_token}`)
      if (resp.ok) {
        const data = await resp.json()
        setMembers(data.members || [])
      }
    } catch (err) {
      console.error('Failed to fetch members:', err)
    } finally {
      setLoading(false)
    }
  }, [session?.access_token])

  useEffect(() => { fetchMembers() }, [fetchMembers])

  const addMember = async (email: string) => {
    if (!session?.access_token) throw new Error('Not authenticated')
    const resp = await fetch(`${API_BASE}/api/org/mine/members?token=${session.access_token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    if (!resp.ok) {
      const err = await resp.json()
      throw new Error(err.detail || 'Failed to add member')
    }
    await fetchMembers()
  }

  const removeMember = async (userAuthId: string) => {
    if (!session?.access_token) throw new Error('Not authenticated')
    const resp = await fetch(
      `${API_BASE}/api/org/mine/members/${userAuthId}?token=${session.access_token}`,
      { method: 'DELETE' }
    )
    if (!resp.ok) {
      const err = await resp.json()
      throw new Error(err.detail || 'Failed to remove member')
    }
    await fetchMembers()
  }

  return { members, loading, addMember, removeMember, refetch: fetchMembers }
}
