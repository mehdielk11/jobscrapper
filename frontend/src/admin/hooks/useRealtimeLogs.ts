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
    const channelName = source ? `scraper_logs_${source}` : 'scraper_logs'

    channelRef.current = supabase
      .channel(channelName)
      .on('broadcast', { event: 'log' }, ({ payload }) => {
        const line: LogLine = {
          level: payload.level ?? 'INFO',
          message: payload.message ?? '',
          timestamp: payload.timestamp ?? new Date().toISOString(),
          source: payload.source,
        }
        setLogs(prev => {
          const updated = [...prev, line]
          // Keep only last 500 lines to avoid unbounded growth
          return updated.length > 500 ? updated.slice(updated.length - 500) : updated
        })
        setIsStreaming(true)
      })
      .subscribe()

    return () => {
      channelRef.current?.unsubscribe()
      setIsStreaming(false)
    }
  }, [source])

  const clearLogs = () => setLogs([])

  return { logs, clearLogs, isStreaming }
}
