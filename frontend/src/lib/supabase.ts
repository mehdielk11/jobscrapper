import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables")
}

/**
 * Snapshot the URL hash BEFORE createClient processes it.
 * Supabase auto-detects hash fragments (access_token, type=recovery, etc.)
 * and strips them from the URL. This is the only reliable capture point.
 */
export const INITIAL_URL_HASH = window.location.hash

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
