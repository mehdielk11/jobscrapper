import { Outlet, Link, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/auth-context'
import { LogOut, Home, User, Star, LayoutGrid, Settings, Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { motion, AnimatePresence } from 'framer-motion'

export default function Layout() {
  const { user, signOut } = useAuth()
  const location = useLocation()

  const navItems = [
    { path: '/', label: 'Overview', icon: Home },
    ...(user ? [
      { path: '/recommendations', label: 'Discovery', icon: Star },
      { path: '/profile', label: 'Intelligence', icon: User },
    ] : [
      { path: '/login', label: 'Access', icon: User },
    ])
  ]

  return (
    <div className="min-h-screen bg-background flex flex-col items-center">
      {/* Floating Contextual Header */}
      <nav className="fixed top-6 z-50 px-4 w-full flex justify-center pointer-events-none">
        <motion.div 
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="nav-glass rounded-2xl px-2 py-1.5 flex items-center gap-1 shadow-2xl pointer-events-auto max-w-fit"
        >
          {/* Brand/Logo */}
          <div className="px-3 flex items-center gap-2 border-r border-white/10 mr-1">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
              <LayoutGrid className="text-primary-foreground w-5 h-5" />
            </div>
            <span className="font-extrabold tracking-tighter text-sm hidden sm:block">JS.PRO</span>
          </div>

          {/* Navigation Links */}
          <div className="flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path
              return (
                <Link 
                  key={item.path} 
                  to={item.path}
                  className="relative px-4 py-2 text-sm font-bold transition-all rounded-xl group overflow-hidden"
                >
                  <span className={`relative z-10 flex items-center gap-2 transition-colors ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'}`}>
                    <item.icon className="w-4 h-4" />
                    <span className="hidden md:block">{item.label}</span>
                  </span>
                  {isActive && (
                    <motion.div 
                      layoutId="active-pill"
                      className="absolute inset-0 bg-white/10 z-0"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                </Link>
              )
            })}
          </div>

          {/* User Section / Action */}
          <div className="flex items-center gap-1 ml-1 border-l border-white/10 pl-1">
            {user ? (
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="rounded-xl text-slate-400 hover:text-white">
                  <Bell className="w-4 h-4" />
                </Button>
                <div className="w-8 h-8 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center text-[10px] font-black mr-1">
                  {user.email?.[0].toUpperCase()}
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={signOut}
                  className="rounded-xl text-rose-400/70 hover:text-rose-400 hover:bg-rose-400/10"
                >
                  <LogOut className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <Link to="/login">
                <Button size="sm" className="rounded-xl font-bold bg-white text-slate-950 hover:bg-slate-200 ml-2">
                  Get Started
                </Button>
              </Link>
            )}
          </div>
        </motion.div>
      </nav>

      {/* Main Content Area */}
      <main className="w-full pt-28 pb-32 px-4 flex flex-col items-center">
        <div className="w-full max-w-6xl">
          <Outlet />
        </div>
      </main>

      {/* Mini Footer / Bottom Blur */}
      <div className="fixed bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent pointer-events-none z-10" />
    </div>
  )
}
