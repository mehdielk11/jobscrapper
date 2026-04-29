import { useState, useEffect, useRef } from 'react'
import { useManagerOrg } from '../hooks/useManagerOrg'
import { RefreshCw, Copy, Check, Save, Lock, ShieldAlert } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { useAuth } from '../../context/auth-context'
import { supabase } from '../../lib/supabase'
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile'

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || ''

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

export function SettingsPage() {
  const { org, updateOrg, regenerateInviteCode } = useManagerOrg()
  const { user } = useAuth()
  
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [copied, setCopied] = useState(false)

  // Password state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [updatingPassword, setUpdatingPassword] = useState(false)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const captchaRef = useRef<TurnstileInstance>(null)

  useEffect(() => {
    if (org) {
      setName(org.name || '')
      setDescription(org.description || '')
    }
  }, [org])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    try {
      await updateOrg(name.trim(), description.trim())
      toast.success('Organisation updated')
    } catch (err: any) {
      toast.error(err.message || 'Update failed')
    } finally {
      setSaving(false)
    }
  }

  const handleRegenerate = async () => {
    setRegenerating(true)
    try {
      await regenerateInviteCode()
      toast.success('Invite code regenerated')
    } catch (err: any) {
      toast.error(err.message || 'Failed to regenerate')
    } finally {
      setRegenerating(false)
    }
  }

  const copyCode = () => {
    if (!org?.invite_code) return
    navigator.clipboard.writeText(org.invite_code)
    setCopied(true)
    toast.success('Copied!')
    setTimeout(() => setCopied(false), 2000)
  }

  const passwordValid =
    newPassword.length >= 8 &&
    /[A-Z]/.test(newPassword) &&
    /\d/.test(newPassword)

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentPassword) {
      toast.error('Please enter your current password')
      return
    }
    if (!passwordValid) {
      toast.error('New password does not meet requirements')
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match')
      return
    }

    setUpdatingPassword(true)
    try {
      // 1. Verify current password by signing in again
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user?.email || '',
        password: currentPassword,
        options: { captchaToken: captchaToken ?? undefined },
      })
      
      if (signInError) {
        toast.error('Incorrect current password')
        setUpdatingPassword(false)
        captchaRef.current?.reset()
        setCaptchaToken(null)
        return
      }

      // 2. Update to new password
      const { error: updateError } = await supabase.auth.updateUser({ 
        password: newPassword 
      })

      if (updateError) {
        toast.error(updateError.message || 'Failed to update password')
      } else {
        toast.success('Password updated! Please log in again.', { style: { background: '#22c55e', color: '#fff' } })
        // Force log out
        await supabase.auth.signOut()
        window.location.href = '/login'
      }
    } catch (err: any) {
      toast.error('Network Error. Please try again.')
      captchaRef.current?.reset()
      setCaptchaToken(null)
    } finally {
      setUpdatingPassword(false)
    }
  }

  const strength = getStrength(newPassword)

  if (!org) return null

  return (
    <div className="space-y-8 pb-12 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold text-foreground font-['Sora',sans-serif]">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your organisation details</p>
      </div>

      {/* Org info */}
      <form onSubmit={handleSave} className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-5">
        <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">Organisation Details</h2>

        <div>
          <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2 block">Name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/30 transition-all"
            required
          />
        </div>

        <div>
          <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2 block">Description</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={3}
            className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/30 transition-all resize-none"
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
        >
          <Save size={14} />
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </form>

      {/* Invite Code */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
        <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">Invite Code</h2>
        <p className="text-xs text-muted-foreground">Users use this code to join your organisation.</p>

        <div className="flex items-center gap-3">
          <code className="flex-1 px-4 py-3 rounded-xl bg-muted/50 border border-border text-lg font-mono font-bold text-foreground tracking-[0.3em] text-center">
            {org.invite_code}
          </code>
          <button
            onClick={copyCode}
            className="p-3 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors border border-emerald-500/20"
          >
            {copied ? <Check size={18} /> : <Copy size={18} />}
          </button>
        </div>

        <button
          onClick={handleRegenerate}
          disabled={regenerating}
          className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={regenerating ? 'animate-spin' : ''} />
          Regenerate Code
        </button>
        <p className="text-[10px] text-muted-foreground/60">Warning: regenerating will invalidate the current code. Students who haven't joined yet will need the new code.</p>
      </div>

      {/* Password Change */}
      <form onSubmit={handlePasswordChange} className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-5">
        <div>
          <h2 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
            <Lock size={16} className="text-emerald-500" />
            Security & Password
          </h2>
          <p className="text-xs text-muted-foreground mt-1">Update your account password</p>
        </div>

        <div>
          <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2 block">Current Password</label>
          <input
            type="password"
            value={currentPassword}
            onChange={e => setCurrentPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/30 transition-all"
            required
          />
        </div>

        <div className="pt-2 border-t border-border/50">
          <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2 block">New Password</label>
          <input
            type="password"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/30 transition-all"
            required
          />
          {newPassword.length > 0 && (
            <div className="mt-3 space-y-2">
              <div className="flex gap-1 h-1.5 w-full bg-muted/50 rounded-full overflow-hidden">
                <div className={`h-full transition-all duration-300 ${strengthColors[strength.level]}`} style={{ width: `${strength.pct}%` }} />
              </div>
              <p className="text-[10px] font-medium text-muted-foreground">
                Password strength: <span className={`capitalize ${
                  strength.level === 'weak' ? 'text-red-500' : strength.level === 'medium' ? 'text-amber-500' : 'text-emerald-500'
                }`}>{strength.level}</span>
              </p>
            </div>
          )}
        </div>

        <div>
          <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2 block">Confirm New Password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/30 transition-all"
            required
          />
        </div>

        <ul className="text-[10px] font-medium text-muted-foreground/80 space-y-1 bg-muted/30 p-3 rounded-xl border border-border/50">
          <li className="flex items-center gap-1.5">
            <ShieldAlert size={12} className={newPassword.length >= 8 ? "text-emerald-500" : ""} />
            At least 8 characters
          </li>
          <li className="flex items-center gap-1.5">
            <ShieldAlert size={12} className={/[A-Z]/.test(newPassword) ? "text-emerald-500" : ""} />
            One uppercase letter
          </li>
          <li className="flex items-center gap-1.5">
            <ShieldAlert size={12} className={/\d/.test(newPassword) ? "text-emerald-500" : ""} />
            One digit
          </li>
        </ul>

        {!!TURNSTILE_SITE_KEY && (
          <div className="flex justify-start pt-2">
            <Turnstile
              siteKey={TURNSTILE_SITE_KEY}
              onSuccess={setCaptchaToken}
              onError={() => toast.error('Captcha failed. Please try again.')}
              ref={captchaRef}
              options={{ theme: 'auto' }}
            />
          </div>
        )}

        <button
          type="submit"
          disabled={updatingPassword || (!!TURNSTILE_SITE_KEY && !captchaToken)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 dark:bg-slate-200 hover:bg-slate-700 dark:hover:bg-white text-white dark:text-slate-900 text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
        >
          <Save size={14} />
          {updatingPassword ? 'Updating...' : 'Change Password'}
        </button>
      </form>
    </div>
  )
}
