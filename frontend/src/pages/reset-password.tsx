import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase, INITIAL_URL_HASH } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { motion } from 'framer-motion'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/context/auth-context'
import { Mail, Lock, ArrowRight, ArrowLeft, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react'

/**
 * Parse a hash string into a key-value map.
 */
function parseHash(raw: string): Record<string, string> {
  const hash = raw.startsWith('#') ? raw.substring(1) : raw
  if (!hash) return {}
  const params: Record<string, string> = {}
  for (const part of hash.split('&')) {
    const [key, ...rest] = part.split('=')
    if (key) params[key] = decodeURIComponent(rest.join('='))
  }
  return params
}

/** Human-readable error messages for Supabase error codes */
function getErrorMessage(code: string, description: string): string {
  switch (code) {
    case 'otp_expired':
      return 'This password reset link has expired. Please request a new one.'
    case 'access_denied':
      return description || 'Access was denied. The link may have already been used.'
    default:
      return description || 'This link is invalid or has expired.'
  }
}

/** Check if the initial page load had a recovery hash (before Supabase cleared it) */
const INITIAL_HASH_PARAMS = parseHash(INITIAL_URL_HASH)
const ARRIVED_VIA_RECOVERY = INITIAL_HASH_PARAMS.type === 'recovery' && !!INITIAL_HASH_PARAMS.access_token
const ARRIVED_WITH_ERROR = !!INITIAL_HASH_PARAMS.error || !!INITIAL_HASH_PARAMS.error_code

export default function ResetPassword() {
  const [email, setEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [recoveryMode, setRecoveryMode] = useState(false)
  const [errorState, setErrorState] = useState<{ title: string; message: string } | null>(null)
  const [initializing, setInitializing] = useState(true)
  const navigate = useNavigate()
  const { toast } = useToast()
  const { user } = useAuth()

  useEffect(() => {
    const init = async () => {
      // ── PRIORITY 1: Check for errors in the initial hash ──────────
      if (ARRIVED_WITH_ERROR) {
        const code = INITIAL_HASH_PARAMS.error_code || INITIAL_HASH_PARAMS.error || ''
        const desc = (INITIAL_HASH_PARAMS.error_description || '').replace(/\+/g, ' ')
        setErrorState({
          title: code === 'otp_expired' ? 'Link Expired' : 'Invalid Link',
          message: getErrorMessage(code, desc),
        })
        setInitializing(false)
        return
      }

      // ── PRIORITY 2: Arrived via a valid recovery link ─────────────
      if (ARRIVED_VIA_RECOVERY) {
        // Give Supabase a moment to process the hash and establish the session
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          setRecoveryMode(true)
        } else {
          setErrorState({
            title: 'Session Expired',
            message: 'Your recovery session could not be established. Please request a new reset link.',
          })
        }
        setInitializing(false)
        return
      }

      // ── PRIORITY 3: Normal navigation (no recovery hash) ──────────
      // Block authenticated users who navigated here directly
      if (user) {
        navigate('/', { replace: true })
        return
      }

      // ── DEFAULT: Show the "request reset" form ────────────────────
      setInitializing(false)
    }

    // Fallback: listen for PASSWORD_RECOVERY event
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setRecoveryMode(true)
        setInitializing(false)
      }
    })

    init()

    return () => subscription.unsubscribe()
  }, [user, navigate])

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } else {
      setEmailSent(true)
    }
    setLoading(false)
  }

  const handleSetNewPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword.length < 6) {
      toast({ title: 'Error', description: 'Password must be at least 6 characters', variant: 'destructive' })
      return
    }
    if (newPassword !== confirmPassword) {
      toast({ title: 'Error', description: 'Passwords do not match', variant: 'destructive' })
      return
    }
    setLoading(true)

    // Final session check before updating
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      setErrorState({
        title: 'Session Expired',
        message: 'Your recovery session has expired. Please request a new reset link.',
      })
      setLoading(false)
      return
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } else {
      toast({ title: 'Success', description: 'Password updated. Redirecting to login...' })
      // Clean the hash to prevent re-use
      window.history.replaceState(null, '', window.location.pathname)
      await supabase.auth.signOut()
      setTimeout(() => navigate('/login', { replace: true }), 1500)
    }
    setLoading(false)
  }

  // ── Loading state while initializing ──────────────────────────────
  if (initializing) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // ── Error state (expired link, invalid OTP, etc.) ─────────────────
  if (errorState) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] w-full max-w-lg mx-auto py-12 px-4">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center space-y-6"
        >
          <div className="w-16 h-16 rounded-2xl bg-red-500/20 border border-red-500/30 flex items-center justify-center mx-auto shadow-2xl shadow-red-500/20">
            {errorState.title === 'Link Expired' ? (
              <AlertTriangle className="text-red-500 w-8 h-8" />
            ) : (
              <XCircle className="text-red-500 w-8 h-8" />
            )}
          </div>
          <h1 className="text-3xl font-black tracking-tighter text-slate-950 dark:text-white">{errorState.title}</h1>
          <p className="text-slate-500 font-medium max-w-sm mx-auto">
            {errorState.message}
          </p>
          <div className="flex flex-col items-center gap-3 pt-4">
            <Link
              to="/reset-password"
              onClick={(e) => {
                e.preventDefault()
                // Clear the hash and reload cleanly
                window.history.replaceState(null, '', '/reset-password')
                setErrorState(null)
                setRecoveryMode(false)
                setInitializing(false)
              }}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-primary text-white font-bold text-sm hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
            >
              <Mail className="w-4 h-4" />
              Request New Link
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 text-sm font-bold text-primary/70 hover:text-primary transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to login
            </Link>
          </div>
        </motion.div>
      </div>
    )
  }

  // ── Phase 2: Set new password (valid recovery session) ────────────
  if (recoveryMode) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] w-full max-w-lg mx-auto py-12 px-4">
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="text-center space-y-4 mb-12"
        >
          <div className="w-16 h-16 rounded-2xl bg-primary/20 border border-primary/30 flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-primary/20">
            <Lock className="text-primary w-8 h-8" />
          </div>
          <h1 className="text-4xl font-black tracking-tighter text-slate-950 dark:text-white">Set New Password</h1>
          <p className="text-slate-500 font-medium">Enter your new password below.</p>
        </motion.div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="glass-card w-full p-10 rounded-[2.5rem] border-white/5 shadow-3xl"
        >
          <form onSubmit={handleSetNewPassword} className="space-y-6">
            <div className="space-y-4">
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 group-focus-within:text-primary transition-colors" />
                <Input
                  type="password"
                  placeholder="New password (min 6 characters)"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                  className="h-14 pl-12 bg-white/50 dark:bg-slate-950/50 border border-slate-200 dark:border-white/5 focus-visible:ring-primary/40 rounded-2xl text-slate-950 dark:text-white font-medium placeholder:text-slate-500 dark:placeholder:text-slate-700"
                />
              </div>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 group-focus-within:text-primary transition-colors" />
                <Input
                  type="password"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                  className={`h-14 pl-12 bg-white/50 dark:bg-slate-950/50 border focus-visible:ring-primary/40 rounded-2xl text-slate-950 dark:text-white font-medium placeholder:text-slate-500 dark:placeholder:text-slate-700 ${
                    confirmPassword && confirmPassword !== newPassword ? 'border-red-500/50' : 'border-slate-200 dark:border-white/5'
                  }`}
                />
              </div>
              {confirmPassword && confirmPassword !== newPassword && (
                <p className="text-xs text-red-500 font-bold pl-1">Passwords do not match</p>
              )}
            </div>

            <Button
              type="submit"
              disabled={loading || !newPassword || !confirmPassword || newPassword !== confirmPassword}
              className="w-full h-16 text-md font-black bg-primary text-white hover:opacity-90 rounded-2xl shadow-2xl shadow-primary/20 atom-hover mt-4 disabled:opacity-40"
            >
              {loading ? (
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin" />
                  Updating...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  Update Password
                  <ArrowRight className="w-5 h-5 ml-1" />
                </div>
              )}
            </Button>
          </form>
        </motion.div>
      </div>
    )
  }

  // ── Phase 1b: Email sent confirmation ─────────────────────────────
  if (emailSent) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] w-full max-w-lg mx-auto py-12 px-4">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center space-y-6"
        >
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto shadow-2xl shadow-emerald-500/20">
            <CheckCircle2 className="text-emerald-500 w-8 h-8" />
          </div>
          <h1 className="text-3xl font-black tracking-tighter text-slate-950 dark:text-white">Check Your Email</h1>
          <p className="text-slate-500 font-medium max-w-sm mx-auto">
            We've sent a password reset link to <span className="font-bold text-slate-700 dark:text-slate-300">{email}</span>. Click the link to set a new password.
          </p>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:text-primary/80 transition-colors mt-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to login
          </Link>
        </motion.div>
      </div>
    )
  }

  // ── Phase 1a: Request reset form (unauthenticated only) ───────────
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] w-full max-w-lg mx-auto py-12 px-4">
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="text-center space-y-4 mb-12"
      >
        <div className="w-16 h-16 rounded-2xl bg-primary/20 border border-primary/30 flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-primary/20">
          <Mail className="text-primary w-8 h-8" />
        </div>
        <h1 className="text-4xl font-black tracking-tighter text-slate-950 dark:text-white">Reset Password</h1>
        <p className="text-slate-500 font-medium">Enter your email and we'll send you a reset link.</p>
      </motion.div>

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="glass-card w-full p-10 rounded-[2.5rem] border-white/5 shadow-3xl"
      >
        <form onSubmit={handleRequestReset} className="space-y-6">
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

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-16 text-md font-black bg-primary text-white hover:opacity-90 rounded-2xl shadow-2xl shadow-primary/20 atom-hover mt-4"
          >
            {loading ? (
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin" />
                Sending...
              </div>
            ) : (
              <div className="flex items-center gap-2">
                Send Reset Link
                <ArrowRight className="w-5 h-5 ml-1" />
              </div>
            )}
          </Button>
        </form>

        <div className="mt-8 text-center pt-6 border-t border-slate-200/50 dark:border-white/5">
          <Link to="/login" className="text-sm font-bold text-primary/70 hover:text-primary transition-colors inline-flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to login
          </Link>
        </div>
      </motion.div>
    </div>
  )
}
