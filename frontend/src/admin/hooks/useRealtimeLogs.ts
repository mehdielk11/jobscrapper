import { useEffect, useRef, useState, useId, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export interface LogLine {
  id?: string
  level: 'INFO' | 'WARNING' | 'ERROR'
  message: string
  timestamp: string
  source?: string
}

interface UseRealtimeLogsConfig {
  /** Filter logs to a specific source (e.g. 'rekrute'). Omit for all sources. */
  source?: string
  /**
   * How many hours back to pre-load from the backend on mount.
   * Use 0 to skip the historical fetch (streaming-only mode).
   * Default: 6 hours — covers any scraper run started in the last 6h.
   */
  historyHours?: number
  /**
   * Maximum rows to fetch from history on mount.
   * Default: 500
   */
  historyLimit?: number
}

interface UseRealtimeLogsResult {
  logs: LogLine[]
  clearLogs: () => void
  isStreaming: boolean
  isLoadingHistory: boolean
}

/**
 * Subscribes to the `scraper_logs` Supabase Realtime table broadcasts
 * AND pre-loads recent historical logs on mount via GET /api/logs.
 *
 * The historical fetch goes through the FastAPI backend (service-role client)
 * so RLS policies never silently filter out rows.
 *
 * Behaviour:
 * - On mount: calls GET /api/logs?hours=N to seed the terminal with past logs.
 * - Realtime stream: INSERTs to `scraper_logs` are appended without duplicates.
 * - Buffer capped at 1 000 lines to prevent memory growth.
 * - Each hook instance uses a unique Supabase channel name (via useId()).
 */
export function useRealtimeLogs({
  source,
  historyHours = 6,
  historyLimit = 500,
}: UseRealtimeLogsConfig = {}): UseRealtimeLogsResult {
  const [logs, setLogs] = useState<LogLine[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [isLoadingHistory, setIsLoadingHistory] = useState(historyHours > 0)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  // Track IDs already in state to deduplicate between history and realtime stream
  const seenIdsRef = useRef<Set<string>>(new Set())

  const uid = useId().replace(/:/g, '')

  // ── Helper: map a raw row to LogLine ─────────────────────────────────────
  const rowToLine = useCallback(
    (row: Record<string, unknown>): LogLine => ({
      id: row.id as string,
      level: (row.level as LogLine['level']) ?? 'INFO',
      message: (row.message as string) ?? '',
      timestamp: (row.created_at as string) ?? new Date().toISOString(),
      source: row.source as string | undefined,
    }),
    []
  )

  // ── Historical pre-load via backend API ──────────────────────────────────
  useEffect(() => {
    if (historyHours <= 0) {
      setIsLoadingHistory(false)
      return
    }

    const load = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          setIsLoadingHistory(false)
          return
        }

        const params = new URLSearchParams({
          token: session.access_token,
          hours: String(historyHours),
          limit: String(historyLimit),
        })
        if (source) params.set('source', source)

        const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
        const res = await fetch(`${API_BASE}/api/logs?${params.toString()}`)
        if (!res.ok) throw new Error(`/api/logs ${res.status}`)

        const json = await res.json() as { logs: Record<string, unknown>[] }
        if (json.logs?.length > 0) {
          const lines = json.logs.map(rowToLine)
          lines.forEach(l => { if (l.id) seenIdsRef.current.add(l.id) })
          setLogs(lines)
        }
      } catch (err) {
        console.warn('[useRealtimeLogs] History fetch failed:', err)
      } finally {
        setIsLoadingHistory(false)
      }
    }

    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, historyHours, historyLimit])

  // ── Realtime subscription ────────────────────────────────────────────────
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
          const rowId = row.id as string | undefined

          // Skip rows already loaded from history
          if (rowId && seenIdsRef.current.has(rowId)) return
          if (rowId) seenIdsRef.current.add(rowId)

          const line = rowToLine(row)
          setLogs(prev => {
            const updated = [...prev, line]
            // Cap buffer at 1 000 — drop oldest
            return updated.length > 1000 ? updated.slice(updated.length - 1000) : updated
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
  }, [source, uid, rowToLine])

  const clearLogs = useCallback(() => {
    setLogs([])
    seenIdsRef.current.clear()
  }, [])

  return { logs, clearLogs, isStreaming, isLoadingHistory }
}
