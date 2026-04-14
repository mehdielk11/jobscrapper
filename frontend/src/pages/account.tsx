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
  const [activeTab, setActiveTab] = useState('personal')

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

  const tabs = [
    { id: 'personal', label: 'Personal Info' },
    { id: 'security', label: 'Security' }
  ]

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-32 px-4 ">
      <div className="space-y-6">
        <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">Settings</h1>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-8 border-b border-slate-200 dark:border-white/10 overflow-x-auto no-scrollbar pb-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-4 text-sm font-bold transition-all relative whitespace-nowrap ${activeTab === tab.id
                  ? 'text-blue-600'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"
                />
              )}
            </button>
          ))}
        </div>
      </div>

      <motion.div
        key={activeTab}
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-white dark:bg-slate-900 p-8 sm:p-12 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm space-y-12"
      >
        {activeTab === 'personal' && (
          <div className="space-y-10">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Profile information</h2>

            <div className="space-y-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="text-sm font-bold text-slate-900 dark:text-white">First name</label>
                  <Input
                    value={firstName}
                    onChange={e => setFirstName(e.target.value)}
                    className="h-12 bg-white dark:bg-slate-950 border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-white focus-visible:ring-1 focus-visible:ring-slate-900"
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-bold text-slate-900 dark:text-white">Last name</label>
                  <Input
                    value={lastName}
                    onChange={e => setLastName(e.target.value)}
                    className="h-12 bg-white dark:bg-slate-950 border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-white focus-visible:ring-1 focus-visible:ring-slate-900"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-bold text-slate-900 dark:text-white">Email</label>
                <Input
                  value={user?.email || ''}
                  disabled
                  className="h-12 bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-white/5 rounded-lg text-slate-500 cursor-not-allowed"
                />
              </div>

              <div className="pt-4">
                <Button
                  onClick={handleUpdateProfile}
                  disabled={savingProfile}
                  className="h-12 px-8 rounded-lg font-bold bg-black text-white hover:bg-black/90 dark:bg-white dark:text-black dark:hover:bg-white/90 transition-all"
                >
                  {savingProfile ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Save
                </Button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'security' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Account Security</h2>
            
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-900 dark:text-white">Current Password</label>
                <Input
                  type="password"
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  className="h-11 bg-white dark:bg-slate-950 border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-900 dark:text-white">New Password</label>
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    className="h-11 bg-white dark:bg-slate-950 border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-900 dark:text-white">Confirm Password</label>
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    className="h-11 bg-white dark:bg-slate-950 border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {newPassword && (
                <div className="flex flex-wrap gap-x-4 gap-y-1 bg-slate-50 dark:bg-slate-950/50 p-3 rounded-lg border border-slate-100 dark:border-white/5">
                  {[
                    { label: '8+ chars', met: val.minLength },
                    { label: 'Upper', met: val.hasUpper },
                    { label: 'Lower', met: val.hasLower },
                    { label: 'Number', met: val.hasNumber },
                    { label: 'Symbol', met: val.hasSpecial }
                  ].map(({ label, met }) => (
                    <div key={label} className={`flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider ${met ? 'text-emerald-500' : 'text-slate-400'}`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${met ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'}`} />
                      {label}
                    </div>
                  ))}
                </div>
              )}

              <div className="pt-2">
                <Button
                  onClick={handleResetPassword}
                  disabled={savingPassword || !currentPassword || !newPassword || newPassword !== confirmPassword || !val.isValid}
                  className="h-11 px-8 rounded-lg font-bold bg-black text-white hover:bg-black/90 dark:bg-white dark:text-black dark:hover:bg-white/90 transition-all opacity-100 disabled:opacity-50 w-full sm:w-auto"
                >
                  {savingPassword ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <KeyRound className="w-4 h-4 mr-2" />}
                  Update Password
                </Button>
              </div>
            </div>
          </div>
        )}



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
          <LogOut className="w-4 h-4 mr-2" /> Log out
        </Button>
      </motion.div>
    </div>
  )
}
