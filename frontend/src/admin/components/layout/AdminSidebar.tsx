import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Bot,
  Briefcase,
  Users,
  Tags,
  BarChart3,
  Settings,
  ArrowLeft,
  ChevronLeft,
  Shield,
  Home,
} from 'lucide-react'
import { useState } from 'react'

const NAV_ITEMS = [
  { to: '/admin/dashboard', label: 'Platform Overview', icon: LayoutDashboard },
  { to: '/admin/scrapers', label: 'Scrapers', icon: Bot },
  { to: '/admin/jobs', label: 'Jobs', icon: Briefcase },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/skills', label: 'Skill Demand', icon: Tags },
  { to: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
]

/**
 * Admin sidebar with collapsible icon-only mode on narrow screens.
 * Active routes are highlighted with the indigo accent.
 */
export function AdminSidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const location = useLocation()

  return (
    <aside
      className={`h-screen bg-[#0f0f11] border-r border-white/5 flex flex-col transition-all duration-300 flex-shrink-0 ${collapsed ? 'w-16' : 'w-56'}`}
    >
      {/* Logo */}
      <div className={`flex items-center gap-3 px-4 py-5 border-b border-white/5 ${collapsed ? 'justify-center' : ''}`}>
        <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
          <Shield size={16} className="text-indigo-400" />
        </div>
        {!collapsed && (
          <div>
            <p className="text-xs font-bold text-white tracking-wide font-['Sora',sans-serif]">ADMIN</p>
            <p className="text-[10px] text-zinc-600">JobFind Platform</p>
          </div>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 py-4 space-y-0.5 px-2 overflow-y-auto">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => {
          const active = location.pathname.startsWith(to)
          return (
            <NavLink
              key={to}
              to={to}
              title={collapsed ? label : undefined}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150 group ${
                active
                  ? 'bg-indigo-500/15 text-indigo-300 font-medium'
                  : 'text-zinc-500 hover:text-zinc-200 hover:bg-white/5'
              } ${collapsed ? 'justify-center' : ''}`}
            >
              <Icon size={17} className={`flex-shrink-0 ${active ? 'text-indigo-400' : 'group-hover:text-zinc-300'}`} />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-white/5 px-2 py-3 space-y-0.5">
        <NavLink
          to="/"
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-zinc-500 hover:text-zinc-200 hover:bg-white/5 transition-all ${collapsed ? 'justify-center' : ''}`}
        >
          <Home size={17} className="flex-shrink-0" />
          {!collapsed && <span>Home Page</span>}
        </NavLink>

        <button
          onClick={() => setCollapsed(c => !c)}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs text-zinc-600 hover:text-zinc-400 hover:bg-white/5 transition-colors ${collapsed ? 'justify-center' : ''}`}
        >
          <ChevronLeft size={14} className={`flex-shrink-0 transition-transform ${collapsed ? 'rotate-180' : ''}`} />
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  )
}
