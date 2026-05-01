import { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react'
import { Recommendation } from '@/lib/types'
import { getRecommendations } from '@/lib/api'
import { supabase } from '@/lib/supabase'

interface RecommendationsState {
  data: Recommendation[]
  totalScanned: number
  loading: boolean
  loaded: boolean
  error: string | null
  userId: string | null
  filters?: { diploma?: string; datePostedGte?: string }
}

interface RecommendationsContextValue extends RecommendationsState {
  /** Fetch only if cache is empty or user/filters changed. force=true always re-fetches. */
  fetchIfNeeded: (userId: string, filters?: { diploma?: string; datePostedGte?: string }, force?: boolean) => Promise<void>
  /** Clear cache (e.g. on logout) */
  clear: () => void
  /** Invalidate cache (e.g. on profile update) */
  invalidateCache: () => void
}

const defaultState: RecommendationsState = {
  data: [],
  totalScanned: 0,
  loading: false,
  loaded: false,
  error: null,
  userId: null,
}

const RecommendationsContext = createContext<RecommendationsContextValue | null>(null)

export function RecommendationsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<RecommendationsState>(defaultState)

  /**
   * Use a ref to always read the latest state inside the callback without
   * including it in the dependency array. This gives fetchIfNeeded a stable
   * reference (deps = []) while still seeing fresh values — avoiding the
   * stale-closure bug that comes from [state.loaded, state.userId] deps.
   */
  const stateRef = useRef(state)
  stateRef.current = state

  /** Tracks an in-flight fetch to prevent concurrent duplicate requests. */
  const fetchingRef = useRef(false)

  const fetchIfNeeded = useCallback(async (userId: string, filters?: { diploma?: string; datePostedGte?: string }, force = false) => {
    const { loaded, userId: cachedUserId, filters: cachedFilters } = stateRef.current

    const filtersChanged = JSON.stringify(filters) !== JSON.stringify(cachedFilters)

    // Skip if cache is warm for this user and not forced
    if (!force && loaded && cachedUserId === userId && !filtersChanged) return

    // Prevent concurrent requests
    if (fetchingRef.current) return
    fetchingRef.current = true

    setState(prev => ({ ...prev, loading: true, error: null, filters }))
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('No active session')
      
      const res = await getRecommendations(userId, session.access_token, filters?.diploma, filters?.datePostedGte)
      setState({
        data: res.recommendations || [],
        totalScanned: res.total_scanned || 0,
        loading: false,
        loaded: true,
        error: null,
        userId,
        filters,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load recommendations'
      setState(prev => ({ ...prev, loading: false, error: message }))
    } finally {
      fetchingRef.current = false
    }
  }, []) // stable — reads state via ref, not closure

  const clear = useCallback(() => {
    setState(defaultState)
  }, [])

  const invalidateCache = useCallback(() => {
    setState(prev => ({ ...prev, loaded: false }))
  }, [])

  return (
    <RecommendationsContext.Provider value={{ ...state, fetchIfNeeded, clear, invalidateCache }}>
      {children}
    </RecommendationsContext.Provider>
  )
}

export function useRecommendations() {
  const ctx = useContext(RecommendationsContext)
  if (!ctx) throw new Error('useRecommendations must be used within RecommendationsProvider')
  return ctx
}
