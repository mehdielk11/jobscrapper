import { Bell, LogOut, User, ExternalLink } from 'lucide-react'
import { useAuth } from '@/context/auth-context'
import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

/**
 * Admin topbar with notifications bell and user avatar dropdown.
 * Dropdown provides: Profile, Back to App, Sign Out actions.
 */
export function AdminTopbar() {
  const { user, signOut } = useAuth()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  const initials = user?.email?.[0]?.toUpperCase() ?? 'A'

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

  return (
    <header className="h-14 flex-shrink-0 bg-[#0f0f11] border-b border-white/5 flex items-center justify-between px-6">
      {/* Left: brand */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-white font-['Sora',sans-serif]">Admin Panel</span>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-mono border border-indigo-500/20">
          ADMIN
        </span>
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-3">
        {/* Notifications (placeholder) */}
        <button className="relative p-2 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-colors">
          <Bell size={16} />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-indigo-400" />
        </button>

        {/* Avatar dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(o => !o)}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-white/5 transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-indigo-500/30 flex items-center justify-center text-xs font-bold text-indigo-300 border border-indigo-500/20">
              {initials}
            </div>
            <span className="text-xs text-zinc-400 max-w-[120px] truncate hidden sm:block">
              {user?.email}
            </span>
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-44 bg-[#1a1a1f] border border-white/10 rounded-xl shadow-2xl py-1 z-50 animate-in fade-in-0 zoom-in-95 duration-150">
              <button
                onClick={() => { navigate('/account'); setDropdownOpen(false) }}
                className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-zinc-300 hover:bg-white/5 hover:text-white transition-colors"
              >
                <User size={14} className="text-zinc-500" />
                Profile
              </button>
              <button
                onClick={() => { navigate('/'); setDropdownOpen(false) }}
                className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-zinc-300 hover:bg-white/5 hover:text-white transition-colors"
              >
                <ExternalLink size={14} className="text-zinc-500" />
                Back to App
              </button>
              <div className="border-t border-white/5 my-1" />
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <LogOut size={14} />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
