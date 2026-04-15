import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export interface AppConfig {
  scraper_limit_per_source: number
  scraper_delay_seconds: number
  nlp_confidence_threshold: number
  auto_run_nlp: boolean
  allow_registrations: boolean
  nlp_language: 'french' | 'english' | 'both'
}

const DEFAULTS: AppConfig = {
  scraper_limit_per_source: 30,
  scraper_delay_seconds: 1.5,
  nlp_confidence_threshold: 0.5,
  auto_run_nlp: true,
  allow_registrations: true,
  nlp_language: 'both',
}

interface UseAppConfigResult {
  config: AppConfig
  loading: boolean
  saving: boolean
  updateConfig: (key: keyof AppConfig, value: AppConfig[keyof AppConfig]) => void
  saveConfig: () => Promise<void>
}

/**
 * Reads and writes the app_config table in Supabase.
 * Config is stored as key-value pairs with JSONB values.
 */
export function useAppConfig(): UseAppConfigResult {
  const [config, setConfig] = useState<AppConfig>(DEFAULTS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const { data, error } = await supabase.from('app_config').select('key, value')
        if (error || !data) return
        const merged: Partial<AppConfig> = {}
        for (const row of data) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ;(merged as any)[row.key] = row.value
        }
        setConfig({ ...DEFAULTS, ...merged })
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const updateConfig = useCallback((key: keyof AppConfig, value: AppConfig[keyof AppConfig]) => {
    setConfig(prev => ({ ...prev, [key]: value }))
  }, [])

  const saveConfig = useCallback(async () => {
    setSaving(true)
    try {
      const upserts = Object.entries(config).map(([key, value]) => ({
        key,
        value,
        updated_at: new Date().toISOString(),
      }))
      await supabase.from('app_config').upsert(upserts, { onConflict: 'key' })
    } finally {
      setSaving(false)
    }
  }, [config])

  return { config, loading, saving, updateConfig, saveConfig }
}
