import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/auth-context'

interface UseAdminGuardResult {
  isAdmin: boolean
  isLoading: boolean
}

/**
 * Guards admin routes by checking the user's role.
 * Redirects to '/' immediately if the user is not an admin.
 * While the role is loading, returns isLoading=true — never flashes content.
 */
export function useAdminGuard(): UseAdminGuardResult {
  const { user, role } = useAuth()
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Still resolving auth state
    if (role === null && user !== null) return

    // Not logged in at all
    if (!user) {
      navigate('/', { replace: true })
      return
    }

    // Role resolved — check if admin
    if (role !== null) {
      if (role !== 'admin') {
        navigate('/', { replace: true })
      } else {
        setIsLoading(false)
      }
    }
  }, [user, role, navigate])

  // If role resolved to admin and user exists
  useEffect(() => {
    if (role === 'admin' && user) {
      setIsLoading(false)
    }
  }, [role, user])

  return { isAdmin: role === 'admin', isLoading }
}
