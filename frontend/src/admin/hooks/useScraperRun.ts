import { useState, useEffect, useRef } from 'react'
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

/**
 * Manages scraper execution state and triggers.
 *
 * - On mount: loads last run state from `scraper_runs` table.
 * - Subscribes to Supabase Realtime on `scraper_runs` for live status updates.
 * - `isRunning` stays true as long as any scraper has status === 'running' in DB,
 *   so the UI accurately reflects backend progress without polling.
 */
export function useScraperRun(): UseScraperRunResult {
  const [scraperState, setScraperState] = useState<ScraperState>(
    Object.fromEntries(
      SOURCES.map(s => [s, { status: 'idle' as ScraperStatus, jobsFound: 0, lastRun: null }])
    )
  )
  const [isRunning, setIsRunning] = useState(false)
  // Track optimistic local "running" sources (set immediately on click)
  const localRunningRef = useRef<Set<string>>(new Set())

  // ── Initial load ───────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchInitialState = async () => {
      const { data: runs } = await supabase
        .from('scraper_runs')
        .select('source, status, jobs_found, started_at')
        .order('started_at', { ascending: false })

      if (runs && runs.length > 0) {
        setScraperState(prev => {
          const next = { ...prev }
          const seen = new Set<string>()
          for (const run of runs) {
            if (SOURCES.includes(run.source) && !seen.has(run.source)) {
              next[run.source] = {
                status: run.status as ScraperStatus,
                jobsFound: run.jobs_found ?? 0,
                lastRun: run.started_at,
              }
              seen.add(run.source)
            }
            if (seen.size === SOURCES.length) break
          }
          return next
        })

        // If any run is still 'running' in DB, reflect that in the UI
        const hasRunning = runs.some(r => r.status === 'running' && SOURCES.includes(r.source))
        if (hasRunning) setIsRunning(true)
      }
    }

    fetchInitialState()
  }, [])

  // ── Realtime subscription on scraper_runs ─────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel('scraper_runs_live')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'scraper_runs',
        },
        (payload) => {
          const row = (payload.new ?? payload.old) as {
            source: string
            status: string
            jobs_found: number
            started_at: string
          } | null

          if (!row || !SOURCES.includes(row.source)) return

          setScraperState(prev => ({
            ...prev,
            [row.source]: {
              status: row.status as ScraperStatus,
              jobsFound: row.jobs_found ?? 0,
              lastRun: row.started_at,
            },
          }))

          // Recalculate isRunning from latest server state
          setScraperState(current => {
            const anyRunning =
              Object.values(current).some(s => s.status === 'running') ||
              localRunningRef.current.size > 0
            setIsRunning(anyRunning)
            return current
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // ── Helpers ────────────────────────────────────────────────────────────────
  const updateState = (source: string, patch: Partial<ScraperStateEntry>) => {
    setScraperState(prev => ({
      ...prev,
      [source]: { ...prev[source], ...patch },
    }))
  }

  // ── Run single scraper ─────────────────────────────────────────────────────
  const runScraper = async (source: string, limit: number, dryRun: boolean) => {
    // Optimistic UI update
    updateState(source, { status: 'running' })
    localRunningRef.current.add(source)
    setIsRunning(true)

    const { data: run } = await supabase
      .from('scraper_runs')
      .insert({ source, status: 'running', jobs_found: 0, jobs_saved: 0 })
      .select()
      .single()

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Authentication session lost.')

      const url = `/api/scrape/${source}?token=${session.access_token}&limit=${limit}&dry_run=${dryRun}${run?.id ? `&run_id=${run.id}` : ''}`
      const response = await fetch(url, { method: 'POST' })
      const data = await response.json()

      // API now returns immediately (background task) — don't read jobs_found from response
      if (!response.ok) {
        const status = response.status === 429 ? 'rate-limited' : 'failed'
        updateState(source, { status, lastRun: new Date().toISOString() })
        if (run?.id) {
          await supabase.from('scraper_runs').update({
            status,
            error_message: data.detail ?? 'Unknown error',
            finished_at: new Date().toISOString(),
          }).eq('id', run.id)
        }
      }
      // On success: scraper runs in background — realtime subscription will
      // update the status once the backend writes to scraper_runs.
    } catch (err) {
      updateState(source, { status: 'failed', lastRun: new Date().toISOString() })
      if (run?.id) {
        await supabase.from('scraper_runs').update({
          status: 'failed',
          error_message: String(err),
          finished_at: new Date().toISOString(),
        }).eq('id', run.id)
      }
    } finally {
      localRunningRef.current.delete(source)
      const anyRunning =
        Object.values(scraperState).some(s => s.status === 'running') ||
        localRunningRef.current.size > 0
      if (!anyRunning) setIsRunning(false)
    }
  }

  // ── Run all scrapers ───────────────────────────────────────────────────────
  const runAllScrapers = async (limit: number, dryRun: boolean) => {
    // Optimistic: mark all as running immediately
    SOURCES.forEach(s => {
      updateState(s, { status: 'running' })
      localRunningRef.current.add(s)
    })
    setIsRunning(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Auth session lost.')

      const url = `/api/scrape/run?token=${session.access_token}&limit=${limit}&dry_run=${dryRun}`
      const response = await fetch(url, { method: 'POST' })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.detail || 'Failed to start pipeline')
      }

      // Background task started — realtime subscription drives all status updates.
      // Do NOT set isRunning=false here; it will be cleared by the subscription
      // once all scrapers finish.
    } catch (err) {
      console.error('Run All error:', err)
      SOURCES.forEach(s => updateState(s, { status: 'failed' }))
      setIsRunning(false)
    } finally {
      localRunningRef.current.clear()
    }
  }

  return { scraperState, runScraper, runAllScrapers, isRunning }
}
