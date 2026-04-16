import { useState, useEffect, useCallback } from 'react'
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

/** How often to poll /api/scraper-runs when any scraper is running (ms). */
const POLL_INTERVAL_MS = 8000

/**
 * A 'running' row older than this is from a dead server process.
 * The backend startup cleanup handles DB-level cleanup; this is the
 * client-side guard in case the cleanup didn't cover it (e.g., the
 * server was restarted but the frontend is still open from before).
 */
const STALE_RUNNING_MS = 30 * 60 * 1000 // 30 minutes

/**
 * Manages scraper status via two complementary mechanisms:
 *
 * 1. Supabase Realtime (postgres_changes WebSocket subscription) — instant
 *    updates when the backend writes to scraper_runs.
 * 2. Polling fallback — queries GET /api/scraper-runs every 4 seconds ONLY
 *    while isRunning=true. Guarantees zombie states are cleared even if
 *    Realtime is blocked by RLS or network conditions.
 *
 * Row lifecycle — backend owns everything:
 *   - The backend creates scraper_runs rows (service-role, bypasses RLS).
 *   - The backend updates status to success/failed on completion.
 *   - The frontend NEVER writes to scraper_runs.
 */
export function useScraperRun(): UseScraperRunResult {
  const [scraperState, setScraperState] = useState<ScraperState>(DEFAULT_STATE)
  const [isRunning, setIsRunning] = useState(false)

  const applyRow = useCallback((row: {
    source: string
    status: string
    jobs_found: number | null
    started_at: string | null
  }) => {
    if (!SOURCES.includes(row.source)) return

    let finalStatus = row.status as ScraperStatus

    if (finalStatus === 'running' && row.started_at) {
      const started = new Date(row.started_at).getTime()
      if (Date.now() - started > STALE_RUNNING_MS) {
        finalStatus = 'failed'
        console.warn(`[useScraperRun] Warning: ${row.source} was running for > 30 mins. Marking as failed client-side to prevent polling.`)
      }
    }

    setScraperState(prev => {
      const next = {
        ...prev,
        [row.source]: {
          status: finalStatus,
          jobsFound: row.jobs_found ?? 0,
          lastRun: row.started_at ?? null,
        },
      }
      // Derive isRunning from the updated state — never stale closure
      setIsRunning(Object.values(next).some(e => e.status === 'running'))
      return next
    })
  }, [])

  // ── Helper: fetch token from session ──────────────────────────────────────
  const getToken = useCallback(async (): Promise<string | null> => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ?? null
  }, [])

  // ── Helper: fetch all recent runs from backend (service-role, RLS-safe) ───
  const fetchRuns = useCallback(async () => {
    try {
      const token = await getToken()
      if (!token) return

      const res = await fetch(`/api/scraper-runs?token=${token}`)
      if (!res.ok) return

      const { runs } = await res.json() as {
        runs: Array<{ source: string; status: string; jobs_found: number | null; started_at: string | null }>
      }

      if (!runs?.length) return

      // Apply most-recent run per source
      const seen = new Set<string>()
      for (const run of runs) {
        if (SOURCES.includes(run.source) && !seen.has(run.source)) {
          applyRow(run)
          seen.add(run.source)
        }
        if (seen.size === SOURCES.length) break
      }
    } catch (err) {
      console.warn('[useScraperRun] fetchRuns failed:', err)
    }
  }, [applyRow, getToken])

  // ── Initial load ───────────────────────────────────────────────────────────
  useEffect(() => {
    fetchRuns()
  }, [fetchRuns])

  // ── Polling fallback: ONLY active while isRunning=true ────────────────────
  // Guarantees zombie states resolve even when Realtime is blocked by RLS.
  useEffect(() => {
    if (!isRunning) return

    const timer = setInterval(fetchRuns, POLL_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [isRunning, fetchRuns])

  // ── Supabase Realtime WebSocket subscription ──────────────────────────────
  // Primary "live" mechanism. postgres_changes fires on every INSERT/UPDATE
  // to scraper_runs. The backend writes the UPDATE on completion, which
  // triggers this callback and immediately re-renders the badge.
  useEffect(() => {
    const channel = supabase
      .channel('scraper_runs_live_v3')
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
          console.debug('[useScraperRun] Realtime event:', row.source, row.status)
          applyRow(row)
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.debug('[useScraperRun] ✓ Realtime subscribed on scraper_runs')
        }
      })

    return () => { supabase.removeChannel(channel) }
  }, [applyRow])

  // ── Run single scraper ─────────────────────────────────────────────────────
  const runScraper = async (source: string, limit: number, dryRun: boolean) => {
    // Optimistic immediate UI update — don't wait for the round-trip
    setScraperState(prev => ({
      ...prev,
      [source]: { ...prev[source], status: 'running' },
    }))
    setIsRunning(true)

    try {
      const token = await getToken()
      if (!token) throw new Error('Authentication session lost.')

      const qs = new URLSearchParams({
        token,
        limit: String(limit),
        dry_run: String(dryRun),
      })
      const res = await fetch(`/api/scrape/${source}?${qs}`, { method: 'POST' })
      const data = await res.json()

      if (!res.ok) {
        // API returned error synchronously (auth/rate-limit) — update state immediately
        const status = res.status === 429 ? 'rate-limited' : 'failed'
        setScraperState(prev => ({
          ...prev,
          [source]: { ...prev[source], status, lastRun: new Date().toISOString() },
        }))
        setIsRunning(false)
        console.error(`[useScraperRun] ${source} failed immediately:`, data.detail)
      }
      // 200/202: backend created the run + started the bg task.
      // Realtime or polling will deliver the status transition.
    } catch (err) {
      setScraperState(prev => ({
        ...prev,
        [source]: { ...prev[source], status: 'failed', lastRun: new Date().toISOString() },
      }))
      setIsRunning(false)
      console.error('[useScraperRun] runScraper network error:', err)
    }
  }

  // ── Run all scrapers ───────────────────────────────────────────────────────
  const runAllScrapers = async (limit: number, dryRun: boolean) => {
    // Optimistic: mark all as running
    setScraperState(prev => {
      const next = { ...prev }
      SOURCES.forEach(s => { next[s] = { ...next[s], status: 'running' } })
      return next
    })
    setIsRunning(true)

    try {
      const token = await getToken()
      if (!token) throw new Error('Auth session lost.')

      const qs = new URLSearchParams({
        token,
        limit: String(limit),
        dry_run: String(dryRun),
      })
      const res = await fetch(`/api/scrape/run?${qs}`, { method: 'POST' })
      const data = await res.json()

      if (!res.ok) throw new Error(data.detail || 'Failed to start pipeline')
      // Success: backend created run records + started bg task.
      // Realtime/polling drives all status updates.
    } catch (err) {
      console.error('[useScraperRun] runAllScrapers error:', err)
      setScraperState(prev => {
        const next = { ...prev }
        SOURCES.forEach(s => { next[s] = { ...next[s], status: 'failed' } })
        return next
      })
      setIsRunning(false)
    }
  }

  return { scraperState, runScraper, runAllScrapers, isRunning }
}
