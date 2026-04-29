import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { motion } from 'framer-motion'
import { useToast } from '@/hooks/use-toast'
import { Lock, Mail, ArrowRight } from 'lucide-react'
import { useAuth } from '@/context/auth-context'
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile'

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || ''

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const captchaRef = useRef<TurnstileInstance>(null)
  const navigate = useNavigate()
  const { toast } = useToast()
  const { user, isAdmin, roleLoading } = useAuth()

  useEffect(() => {
    if (user && !roleLoading) {
      if (isAdmin) {
        navigate('/admin/dashboard')
      } else {
        navigate('/recommendations')
      }
    }
  }, [user, roleLoading, isAdmin, navigate])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
      options: { captchaToken: captchaToken ?? undefined },
    })
    captchaRef.current?.reset()
    setCaptchaToken(null)
    if (error) {
      toast({ title: "Access Denied", description: error.message, variant: "destructive" })
      setLoading(false)
    } else {
      toast({ title: "Auth Verified", description: "Identity confirmed. Redirecting to core..." })
    }
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { captchaToken: captchaToken ?? undefined },
    })
    captchaRef.current?.reset()
    setCaptchaToken(null)
    if (error) {
      toast({ title: "Registration Error", description: error.message, variant: "destructive" })
    } else {
      toast({ title: "Registration Success", description: "Node created. Verify your email or try logging in." })
    }
    setLoading(false)
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[65vh] w-full max-w-lg mx-auto py-6 px-4">
      {/* Brand Header */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="text-center space-y-2 mb-6"
      >
        <div className="w-12 h-12 rounded-2xl bg-primary/20 border border-primary/30 flex items-center justify-center mx-auto mb-2 shadow-2xl shadow-primary/20">
          <Lock className="text-primary w-6 h-6" />
        </div>
        <h1 className="text-3xl font-black tracking-tighter text-slate-950 dark:text-white">Welcome Back</h1>
        <p className="text-slate-500 font-medium text-sm">Sign in to your JobScraper account.</p>
      </motion.div>

      {/* Auth Card */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="glass-card w-full p-6 rounded-[2rem] border-white/5 shadow-3xl"
      >
        <div className="flex bg-slate-200/50 dark:bg-slate-950/50 p-1 rounded-2xl mb-6 border border-slate-200 dark:border-white/5">
          <button
            onClick={() => setMode('login')}
            className={`flex-1 py-3 text-sm font-black rounded-xl transition-all ${mode === 'login' ? 'bg-white text-slate-950 shadow-xl' : 'text-slate-500 hover:text-slate-300'}`}
          >
            Login
          </button>
          <button
            onClick={() => setMode('signup')}
            className={`flex-1 py-3 text-sm font-black rounded-xl transition-all ${mode === 'signup' ? 'bg-white text-slate-950 shadow-xl' : 'text-slate-500 hover:text-slate-300'}`}
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={mode === 'login' ? handleLogin : handleSignUp} className="space-y-6">
          <div className="space-y-4">
            <div className="relative group">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 group-focus-within:text-primary transition-colors" />
              <Input
                type="email"
                placeholder="Your email..."
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="h-14 pl-12 bg-white/50 dark:bg-slate-950/50 border border-slate-200 dark:border-white/5 focus-visible:ring-primary/40 rounded-2xl text-slate-950 dark:text-white font-medium placeholder:text-slate-500 dark:placeholder:text-slate-700"
              />
            </div>

            <div className="relative group">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 group-focus-within:text-primary transition-colors" />
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="h-14 pl-12 bg-white/50 dark:bg-slate-950/50 border border-slate-200 dark:border-white/5 focus-visible:ring-primary/40 rounded-2xl text-slate-950 dark:text-white font-medium placeholder:text-slate-500 dark:placeholder:text-slate-700"
              />
            </div>
          </div>

          {mode === 'login' && (
            <div className="flex justify-start -mt-2">
              <Link to="/reset-password" className="text-xs font-medium text-primary/70 hover:text-primary transition-colors">
                Forgot password?
              </Link>
            </div>
          )}

          {TURNSTILE_SITE_KEY && (
            <Turnstile
              ref={captchaRef}
              siteKey={TURNSTILE_SITE_KEY}
              onSuccess={setCaptchaToken}
              options={{ size: 'invisible' }}
            />
          )}

          <Button
            type="submit"
            disabled={loading || (!!TURNSTILE_SITE_KEY && !captchaToken)}
            className="w-full h-14 text-md font-black bg-primary text-white hover:opacity-90 rounded-xl shadow-2xl shadow-primary/20 atom-hover mt-2"
          >
            {loading ? (
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin" />
                Verifying...
              </div>
            ) : (
              <div className="flex items-center gap-2">
                {mode === 'login' ? 'Login' : 'Sign Up'}
                <ArrowRight className="w-5 h-5 ml-1" />
              </div>
            )}
          </Button>
        </form>
      </motion.div>

      {/* Academic Manager signup link */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="mt-4 text-center"
      >
        <p className="text-xs text-slate-500">
          Institution?{' '}
          <Link to="/academic-apply" className="font-bold text-primary hover:text-primary/80 transition-colors">
            Apply as Academic Manager →
          </Link>
        </p>
      </motion.div>
    </div>
  )
}
