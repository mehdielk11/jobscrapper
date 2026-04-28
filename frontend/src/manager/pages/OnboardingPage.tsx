import { useState } from 'react'
import { useManagerOrg } from '../hooks/useManagerOrg'
import { GraduationCap, ArrowRight, Building2 } from 'lucide-react'
import { motion } from 'framer-motion'
import { toast } from 'react-hot-toast'
import { Toaster } from 'react-hot-toast'

export function OnboardingPage() {
  const { createOrg } = useManagerOrg()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    setSubmitting(true)
    try {
      await createOrg(name.trim(), description.trim() || undefined)
      toast.success('Organisation created! Redirecting...')
      // ManagerApp will re-render and detect the org exists
      window.location.reload()
    } catch (err: any) {
      toast.error(err.message || 'Failed to create organisation')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <Toaster position="top-right" />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-6 border border-emerald-500/20">
            <GraduationCap size={28} className="text-emerald-500" />
          </div>
          <h1 className="text-2xl font-bold text-foreground font-['Sora',sans-serif] mb-2">
            Welcome, Academic Manager
          </h1>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Create your organisation to start managing students and tracking their academic skills.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-card border border-border rounded-2xl p-8 shadow-lg space-y-6">
          <div>
            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2 block">
              Organisation Name *
            </label>
            <div className="relative">
              <Building2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. University of Casablanca"
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-muted/50 border border-border text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/50 transition-all"
                required
                autoFocus
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2 block">
              Description <span className="font-normal">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Brief description of your organisation..."
              rows={3}
              className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/50 transition-all resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={submitting || !name.trim()}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold uppercase tracking-widest transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/20"
          >
            {submitting ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                Create Organisation
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>
      </motion.div>
    </div>
  )
}
