import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

export interface LogLine {
  level: 'INFO' | 'WARNING' | 'ERROR'
  message: string
  timestamp: string
  source?: string
}

interface UseRealtimeLogsResult {
  logs: LogLine[]
  clearLogs: () => void
  isStreaming: boolean
}

/**
 * Subscribes to the 'scraper_logs' Supabase Realtime broadcast channel.
 * Appends incoming log lines to local state. Auto-cleans at 500 lines to avoid memory leaks.
 */
export function useRealtimeLogs(source?: string): UseRealtimeLogsResult {
  const [logs, setLogs] = useState<LogLine[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  useEffect(() => {
    channelRef.current = supabase
      .channel('public:scraper_logs')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'scraper_logs',
          filter: source ? `source=eq.${source}` : undefined
        },
        (payload) => {
          const newRow = payload.new as any
          const line: LogLine = {
            level: newRow.level ?? 'INFO',
            message: newRow.message ?? '',
            timestamp: newRow.created_at ?? new Date().toISOString(),
            source: newRow.source,
          }
          setLogs(prev => {
            const updated = [...prev, line]
            return updated.length > 500 ? updated.slice(updated.length - 500) : updated
          })
          setIsStreaming(true)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channelRef.current!)
      setIsStreaming(false)
    }
  }, [source])

  const clearLogs = () => setLogs([])

  return { logs, clearLogs, isStreaming }
}
