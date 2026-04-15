import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export type ScraperStatus = 'idle' | 'running' | 'success' | 'failed' | 'rate-limited'

interface ScraperState {
  [source: string]: {
    status: ScraperStatus
    jobsFound: number
    lastRun: string | null
  }
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
 * Calls the backend API to run scrapers and records results in scraper_runs table.
 */
export function useScraperRun(): UseScraperRunResult {
  const [scraperState, setScraperState] = useState<ScraperState>(
    Object.fromEntries(SOURCES.map(s => [s, { status: 'idle' as ScraperStatus, jobsFound: 0, lastRun: null }]))
  )
  const [isRunning, setIsRunning] = useState(false)

  const updateState = (source: string, patch: Partial<ScraperState[string]>) => {
    setScraperState(prev => ({
      ...prev,
      [source]: { ...prev[source], ...patch },
    }))
  }

  const runScraper = async (source: string, limit: number, dryRun: boolean) => {
    updateState(source, { status: 'running' })
    setIsRunning(true)

    // Record run start
    const { data: run } = await supabase
      .from('scraper_runs')
      .insert({ source, status: 'running', jobs_found: 0, jobs_saved: 0 })
      .select()
      .single()

    try {
      const url = `/api/scrape/${source}?limit=${limit}&dry_run=${dryRun}${run?.id ? `&run_id=${run.id}` : ''}`
      const response = await fetch(url, {
        method: 'POST',
      })
      const data = await response.json()

      if (response.ok) {
        const jobsFound = data.jobs_found ?? 0
        updateState(source, { status: 'success', jobsFound, lastRun: new Date().toISOString() })

        if (run?.id) {
          await supabase.from('scraper_runs').update({
            status: 'success',
            jobs_found: jobsFound,
            jobs_saved: dryRun ? 0 : jobsFound,
            finished_at: new Date().toISOString(),
          }).eq('id', run.id)
        }
      } else {
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
      setIsRunning(false)
    }
  }

  const runAllScrapers = async (limit: number, dryRun: boolean) => {
    setIsRunning(true)
    await Promise.allSettled(SOURCES.map(s => runScraper(s, limit, dryRun)))
    setIsRunning(false)
  }

  return { scraperState, runScraper, runAllScrapers, isRunning }
}
