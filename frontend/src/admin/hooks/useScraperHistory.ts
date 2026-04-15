import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export interface ScraperRun {
  id: string
  source: string
  status: 'running' | 'success' | 'failed' | 'rate-limited'
  jobs_found: number
  jobs_saved: number
  error_message: string | null
  started_at: string
  finished_at: string | null
}

export interface ScraperLog {
  id: string
  run_id: string
  level: 'INFO' | 'WARNING' | 'ERROR'
  message: string
  created_at: string
}

export function useScraperHistory(source?: string) {
  const [history, setHistory] = useState<ScraperRun[]>([])
  const [loading, setLoading] = useState(true)

  const fetchHistory = async () => {
    setLoading(true)
    let query = supabase
      .from('scraper_runs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(20)

    if (source) {
      query = query.eq('source', source)
    }

    const { data } = await query
    setHistory(data || [])
    setLoading(false)
  }

  const getRunLogs = async (runId: string): Promise<ScraperLog[]> => {
    const { data } = await supabase
      .from('scraper_logs')
      .select('*')
      .eq('run_id', runId)
      .order('created_at', { ascending: true })
    
    return data || []
  }

  useEffect(() => {
    fetchHistory()
  }, [source])

  return { history, loading, fetchHistory, getRunLogs }
}
