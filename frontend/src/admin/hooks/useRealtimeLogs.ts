import { useEffect, useRef, useState, useId } from 'react'
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
 * Subscribes to the 'scraper_logs' Supabase Realtime table broadcasts.
 *
 * Each hook instance uses a UNIQUE channel name (via React.useId) so that
 * multiple consumers on the same page don't share a single channel object —
 * which would cause "cannot add postgres_changes callbacks after subscribe()".
 *
 * Auto-caps log buffer at 500 lines to avoid memory leaks.
 */
export function useRealtimeLogs(source?: string): UseRealtimeLogsResult {
  const [logs, setLogs] = useState<LogLine[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  // Unique ID per hook instance — prevents channel name collisions when the
  // hook is used more than once in the same component tree.
  const uid = useId().replace(/:/g, '')

  useEffect(() => {
    const channelName = `scraper_logs_${uid}_${source ?? 'all'}`

    channelRef.current = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'scraper_logs',
          filter: source ? `source=eq.${source}` : undefined,
        },
        (payload) => {
          const row = payload.new as Record<string, unknown>
          const line: LogLine = {
            level: (row.level as LogLine['level']) ?? 'INFO',
            message: (row.message as string) ?? '',
            timestamp: (row.created_at as string) ?? new Date().toISOString(),
            source: row.source as string | undefined,
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
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
      setIsStreaming(false)
    }
  // Re-subscribe only when source changes (uid is stable across renders)
  }, [source, uid])

  const clearLogs = () => setLogs([])

  return { logs, clearLogs, isStreaming }
}
