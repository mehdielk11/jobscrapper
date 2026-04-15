import { Bell, LogOut, User, ExternalLink, Sun, Moon } from 'lucide-react'
import { useAuth } from '@/context/auth-context'
import { useTheme } from '@/components/theme-provider'
import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'

/**
 * Admin topbar with notifications bell and user avatar dropdown.
 * Dropdown provides: Profile, Back to App, Sign Out actions.
 */
export function AdminTopbar() {
  const { user, signOut } = useAuth()
  const { theme, setTheme } = useTheme()
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
    <header className="h-14 flex-shrink-0 bg-background/80 backdrop-blur-md border-b border-border flex items-center justify-between px-6 sticky top-0 z-30 transition-colors duration-500">
      {/* Left: brand */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-foreground font-['Sora',sans-serif]">Admin Panel</span>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-mono border border-primary/20">
          ADMIN
        </span>
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-3">
        {/* Theme Toggle */}
        <button 
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-muted transition-colors"
        >
          <AnimatePresence mode="wait">
            {theme === 'dark' ? (
              <motion.div key="sun" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }}>
                <Sun size={16} />
              </motion.div>
            ) : (
              <motion.div key="moon" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }}>
                <Moon size={16} />
              </motion.div>
            )}
          </AnimatePresence>
        </button>

        {/* Notifications (placeholder) */}
        <button className="relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
          <Bell size={16} />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-primary" />
        </button>

        {/* Avatar dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(o => !o)}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary border border-primary/20">
              {initials}
            </div>
            <span className="text-xs text-muted-foreground max-w-[120px] truncate hidden sm:block">
              {user?.email}
            </span>
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-44 bg-card border border-border rounded-xl shadow-2xl py-1 z-50 animate-in fade-in-0 zoom-in-95 duration-150">
              <button
                onClick={() => navigate('/')}
                className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <ExternalLink size={14} />
                Home Page
              </button>
              
              <div className="border-t border-border my-1" />
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
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
