import React, { createContext, useContext, useEffect, useState } from 'react'
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

  const fetchRole = async (userId: string) => {
    setRoleLoading(true)
    try {
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle()           // ← safe when row may not exist yet
      setRole((data?.role as UserRole) ?? 'student')
    } catch {
      setRole('student')
    } finally {
      setRoleLoading(false)
    }
  }

  useEffect(() => {
    let mounted = true

    // Initial session check
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        setSession(session)
        setUser(session?.user ?? null)
        if (session?.user) {
          fetchRole(session.user.id).catch(() => {})
        }
      })
      .finally(() => {
        setAuthLoading(false)
      })

    // Listen for subsequent auth changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return
        // Skip INITIAL_SESSION — already handled by getSession() above
        if (event === 'INITIAL_SESSION') return

        setSession(session)
        setUser(session?.user ?? null)

        if (session?.user) {
          fetchRole(session.user.id).catch(() => {})
        } else {
          setRole(null)
          setRoleLoading(false)
        }
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
    setRole(null)
  }

  // Only block render during the very first auth check (< 500ms typically)
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
