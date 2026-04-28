import { Navigate } from 'react-router-dom'
import { useAuth } from '@/context/auth-context'

interface ManagerGuardProps {
  children: React.ReactNode
}

/**
 * ManagerGuard — checks auth + academic_manager role before rendering manager routes.
 */
export function ManagerGuard({ children }: ManagerGuardProps) {
  const { user, isAcademicManager, roleLoading } = useAuth()

  if (roleLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">Verifying access...</p>
        </div>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  if (!isAcademicManager) return <Navigate to="/" replace />

  return <>{children}</>
}
