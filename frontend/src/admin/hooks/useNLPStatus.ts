import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export interface NLPStatus {
  status: 'idle' | 'processing'
  total: number
  processed: number
  updated_at?: string
}

const POLL_INTERVAL_MS = 3000

/**
 * Hook to track the background NLP Engine status in real-time.
 * Synchronizes with the 'nlp_status' key in the app_config table.
 * 
 * Uses backend API (/api/nlp-status) to bypass RLS, ensuring admins
 * can always see the progress. Includes a polling fallback while processing.
 */
export function useNLPStatus() {
  const [status, setStatus] = useState<NLPStatus | null>(null)
  const [loading, setLoading] = useState(true)

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

      const res = await fetch(`/api/nlp-status?token=${token}`)
      if (!res.ok) return

      const data = await res.json() as NLPStatus
      if (data) {
        setStatus(data)
      }
    } catch (err) {
      console.warn('[useNLPStatus] Fetch failed:', err)
    } finally {
      setLoading(false)
    }
  }, [getToken])

  // Initial load
  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  // Polling fallback: Only poll if currently processing, or until we know it's idle.
  // We poll slightly faster (3s) while processing to ensure the progress bar is smooth
  // even if Realtime events are dropped.
  useEffect(() => {
    const isProcessing = status?.status === 'processing'
    
    // If idle, we rely on Realtime to detect when it starts processing again.
    // However, if we don't have status yet, we keep polling just in case.
    if (status && !isProcessing) return

    const timer = setInterval(fetchStatus, POLL_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [status, fetchStatus])

  // Realtime subscription as the primary instant-update mechanism
  useEffect(() => {
    const channel = supabase
      .channel('public:app_config_nlp_v2')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'app_config',
          filter: 'key=eq.nlp_status'
        },
        (payload) => {
          const row = payload.new as any
          if (row && row.value) {
            setStatus(row.value as NLPStatus)
          }
        }
      )
      .subscribe((subStatus) => {
        if (subStatus === 'SUBSCRIBED') {
          console.debug('[useNLPStatus] ✓ Realtime subscribed on app_config (nlp_status)')
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  return { status, loading }
}
