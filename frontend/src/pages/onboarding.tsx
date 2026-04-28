import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/auth-context'
import { motion } from 'framer-motion'
import { useToast } from '@/hooks/use-toast'
import { User, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

/**
 * Strips HTML tags and trims whitespace.
 * Prevents XSS from user-supplied names.
 */
function sanitize(value: string): string {
  return value.replace(/<[^>]*>/g, '').trim()
}

/**
 * Only allow letters, spaces, hyphens, and apostrophes.
 * Catches accidental numbers, special chars, etc.
 */
function isValidName(value: string): boolean {
  if (value.length < 2 || value.length > 50) return false
  return /^[\p{L}\s'\-]+$/u.test(value)
}

export default function Onboarding() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [errors, setErrors] = useState<{ firstName?: string; lastName?: string }>({})
  const [saving, setSaving] = useState(false)

  const validate = (): boolean => {
    const e: typeof errors = {}
    const cleanFirst = sanitize(firstName)
    const cleanLast = sanitize(lastName)

    if (!cleanFirst) {
      e.firstName = 'First name is required.'
    } else if (!isValidName(cleanFirst)) {
      e.firstName = 'Only letters, spaces, hyphens or apostrophes. 2-50 chars.'
    }

    if (!cleanLast) {
      e.lastName = 'Last name is required.'
    } else if (!isValidName(cleanLast)) {
      e.lastName = 'Only letters, spaces, hyphens or apostrophes. 2-50 chars.'
    }

    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate() || !user) return

    setSaving(true)
    const cleanFirst = sanitize(firstName)
    const cleanLast = sanitize(lastName)

    const { error } = await supabase
      .from('users')
      .update({ first_name: cleanFirst, last_name: cleanLast })
      .eq('auth_user_id', user.id)

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
      setSaving(false)
      return
    }

    toast({ title: 'Profile Saved', description: 'Welcome aboard! Redirecting...' })
    // Small delay so the toast is visible, then reload to re-evaluate onboarding state
    setTimeout(() => window.location.href = '/recommendations', 600)
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen w-full max-w-lg mx-auto py-12 px-4 bg-background">
      {/* Header */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="text-center space-y-4 mb-12"
      >
        <div className="w-16 h-16 rounded-2xl bg-primary/20 border border-primary/30 flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-primary/20">
          <User className="text-primary w-8 h-8" />
        </div>
        <h1 className="text-4xl font-black tracking-tighter text-slate-950 dark:text-white">
          Almost There
        </h1>
        <p className="text-slate-500 font-medium">
          Tell us your name to complete your profile setup.
        </p>
      </motion.div>

      {/* Form Card */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="glass-card w-full p-10 rounded-[2.5rem] border-white/5 shadow-3xl"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            {/* First Name */}
            <div>
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2 block">
                First Name *
              </label>
              <div className="relative group">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 group-focus-within:text-primary transition-colors" />
                <Input
                  type="text"
                  placeholder="e.g. John"
                  value={firstName}
                  onChange={e => { setFirstName(e.target.value); setErrors(prev => ({ ...prev, firstName: undefined })) }}
                  autoFocus
                  maxLength={50}
                  className={`h-14 pl-12 bg-white/50 dark:bg-slate-950/50 border ${errors.firstName ? 'border-red-500 focus-visible:ring-red-400/40' : 'border-slate-200 dark:border-white/5 focus-visible:ring-primary/40'} rounded-2xl text-slate-950 dark:text-white font-medium placeholder:text-slate-500 dark:placeholder:text-slate-700`}
                />
              </div>
              {errors.firstName && (
                <p className="text-xs text-red-500 mt-1.5 font-medium">{errors.firstName}</p>
              )}
            </div>

            {/* Last Name */}
            <div>
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2 block">
                Last Name *
              </label>
              <div className="relative group">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 group-focus-within:text-primary transition-colors" />
                <Input
                  type="text"
                  placeholder="e.g. SMITH"
                  value={lastName}
                  onChange={e => { setLastName(e.target.value); setErrors(prev => ({ ...prev, lastName: undefined })) }}
                  maxLength={50}
                  className={`h-14 pl-12 bg-white/50 dark:bg-slate-950/50 border ${errors.lastName ? 'border-red-500 focus-visible:ring-red-400/40' : 'border-slate-200 dark:border-white/5 focus-visible:ring-primary/40'} rounded-2xl text-slate-950 dark:text-white font-medium placeholder:text-slate-500 dark:placeholder:text-slate-700`}
                />
              </div>
              {errors.lastName && (
                <p className="text-xs text-red-500 mt-1.5 font-medium">{errors.lastName}</p>
              )}
            </div>
          </div>

          <Button
            type="submit"
            disabled={saving}
            className="w-full h-16 text-md font-black bg-primary text-white hover:opacity-90 rounded-2xl shadow-2xl shadow-primary/20 atom-hover mt-4"
          >
            {saving ? (
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin" />
                Saving...
              </div>
            ) : (
              <div className="flex items-center gap-2">
                Complete Setup
                <ArrowRight className="w-5 h-5 ml-1" />
              </div>
            )}
          </Button>
        </form>

        <div className="mt-8 text-center pt-8 border-t border-white/5">
          <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">
            Your information is stored securely
          </p>
        </div>
      </motion.div>
    </div>
  )
}
