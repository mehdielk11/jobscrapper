import { useState, useEffect } from 'react'
import { useAuth } from '@/context/auth-context'
import { supabase } from '@/lib/supabase'
import { motion } from 'framer-motion'
import { Mail, LogOut, ShieldCheck, User, KeyRound, Loader2, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'

export default function Account() {
  const { user, signOut } = useAuth()
  const { toast } = useToast()
  
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  
  // Security State
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  
  const [loadingData, setLoadingData] = useState(true)
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)

  // Fetch initial profile
  useEffect(() => {
    async function fetchProfile() {
      if (!user) return
      setLoadingData(true)
      const { data, error } = await supabase
        .from('students')
        .select('first_name, last_name')
        .eq('auth_user_id', user.id)
        .maybeSingle()
      
      if (data && !error) {
        setFirstName(data.first_name || '')
        setLastName(data.last_name || '')
      }
      setLoadingData(false)
    }
    fetchProfile()
  }, [user])

  const handleUpdateProfile = async () => {
    if (!user) return
    setSavingProfile(true)
    const { error } = await supabase
      .from('students')
      .upsert({ 
        auth_user_id: user.id, 
        first_name: firstName, 
        last_name: lastName,
        email: user?.email
      }, { onConflict: 'auth_user_id' })
      
    if (error) {
      toast({ title: 'Error Updating Profile', description: error.message, variant: 'destructive' })
    } else {
      toast({ title: 'Profile Updated', description: 'Your personal details have been securely saved.' })
    }
    setSavingProfile(false)
  }

  const validatePassword = (pwd: string) => {
    const minLength = pwd.length >= 8;
    const hasUpper = /[A-Z]/.test(pwd);
    const hasLower = /[a-z]/.test(pwd);
    const hasNumber = /[0-9]/.test(pwd);
    const hasSpecial = /[^A-Za-z0-9]/.test(pwd);
    return { minLength, hasUpper, hasLower, hasNumber, hasSpecial, isValid: minLength && hasUpper && hasLower && hasNumber && hasSpecial };
  }

  const handleResetPassword = async () => {
    if (!user?.email) return;

    if (!currentPassword) {
      toast({ title: 'Current Password Required', description: 'Please enter your current password to authorize this action.', variant: 'destructive' })
      return
    }

    if (newPassword !== confirmPassword) {
      toast({ title: 'Password Mismatch', description: 'The new passwords do not match.', variant: 'destructive' })
      return
    }

    const val = validatePassword(newPassword);
    if (!val.isValid) {
      toast({ title: 'Weak Password', description: 'Your new password does not meet the security requirements.', variant: 'destructive' })
      return
    }

    setSavingPassword(true)

    // 1. Verify current password
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword
    })

    if (signInError) {
      toast({ title: 'Authorization Failed', description: 'The current password you entered is incorrect.', variant: 'destructive' })
      setSavingPassword(false)
      return
    }

    // 2. Update password
    const { error } = await supabase.auth.updateUser({
      password: newPassword
    })
    
    if (error) {
      toast({ title: 'Update Error', description: error.message, variant: 'destructive' })
    } else {
      toast({ title: 'Password Updated', description: 'Your vault access credentials have been securely changed.' })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    }
    setSavingPassword(false)
  }

  if (loadingData) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    )
  }

  const val = validatePassword(newPassword);

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-32 px-4 pt-4">
      <div className="space-y-4 text-center">
        <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">Account Settings</h1>
        <p className="text-slate-600 dark:text-slate-400 font-medium">Manage your personal information and security credentials.</p>
      </div>

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="glass-card bg-white/80 dark:bg-slate-900/80 p-8 sm:p-10 rounded-3xl border border-slate-200 dark:border-white/5 shadow-2xl space-y-10"
      >
        {/* User Identity Header */}
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-primary to-blue-500 shadow-xl flex items-center justify-center text-3xl font-black text-white shrink-0">
            {firstName ? firstName[0].toUpperCase() : user?.email?.[0].toUpperCase()}
          </div>
          <div className="space-y-1">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Profile Details</h2>
            <p className="flex items-center gap-2 text-slate-600 dark:text-slate-400 font-medium text-sm">
              <ShieldCheck className="w-4 h-4 text-emerald-500" /> Identity Verified
            </p>
          </div>
        </div>

        {/* Read-Only Email */}
        <div className="space-y-3 pt-6 border-t border-slate-200 dark:border-white/10">
          <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider ml-1">Account Address</label>
          <div className="flex items-center gap-4 bg-slate-100 dark:bg-slate-950/50 p-4 rounded-2xl border border-slate-200 dark:border-white/5 opacity-80 cursor-not-allowed">
            <Mail className="w-5 h-5 text-slate-400" />
            <span className="font-semibold text-slate-900 dark:text-white truncate">{user?.email}</span>
          </div>
        </div>

        {/* Personal Details Form */}
        <div className="space-y-4">
          <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider ml-1">Personal Identity</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="relative group">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
              <Input
                placeholder="First Name"
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                className="h-14 pl-12 bg-white dark:bg-slate-950/50 border-slate-200 dark:border-white/5 focus-visible:ring-primary/40 rounded-xl text-slate-900 dark:text-white font-medium"
              />
            </div>
            <div className="relative group">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
              <Input
                placeholder="Last Name"
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                className="h-14 pl-12 bg-white dark:bg-slate-950/50 border-slate-200 dark:border-white/5 focus-visible:ring-primary/40 rounded-xl text-slate-900 dark:text-white font-medium"
              />
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <Button 
              onClick={handleUpdateProfile} 
              disabled={savingProfile}
              className="rounded-xl font-bold bg-slate-900 text-white dark:bg-white dark:text-slate-900 hover:opacity-90"
            >
              {savingProfile ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Save Profile
            </Button>
          </div>
        </div>

        {/* Security / Password Reset */}
        <div className="space-y-6 pt-6 border-t border-slate-200 dark:border-white/10">
          <div className="flex justify-between items-end">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider ml-1">Vault Security</label>
          </div>
          
          <div className="space-y-4">
            <div className="relative group">
              <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
              <Input
                type="password"
                placeholder="Current Password"
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                className="h-14 pl-12 bg-white dark:bg-slate-950/50 border-slate-200 dark:border-white/5 focus-visible:ring-primary/40 rounded-xl text-slate-900 dark:text-white font-medium"
              />
            </div>
            
            <div className="relative group">
              <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
              <Input
                type="password"
                placeholder="New Password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="h-14 pl-12 bg-white dark:bg-slate-950/50 border-slate-200 dark:border-white/5 focus-visible:ring-primary/40 rounded-xl text-slate-900 dark:text-white font-medium"
              />
            </div>

            {/* Password Strength Indicator */}
            {newPassword && (
              <div className="flex flex-wrap gap-x-4 gap-y-2 px-2 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-100 dark:border-white/5">
                {[
                  { label: '8+ chars', met: val.minLength },
                  { label: 'Upper', met: val.hasUpper },
                  { label: 'Lower', met: val.hasLower },
                  { label: 'Number', met: val.hasNumber },
                  { label: 'Symbol', met: val.hasSpecial }
                ].map(({ label, met }) => (
                  <div key={label} className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider ${met ? 'text-emerald-500' : 'text-slate-400'}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${met ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-slate-300 dark:bg-slate-700'}`} />
                    {label}
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative group flex-1">
                <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
                <Input
                  type="password"
                  placeholder="Confirm New Password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className="h-14 pl-12 bg-white dark:bg-slate-950/50 border-slate-200 dark:border-white/5 focus-visible:ring-primary/40 rounded-xl text-slate-900 dark:text-white font-medium"
                />
              </div>
              <Button 
                onClick={handleResetPassword} 
                disabled={savingPassword || !currentPassword || !newPassword || newPassword !== confirmPassword || !val.isValid}
                variant="default"
                className="h-14 px-8 rounded-xl font-bold bg-primary hover:bg-primary/90 text-primary-foreground sm:w-auto w-full disabled:opacity-50 transition-all atom-hover shadow-lg shadow-primary/20"
              >
                {savingPassword ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <KeyRound className="w-4 h-4 mr-2" />}
                Update Key
              </Button>
            </div>
          </div>
        </div>

      </motion.div>

      {/* Disconnect System */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="flex justify-center"
      >
         <Button 
            onClick={signOut}
            variant="ghost"
            className="rounded-xl h-12 px-6 font-bold text-rose-500 hover:bg-rose-500/10 hover:text-rose-600 transition-colors"
          >
            <LogOut className="w-4 h-4 mr-2" /> Disconnect Session
          </Button>
      </motion.div>
    </div>
  )
}
