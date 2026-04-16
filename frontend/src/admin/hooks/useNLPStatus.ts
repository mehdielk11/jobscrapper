import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export interface NLPStatus {
  status: 'idle' | 'processing'
  total: number
  processed: number
  updated_at: string
}

/**
 * Hook to track the background NLP Engine status in real-time.
 * Synchronizes with the 'nlp_status' key in the app_config table.
 */
export function useNLPStatus() {
  const [status, setStatus] = useState<NLPStatus | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchInitial = async () => {
    try {
      const { data } = await supabase
        .from('app_config')
        .select('value')
        .eq('key', 'nlp_status')
        .maybeSingle()
      
      if (data?.value) {
        setStatus(data.value as NLPStatus)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchInitial()

    // Subscribe to realtime changes in app_config
    const channel = supabase
      .channel('public:app_config_nlp')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'app_config',
          filter: 'key=eq.nlp_status'
        },
        (payload) => {
          if (payload.new && (payload.new as any).value) {
            setStatus((payload.new as any).value as NLPStatus)
          }
        }
      )
      .subscribe((status) => {
        // If subscription fails or is closed, polling will handle it
        if (status === 'SUBSCRIBED') {
          console.log('NLP Status Realtime: Subscribed')
        }
      })

    // Fallback polling (every 10 seconds)
    const pollInterval = setInterval(fetchInitial, 10000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(pollInterval)
    }
  }, [])

  return { status, loading }
}
