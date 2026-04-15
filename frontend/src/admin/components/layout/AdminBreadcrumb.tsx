import { useLocation, Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'

const LABELS: Record<string, string> = {
  admin: 'Admin',
  dashboard: 'Dashboard',
  scrapers: 'Scrapers',
  jobs: 'Jobs',
  users: 'Users',
  skills: 'Skills',
  analytics: 'Analytics',
  settings: 'Settings',
}

/**
 * Auto-generated breadcrumb from the current React Router location.
 * Renders "Admin > Scrapers" style trail.
 */
export function AdminBreadcrumb() {
  const { pathname } = useLocation()
  const segments = pathname.split('/').filter(Boolean)

  return (
    <nav className="flex items-center gap-1.5 text-xs text-zinc-600 mb-6" aria-label="Breadcrumb">
      {segments.map((segment, i) => {
        const path = '/' + segments.slice(0, i + 1).join('/')
        const isLast = i === segments.length - 1
        const label = LABELS[segment] ?? segment

        return (
          <span key={path} className="flex items-center gap-1.5">
            {i > 0 && <ChevronRight size={11} />}
            {isLast ? (
              <span className="text-zinc-300 font-medium">{label}</span>
            ) : (
              <Link to={path} className="hover:text-zinc-400 transition-colors">{label}</Link>
            )}
          </span>
        )
      })}
    </nav>
  )
}
