import { useAuth } from '@/context/auth-context'
import { motion } from 'framer-motion'
import { UserCircle, Mail, LogOut, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function Account() {
  const { user, signOut } = useAuth()

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-24 px-4">
      <div className="space-y-4 text-center pt-8">
        <h1 className="text-4xl font-black tracking-tighter text-slate-950 dark:text-white">Account Node</h1>
        <p className="text-slate-600 dark:text-slate-500 font-medium">Manage your security gateway credentials and connectivity.</p>
      </div>

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="glass-card p-10 rounded-[2.5rem] border-white/5 shadow-3xl space-y-8"
      >
        <div className="flex items-center gap-6">
          <div className="w-24 h-24 rounded-full bg-slate-800 border-4 border-slate-700 flex items-center justify-center text-4xl font-black text-white shadow-xl">
            {user?.email?.[0].toUpperCase()}
          </div>
          <div className="space-y-1">
            <h2 className="text-2xl font-black text-slate-950 dark:text-white">User Identity</h2>
            <p className="flex items-center gap-2 text-slate-500 font-bold text-sm">
              <ShieldCheck className="w-4 h-4 text-primary" /> Verified and Secure
            </p>
          </div>
        </div>

        <div className="space-y-6 pt-8 border-t border-slate-200 dark:border-white/10">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2">Linked Address</label>
            <div className="flex items-center gap-4 bg-slate-50/50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-200 dark:border-white/5">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <Mail className="w-5 h-5" />
              </div>
              <span className="font-bold text-slate-950 dark:text-white">{user?.email}</span>
            </div>
          </div>
          
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2">Hardware UUID</label>
            <div className="flex items-center gap-4 bg-slate-50/50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-200 dark:border-white/5">
              <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-500">
                <UserCircle className="w-5 h-5" />
              </div>
              <span className="font-mono text-sm font-medium text-slate-500 break-all">{user?.id}</span>
            </div>
          </div>
        </div>

        <div className="pt-8 flex justify-end">
          <Button 
            onClick={signOut}
            variant="destructive"
            className="rounded-2xl h-14 px-8 font-black uppercase tracking-wider text-xs shadow-xl shadow-rose-500/20 atom-hover"
          >
            <LogOut className="w-4 h-4 mr-3" /> Disconnect Session
          </Button>
        </div>
      </motion.div>
    </div>
  )
}
