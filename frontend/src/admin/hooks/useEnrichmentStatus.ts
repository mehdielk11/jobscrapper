import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'

export interface EnrichmentStatus {
  status: 'idle' | 'processing'
  total: number
  processed: number
  updated_at?: string
}

const POLL_INTERVAL_MS = 3000

/**
 * Hook to track the background Enrichment Agent status in real-time.
 * Synchronizes with the 'enrichment_status' key in the app_config table.
 */
export function useEnrichmentStatus() {
  const [status, setStatus] = useState<EnrichmentStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const forcePollUntil = useRef<number>(0)

  const getToken = useCallback(async (): Promise<string | null> => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ?? null
  }, [])

  const fetchStatus = useCallback(async () => {
    try {
      const token = await getToken()
      if (!token) return

      const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'
      const res = await fetch(`${API_BASE}/api/enrichment-status?token=${token}`)
      if (!res.ok) return

      const data = await res.json() as EnrichmentStatus
      if (data) setStatus(data)
    } catch (err) {
      console.warn('[useEnrichmentStatus] Fetch failed:', err)
    } finally {
      setLoading(false)
    }
  }, [getToken])

  const triggerRefresh = useCallback(() => {
    forcePollUntil.current = Date.now() + 30_000
    fetchStatus()
  }, [fetchStatus])

  useEffect(() => { fetchStatus() }, [fetchStatus])

  // Polling: poll while processing OR during the force-poll burst window
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
      .channel('public:app_config_enrichment')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'app_config',
          filter: 'key=eq.enrichment_status'
        },
        (payload) => {
          const row = payload.new as any
          if (row && row.value) {
            setStatus(row.value as EnrichmentStatus)
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  return { status, loading, triggerRefresh }
}
