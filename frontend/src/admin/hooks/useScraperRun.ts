import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export type ScraperStatus = 'idle' | 'running' | 'success' | 'failed' | 'rate-limited'

export interface ScraperStateEntry {
  status: ScraperStatus
  jobsFound: number
  lastRun: string | null
}

interface ScraperState {
  [source: string]: ScraperStateEntry
}

interface UseScraperRunResult {
  scraperState: ScraperState
  runScraper: (source: string, limit: number, dryRun: boolean) => Promise<void>
  runAllScrapers: (limit: number, dryRun: boolean) => Promise<void>
  isRunning: boolean
}

const SOURCES = ['rekrute', 'emploidiali', 'emploi-public', 'marocannonces', 'indeed', 'linkedin']

const DEFAULT_STATE: ScraperState = Object.fromEntries(
  SOURCES.map(s => [s, { status: 'idle' as ScraperStatus, jobsFound: 0, lastRun: null }])
)

/**
 * Manages scraper status using Supabase Realtime (WebSocket CDC subscriptions).
 *
 * Live update pipeline:
 *  1. Mount  → GET /api/scraper-runs  (service-role, bypasses RLS) to seed state
 *  2. INSERT on scraper_runs → optimistic 'running' reflected immediately
 *  3. UPDATE on scraper_runs (backend writes success/failed) → subscription fires
 *     → React re-renders badge without page refresh
 *
 * "Live" technically = postgres_changes WebSocket subscription via Supabase Realtime.
 * In React, implemented as a custom hook with a useEffect subscription side-effect.
 */
export function useScraperRun(): UseScraperRunResult {
  const [scraperState, setScraperState] = useState<ScraperState>(DEFAULT_STATE)
  const [isRunning, setIsRunning] = useState(false)
  // Optimistic running set — sources triggered locally before DB confirms
  const localRunningRef = useRef<Set<string>>(new Set())

  // ── Stable state applier — maps a DB row to ScraperStateEntry ─────────────
  const applyRow = useCallback((row: {
    source: string
    status: string
    jobs_found: number | null
    started_at: string | null
  }) => {
    if (!SOURCES.includes(row.source)) return

    setScraperState(prev => {
      const next = {
        ...prev,
        [row.source]: {
          status: row.status as ScraperStatus,
          jobsFound: row.jobs_found ?? 0,
          lastRun: row.started_at ?? null,
        },
      }
      // Derive isRunning from the new state directly — no stale closure risk
      const anyRunning =
        Object.values(next).some(e => e.status === 'running') ||
        localRunningRef.current.size > 0
      setIsRunning(anyRunning)
      return next
    })
  }, [])

  // ── Initial load from backend (service-role client, bypasses RLS) ──────────
  useEffect(() => {
    const load = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return

        const res = await fetch(
          `/api/scraper-runs?token=${session.access_token}`
        )
        if (!res.ok) return

        const { runs } = await res.json() as {
          runs: Array<{
            source: string
            status: string
            jobs_found: number | null
            started_at: string | null
          }>
        }

        if (!runs?.length) return

        // Build state from most-recent run per source
        const seen = new Set<string>()
        const next = { ...DEFAULT_STATE }
        for (const run of runs) {
          if (SOURCES.includes(run.source) && !seen.has(run.source)) {
            next[run.source] = {
              status: run.status as ScraperStatus,
              jobsFound: run.jobs_found ?? 0,
              lastRun: run.started_at ?? null,
            }
            seen.add(run.source)
          }
          if (seen.size === SOURCES.length) break
        }

        setScraperState(next)
        const anyRunning = Object.values(next).some(e => e.status === 'running')
        if (anyRunning) setIsRunning(true)
      } catch (err) {
        console.warn('[useScraperRun] Initial load failed:', err)
      }
    }

    load()
  }, [])

  // ── WebSocket CDC subscription on scraper_runs ────────────────────────────
  // This is the "live" mechanism: Supabase Realtime listens to PostgreSQL
  // logical replication and pushes INSERT/UPDATE events via WebSocket.
  // Each UPDATE from the backend (running→success/failed) triggers applyRow,
  // which calls setScraperState → React re-renders the badge immediately.
  useEffect(() => {
    const channel = supabase
      .channel('scraper_runs_live_v2')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'scraper_runs' },
        (payload) => {
          const row = (payload.new ?? payload.old) as {
            source: string
            status: string
            jobs_found: number | null
            started_at: string | null
          } | null
          if (!row) return
          applyRow(row)
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.debug('[useScraperRun] ✓ Realtime subscription active on scraper_runs')
        }
      })

    return () => { supabase.removeChannel(channel) }
  }, [applyRow])

  // ── Helpers ────────────────────────────────────────────────────────────────
  const optimisticRunning = (source: string) => {
    localRunningRef.current.add(source)
    setScraperState(prev => ({
      ...prev,
      [source]: { ...prev[source], status: 'running' },
    }))
    setIsRunning(true)
  }

  const clearOptimistic = (source: string) => {
    localRunningRef.current.delete(source)
  }

  // ── Run single scraper ─────────────────────────────────────────────────────
  const runScraper = async (source: string, limit: number, dryRun: boolean) => {
    optimisticRunning(source)

    // Insert a new run record — the realtime subscription will receive this INSERT
    // and keep the UI in sync regardless of what happens next
    const { data: run } = await supabase
      .from('scraper_runs')
      .insert({ source, status: 'running', jobs_found: 0, jobs_saved: 0 })
      .select()
      .single()

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Authentication session lost.')

      const qs = new URLSearchParams({
        token: session.access_token,
        limit: String(limit),
        dry_run: String(dryRun),
        ...(run?.id ? { run_id: run.id } : {}),
      })
      const response = await fetch(`/api/scrape/${source}?${qs}`, { method: 'POST' })
      const data = await response.json()

      if (!response.ok) {
        const status = response.status === 429 ? 'rate-limited' : 'failed'
        if (run?.id) {
          // Write failure to DB → triggers Realtime UPDATE → badge updates automatically
          await supabase.from('scraper_runs').update({
            status,
            error_message: data.detail ?? 'Unknown error',
            finished_at: new Date().toISOString(),
          }).eq('id', run.id)
        }
      }
      // Else: 202 Accepted — backend task running; Realtime will push the completion
    } catch (err) {
      if (run?.id) {
        await supabase.from('scraper_runs').update({
          status: 'failed',
          error_message: String(err),
          finished_at: new Date().toISOString(),
        }).eq('id', run.id)
      }
    } finally {
      clearOptimistic(source)
    }
  }

  // ── Run all scrapers ───────────────────────────────────────────────────────
  const runAllScrapers = async (limit: number, dryRun: boolean) => {
    SOURCES.forEach(s => optimisticRunning(s))

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Auth session lost.')

      const qs = new URLSearchParams({
        token: session.access_token,
        limit: String(limit),
        dry_run: String(dryRun),
      })
      const response = await fetch(`/api/scrape/run?${qs}`, { method: 'POST' })
      const data = await response.json()

      if (!response.ok) throw new Error(data.detail || 'Failed to start pipeline')
      // Realtime subscription drives all subsequent status updates.
    } catch (err) {
      console.error('[useScraperRun] Run All error:', err)
      // Mark all as failed — single setScraperState call is efficient
      setScraperState(prev => {
        const next = { ...prev }
        SOURCES.forEach(s => { next[s] = { ...next[s], status: 'failed' } })
        return next
      })
      setIsRunning(false)
    } finally {
      SOURCES.forEach(clearOptimistic)
    }
  }

  return { scraperState, runScraper, runAllScrapers, isRunning }
}
