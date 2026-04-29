import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  Tags,
  BarChart3,
  Settings,
  ChevronLeft,
  GraduationCap,
  Home,
} from 'lucide-react'
import { useState } from 'react'

const NAV_ITEMS = [
  { to: '/manager/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/manager/members', label: 'Members', icon: Users },
  { to: '/manager/skill-demand', label: 'Skill Demand', icon: Tags },
  { to: '/manager/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/manager/settings', label: 'Settings', icon: Settings },
]

interface ManagerSidebarProps {
  orgName: string
}

export function ManagerSidebar({ orgName }: ManagerSidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const location = useLocation()

  return (
    <aside
      className={`h-screen bg-card border-r border-border flex flex-col transition-all duration-300 flex-shrink-0 ${collapsed ? 'w-16' : 'w-56'}`}
    >
      {/* Logo */}
      <div className={`flex items-center gap-3 px-4 py-5 border-b border-border ${collapsed ? 'justify-center' : ''}`}>
        <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
          <GraduationCap size={16} className="text-emerald-500" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-xs font-bold text-foreground tracking-wide font-['Sora',sans-serif] truncate">{orgName}</p>
            <p className="text-[10px] text-muted-foreground">Academic Manager</p>
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
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              } ${collapsed ? 'justify-center' : ''}`}
            >
              <Icon size={17} className={`flex-shrink-0 ${active ? 'text-emerald-600 dark:text-emerald-400' : 'group-hover:text-foreground'}`} />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-border px-2 py-3 space-y-1">
        <button
          onClick={() => setCollapsed(c => !c)}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors ${collapsed ? 'justify-center' : ''}`}
        >
          <ChevronLeft size={14} className={`flex-shrink-0 transition-transform ${collapsed ? 'rotate-180' : ''}`} />
          {!collapsed && <span>Collapse</span>}
        </button>
        <NavLink
          to="/"
          title={collapsed ? 'Go to Landing Page' : undefined}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors ${collapsed ? 'justify-center' : ''}`}
        >
          <Home size={14} className="flex-shrink-0" />
          {!collapsed && <span>Home</span>}
        </NavLink>
      </div>
    </aside>
  )
}
