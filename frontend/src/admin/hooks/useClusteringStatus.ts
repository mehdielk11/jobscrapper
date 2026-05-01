import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'

export interface ClusteringStatus {
  status: 'idle' | 'processing'
  step: string
  progress: number
  total: number
  updated_at?: string
}

const POLL_INTERVAL_MS = 3000

/**
 * Hook to track the background Clustering Engine status in real-time.
 * Synchronizes with the 'clustering_status' key in the app_config table.
 */
export function useClusteringStatus() {
  const [status, setStatus] = useState<ClusteringStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const forcePollUntil = useRef<number>(0)

  // Helper to fetch token
  const getToken = useCallback(async (): Promise<string | null> => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ?? null
  }, [])

  // Fetch from backend (bypasses RLS)
  const fetchStatus = useCallback(async () => {
    try {
      const token = await getToken()
      if (!token) return

      const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'
      const res = await fetch(`${API_BASE}/api/clustering-status?token=${token}`)
      if (!res.ok) return

      const data = await res.json() as ClusteringStatus
      if (data) {
        setStatus(data)
      }
    } catch (err) {
      console.warn('[useClusteringStatus] Fetch failed:', err)
    } finally {
      setLoading(false)
    }
  }, [getToken])

  // Force a burst of polling
  const triggerRefresh = useCallback(() => {
    forcePollUntil.current = Date.now() + 30_000
    fetchStatus()
  }, [fetchStatus])

  // Initial load
  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  // Polling
  useEffect(() => {
    const isProcessing = status?.status === 'processing'
    const isForcePollActive = () => Date.now() < forcePollUntil.current

    if (status && !isProcessing && !isForcePollActive()) return

    const interval = status ? POLL_INTERVAL_MS : 15000
    const timer = setInterval(() => {
      fetchStatus()
      if (!isForcePollActive() && status?.status !== 'processing') {
        clearInterval(timer)
      }
    }, interval)
    return () => clearInterval(timer)
  }, [status, fetchStatus])

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('public:app_config_clustering_v2')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'app_config',
          filter: 'key=eq.clustering_status'
        },
        (payload) => {
          const row = payload.new as any
          if (row && row.value) {
            setStatus(row.value as ClusteringStatus)
          }
        }
      )
      .subscribe((subStatus) => {
        if (subStatus === 'SUBSCRIBED') {
          console.debug('[useClusteringStatus] ✓ Realtime subscribed on app_config (clustering_status)')
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  return { status, loading, triggerRefresh }
}
