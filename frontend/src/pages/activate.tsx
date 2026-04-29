import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/lib/supabase'
import { Lock, ArrowRight, ArrowLeft, CheckCircle2, XCircle } from 'lucide-react'

type ActivateState = 'verifying' | 'invalid' | 'set-password' | 'success'

function getStrength(pwd: string): { level: 'weak' | 'medium' | 'strong'; pct: number } {
  let score = 0
  if (pwd.length >= 8) score++
  if (pwd.length >= 12) score++
  if (/[A-Z]/.test(pwd)) score++
  if (/[a-z]/.test(pwd)) score++
  if (/\d/.test(pwd)) score++
  if (/[^A-Za-z0-9]/.test(pwd)) score++

  if (score <= 2) return { level: 'weak', pct: 33 }
  if (score <= 4) return { level: 'medium', pct: 66 }
  return { level: 'strong', pct: 100 }
}

const strengthColors = {
  weak: 'bg-red-500',
  medium: 'bg-amber-500',
  strong: 'bg-emerald-500',
}

export default function ActivatePage() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const processed = useRef(false)

  const [state, setState] = useState<ActivateState>('verifying')
  const [activationEmail, setActivationEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)

  // Handle Supabase auth redirect
  // When user clicks the invite link, Supabase redirects here with tokens in the URL hash.
  // The Supabase JS client auto-detects these tokens and creates a session.
  useEffect(() => {
    if (processed.current) return
    processed.current = true

    // Check if we already have a session from the redirect
    const checkSession = async () => {
      // Small delay to let Supabase JS pick up the hash tokens
      await new Promise(resolve => setTimeout(resolve, 500))

      const { data: { session }, error } = await supabase.auth.getSession()

      if (error || !session) {
        // Also listen for the auth state change event (backup)
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          (event, session) => {
            if (session && (event === 'SIGNED_IN' || event === 'PASSWORD_RECOVERY' || event === 'INITIAL_SESSION')) {
              setActivationEmail(session.user.email || '')
              setState('set-password')
              subscription.unsubscribe()
            }
          }
        )

        // If still no session after 3 seconds, mark as invalid
        setTimeout(async () => {
          const { data: { session: s } } = await supabase.auth.getSession()
          if (!s) {
            setState('invalid')
            subscription.unsubscribe()
          }
        }, 3000)

        return
      }

      setActivationEmail(session.user.email || '')
      setState('set-password')
    }

    checkSession()
  }, [])

  const passwordValid =
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /\d/.test(password)

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!passwordValid) {
      toast({ title: 'Error', description: 'Password does not meet requirements', variant: 'destructive' })
      return
    }
    if (password !== confirmPassword) {
      toast({ title: 'Error', description: 'Passwords do not match', variant: 'destructive' })
      return
    }

    setLoading(true)
    try {
      // Use Supabase client to update the user's password directly.
      // This works because we have an active session from the invite link.
      const { error } = await supabase.auth.updateUser({ 
        password,
        data: { needs_password_set: false }
      })

      if (error) {
        toast({
          title: 'Error',
          description: error.message || 'Failed to set password',
          variant: 'destructive',
        })
      } else {
        // Sign out so they can log in fresh with their new password
        await supabase.auth.signOut()
        setState('success')
        setTimeout(() => navigate('/login', { replace: true }), 2500)
      }
    } catch {
      toast({ title: 'Network Error', description: 'Could not reach the server.', variant: 'destructive' })
    }
    setLoading(false)
  }

  const strength = getStrength(password)

  // ── Loading / verifying ──────────────────────────────────────────────
  if (state === 'verifying') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-slate-500 font-medium">Verifying your invite link...</p>
      </div>
    )
  }

  // ── Error: Invalid / expired ─────────────────────────────────────────
  if (state === 'invalid') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] w-full max-w-lg mx-auto py-12 px-4">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-red-500/20 border border-red-500/30 flex items-center justify-center mx-auto shadow-2xl shadow-red-500/20">
            <XCircle className="text-red-500 w-8 h-8" />
          </div>
          <h1 className="text-3xl font-black tracking-tighter text-slate-950 dark:text-white">Invalid Link</h1>
          <p className="text-slate-500 font-medium max-w-sm mx-auto">
            This activation link is invalid or has expired. Please contact your administrator to request a new one.
          </p>
          <Link to="/" className="inline-flex items-center gap-2 text-sm font-bold text-primary/70 hover:text-primary transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to home
          </Link>
        </motion.div>
      </div>
    )
  }

  // ── Success ──────────────────────────────────────────────────────────
  if (state === 'success') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] w-full max-w-lg mx-auto py-12 px-4">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto shadow-2xl shadow-emerald-500/20">
            <CheckCircle2 className="text-emerald-500 w-8 h-8" />
          </div>
          <h1 className="text-3xl font-black tracking-tighter text-slate-950 dark:text-white">Account Activated!</h1>
          <p className="text-slate-500 font-medium max-w-sm mx-auto">
            Your password has been set. Redirecting to login...
          </p>
          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        </motion.div>
      </div>
    )
  }

  // ── Set Password form ────────────────────────────────────────────────
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
        <h1 className="text-4xl font-black tracking-tighter text-slate-950 dark:text-white">
          Set Your Password
        </h1>
        <p className="text-slate-500 font-medium">
          Welcome! Create a password for{' '}
          <span className="font-bold text-slate-700 dark:text-slate-300">{activationEmail}</span>
        </p>
      </motion.div>

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="glass-card w-full p-10 rounded-[2.5rem] border-white/5 shadow-3xl"
      >
        <form onSubmit={handleSetPassword} className="space-y-6">
          <div className="space-y-4">
            <div className="relative group">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 group-focus-within:text-primary transition-colors" />
              <Input
                type="password"
                placeholder="New password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={8}
                className="h-14 pl-12 bg-white/50 dark:bg-slate-950/50 border border-slate-200 dark:border-white/5 focus-visible:ring-primary/40 rounded-2xl text-slate-950 dark:text-white font-medium placeholder:text-slate-500 dark:placeholder:text-slate-700"
              />
            </div>

            {/* Strength meter */}
            {password.length > 0 && (
              <div className="space-y-2">
                <div className="h-1.5 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full ${strengthColors[strength.level]}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${strength.pct}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500 font-medium">
                    {strength.level === 'weak' && 'Weak — add uppercase, digits, or length'}
                    {strength.level === 'medium' && 'Medium — almost there'}
                    {strength.level === 'strong' && 'Strong password ✓'}
                  </span>
                </div>
              </div>
            )}

            {/* Requirements */}
            <div className="text-xs text-slate-400 space-y-1 pl-1">
              <p className={password.length >= 8 ? 'text-emerald-500' : ''}>
                {password.length >= 8 ? '✓' : '○'} At least 8 characters
              </p>
              <p className={/[A-Z]/.test(password) ? 'text-emerald-500' : ''}>
                {/[A-Z]/.test(password) ? '✓' : '○'} One uppercase letter
              </p>
              <p className={/\d/.test(password) ? 'text-emerald-500' : ''}>
                {/\d/.test(password) ? '✓' : '○'} One digit
              </p>
            </div>

            <div className="relative group">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 group-focus-within:text-primary transition-colors" />
              <Input
                type="password"
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
                className={`h-14 pl-12 bg-white/50 dark:bg-slate-950/50 border focus-visible:ring-primary/40 rounded-2xl text-slate-950 dark:text-white font-medium placeholder:text-slate-500 dark:placeholder:text-slate-700 ${
                  confirmPassword && confirmPassword !== password ? 'border-red-500/50' : 'border-slate-200 dark:border-white/5'
                }`}
              />
            </div>
            {confirmPassword && confirmPassword !== password && (
              <p className="text-xs text-red-500 font-bold pl-1">Passwords do not match</p>
            )}
          </div>

          <Button
            type="submit"
            disabled={loading || !passwordValid || password !== confirmPassword}
            className="w-full h-16 text-md font-black bg-primary text-white hover:opacity-90 rounded-2xl shadow-2xl shadow-primary/20 atom-hover mt-4 disabled:opacity-40"
          >
            {loading ? (
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin" />
                Setting up...
              </div>
            ) : (
              <div className="flex items-center gap-2">
                Activate Account
                <ArrowRight className="w-5 h-5 ml-1" />
              </div>
            )}
          </Button>
        </form>
      </motion.div>
    </div>
  )
}
