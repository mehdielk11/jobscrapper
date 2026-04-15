import { Navigate } from 'react-router-dom'
import { useAuth } from '@/context/auth-context'

interface AdminGuardProps {
  children: React.ReactNode
}

/**
 * AdminGuard — checks auth + role before rendering admin routes.
 * - authLoading handled by AuthProvider (shows full-page spinner there)
 * - roleLoading handled here (shows its own spinner so admin users don't get
 *   bounced to / during the brief role-fetch window after login)
 */
export function AdminGuard({ children }: AdminGuardProps) {
  const { user, isAdmin, roleLoading } = useAuth()

  // Still fetching the role from Supabase — hold here
  if (roleLoading) {
    return (
      <div className="min-h-screen bg-[#0f0f11] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-zinc-600 font-mono">Verifying admin access...</p>
        </div>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  if (!isAdmin) return <Navigate to="/" replace />

  return <>{children}</>
}
