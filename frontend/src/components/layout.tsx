import { Outlet, Link } from 'react-router-dom'
import { useAuth } from '@/context/auth-context'
import { LogOut, Home, User, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function Layout() {
  const { user, signOut } = useAuth()

  return (
    <div className="flex min-h-screen">
      {/* Sidebar navigation */}
      <nav className="w-64 border-r border-border bg-slate-50 flex flex-col p-4 dark:bg-slate-900">
        <div className="mb-8 p-2">
          <h1 className="text-xl font-bold flex items-center gap-2 text-primary">
            💼 JobRecommender
          </h1>
        </div>

        <div className="flex flex-col gap-2 flex-grow">
          <Link to="/" className="flex items-center gap-2 p-2 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors">
            <Home size={20} />
            Home
          </Link>

          {user ? (
            <>
              <Link to="/profile" className="flex items-center gap-2 p-2 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors">
                <User size={20} />
                Profile
              </Link>
              <Link to="/recommendations" className="flex items-center gap-2 p-2 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors">
                <Star size={20} />
                Recommendations
              </Link>
            </>
          ) : (
            <Link to="/login" className="flex items-center gap-2 p-2 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors">
              <User size={20} />
              Login
            </Link>
          )}
        </div>

        {user && (
          <div className="mt-auto border-t pt-4">
            <p className="text-sm text-muted-foreground mb-4 truncate text-center">User: {user.email}</p>
            <Button variant="ghost" className="w-full flex justify-center items-center gap-2 text-destructive" onClick={signOut}>
              <LogOut size={16} /> Sign out
            </Button>
          </div>
        )}
      </nav>

      {/* Main Content Content */}
      <main className="flex-1 p-8 overflow-y-auto w-full">
        <Outlet />
      </main>
    </div>
  )
}
