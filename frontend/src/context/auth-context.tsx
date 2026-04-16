import React, { createContext, useContext, useEffect, useState, useRef } from 'react'
import { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

export type UserRole = 'student' | 'admin'

interface AuthContextType {
  session: Session | null
  user: User | null
  role: UserRole | null
  isAdmin: boolean
  roleLoading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  role: null,
  isAdmin: false,
  roleLoading: false,
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [role, setRole] = useState<UserRole | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [roleLoading, setRoleLoading] = useState(false)

  // Track which user ID we've already resolved a role for.
  // Prevents re-fetching (and flashing the spinner) on TOKEN_REFRESH or tab-focus
  // events where the identity hasn't changed.
  const resolvedRoleForRef = useRef<string | null>(null)
  const userRef = useRef<User | null>(null)

  useEffect(() => {
    userRef.current = user
  }, [user])

  const fetchRole = async (userId: string) => {
    // Skip if we already have the role for this exact user ID
    if (resolvedRoleForRef.current === userId) return

    setRoleLoading(true)
    try {
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle()
      setRole((data?.role as UserRole) ?? 'student')
      // Mark this user ID as resolved so we never re-fetch unnecessarily
      resolvedRoleForRef.current = userId
    } catch {
      setRole('student')
      resolvedRoleForRef.current = userId
    } finally {
      setRoleLoading(false)
    }
  }

  /**
   * Silently verifies the session is still alive — called periodically.
   * Does NOT re-fetch the role (it's already cached in `resolvedRoleForRef`).
   * Only signs out if the account has been deleted on the server.
   */
  const checkSessionIntegrity = async () => {
    const currentUser = userRef.current
    if (!currentUser) return

    try {
      const { data, error } = await supabase.auth.getUser()
      if (error || !data.user) {
        console.warn('Session integrity check failed: signing out.')
        await signOut()
      }
      // User still valid → do nothing (role is already set)
    } catch (err) {
      console.error('Session check error:', err)
    }
  }

  useEffect(() => {
    let mounted = true

    // Initial session hydration — runs once
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        setSession(session)
        setUser(session?.user ?? null)
        if (session?.user) {
          fetchRole(session.user.id).catch(() => {})
        }
      })
      .finally(() => {
        if (mounted) setAuthLoading(false)
      })

    // Listen for auth changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return

        // Already handled by getSession() above
        if (event === 'INITIAL_SESSION') return

        // TOKEN_REFRESH and USER_UPDATED don't change identity — skip role re-fetch
        if (event === 'TOKEN_REFRESH' || event === 'USER_UPDATED') {
          setSession(session)
          return
        }

        setSession(session)
        setUser(session?.user ?? null)

        if (session?.user) {
          // fetchRole is a no-op if role already resolved for this user
          fetchRole(session.user.id).catch(() => {})
        } else {
          // Signed out — clear everything
          setRole(null)
          setRoleLoading(false)
          resolvedRoleForRef.current = null
        }
      }
    )

    // Periodic integrity check (every 5 min is sufficient — no role re-fetch)
    const interval = setInterval(checkSessionIntegrity, 300000)

    // On tab focus: ONLY check session integrity, never re-fetch role.
    // The previous implementation called fetchRole on focus which set
    // roleLoading=true and caused "VERIFYING ADMIN ACCESS..." on every tab switch.
    const onFocus = () => checkSessionIntegrity()
    window.addEventListener('focus', onFocus)

    return () => {
      mounted = false
      subscription.unsubscribe()
      clearInterval(interval)
      window.removeEventListener('focus', onFocus)
    }
  }, [])

  const signOut = async () => {
    resolvedRoleForRef.current = null
    await supabase.auth.signOut()
    setRole(null)
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f0f11]">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <AuthContext.Provider value={{
      session,
      user,
      role,
      isAdmin: role === 'admin',
      roleLoading,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
