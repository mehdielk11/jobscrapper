import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { motion, AnimatePresence } from 'framer-motion'
import { useToast } from '@/hooks/use-toast'
import { LayoutGrid, ShieldCheck, Lock, Mail, ArrowRight, UserPlus } from 'lucide-react'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const navigate = useNavigate()
  const { toast } = useToast()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      toast({ title: "Access Denied", description: error.message, variant: "destructive" })
    } else {
      toast({ title: "Auth Verified", description: "Identity confirmed. Redirecting to core..." })
      navigate('/profile')
    }
    setLoading(false)
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) {
      toast({ title: "Registration Error", description: error.message, variant: "destructive" })
    } else {
      toast({ title: "Registration Success", description: "Node created. Verify your email or try logging in." })
    }
    setLoading(false)
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] w-full max-w-lg mx-auto py-12 px-4">
      {/* Brand Header */}
      <motion.div 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="text-center space-y-4 mb-12"
      >
        <div className="w-16 h-16 rounded-2xl bg-primary/20 border border-primary/30 flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-primary/20">
          <ShieldCheck className="text-primary w-8 h-8" />
        </div>
        <h1 className="text-4xl font-black tracking-tighter text-slate-950 dark:text-white">Security Gateway</h1>
        <p className="text-slate-500 font-medium">Verify your credentials to access the discovery network.</p>
      </motion.div>

      {/* Auth Card */}
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="glass-card w-full p-10 rounded-[2.5rem] border-white/5 shadow-3xl"
      >
        <div className="flex bg-slate-200/50 dark:bg-slate-950/50 p-1.5 rounded-2xl mb-8 border border-slate-200 dark:border-white/5">
          <button 
            onClick={() => setMode('login')}
            className={`flex-1 py-3 text-sm font-black rounded-xl transition-all ${mode === 'login' ? 'bg-white text-slate-950 shadow-xl' : 'text-slate-500 hover:text-slate-300'}`}
          >
            Access
          </button>
          <button 
            onClick={() => setMode('signup')}
            className={`flex-1 py-3 text-sm font-black rounded-xl transition-all ${mode === 'signup' ? 'bg-white text-slate-950 shadow-xl' : 'text-slate-500 hover:text-slate-300'}`}
          >
            Register
          </button>
        </div>

        <form onSubmit={mode === 'login' ? handleLogin : handleSignUp} className="space-y-6">
          <div className="space-y-4">
            <div className="relative group">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 group-focus-within:text-primary transition-colors" />
              <Input 
                type="email" 
                placeholder="Network ID (Email)" 
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
                placeholder="Access Key (Password)" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                required 
                className="h-14 pl-12 bg-white/50 dark:bg-slate-950/50 border border-slate-200 dark:border-white/5 focus-visible:ring-primary/40 rounded-2xl text-slate-950 dark:text-white font-medium placeholder:text-slate-500 dark:placeholder:text-slate-700"
              />
            </div>
          </div>

          <Button 
            type="submit" 
            disabled={loading}
            className="w-full h-16 text-md font-black bg-primary text-white hover:opacity-90 rounded-2xl shadow-2xl shadow-primary/20 atom-hover mt-4"
          >
            {loading ? (
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin" />
                Verifying...
              </div>
            ) : (
              <div className="flex items-center gap-2">
                {mode === 'login' ? 'Initiate Link' : 'Register Node'}
                <ArrowRight className="w-5 h-5 ml-1" />
              </div>
            )}
          </Button>
        </form>

        <div className="mt-8 text-center pt-8 border-t border-white/5">
           <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">
            {mode === 'login' ? "Encrypted End-to-End Authentication" : "Decentralized Profile Creation Active"}
           </p>
        </div>
      </motion.div>

      {/* Footer Info */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="mt-12 flex items-center justify-center gap-6"
      >
        <div className="flex items-center gap-2 text-slate-600 font-bold text-xs uppercase tracking-widest">
          <ShieldCheck className="w-4 h-4 opacity-50" />
          Secure
        </div>
        <div className="flex items-center gap-2 text-slate-600 font-bold text-xs uppercase tracking-widest">
          <LayoutGrid className="w-4 h-4 opacity-50" />
          Integrated
        </div>
      </motion.div>
    </div>
  )
}
