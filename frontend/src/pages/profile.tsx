import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '@/context/auth-context'
import { getProfile, saveProfile } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { X, Sparkles, BrainCircuit, Save } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export default function Profile() {
  const { user } = useAuth()
  const [skills, setSkills] = useState<string[]>([])
  const [newSkill, setNewSkill] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    if (user) {
      getProfile(user.id)
        .then(data => {
          setSkills(data || [])
          setLoading(false)
        })
        .catch(() => {
          setLoading(false)
        })
    }
  }, [user])

  const handleAddSkill = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newSkill.trim()) return
    const s = newSkill.trim().toLowerCase()
    if (!skills.includes(s)) {
      setSkills([...skills, s])
    }
    setNewSkill('')
  }

  const handleRemoveSkill = (skill: string) => {
    setSkills(skills.filter(s => s !== skill))
  }

  const handleSave = async () => {
    if (!user) return
    setSaving(true)
    try {
      await saveProfile(user.id, user.email || 'Student', skills)
      toast({ 
        title: "Intelligence Synchronized", 
        description: "Your skill vector has been updated across the network.", 
      })
    } catch (e: any) {
      toast({ title: "Sync Error", description: e.message, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-40 space-y-6">
      <motion.div 
        animate={{ rotate: 360, scale: [1, 1.2, 1] }} 
        transition={{ repeat: Infinity, duration: 2 }} 
        className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center border border-primary/30"
      >
        <BrainCircuit className="text-primary w-6 h-6" />
      </motion.div>
      <p className="text-slate-500 font-black uppercase tracking-[0.3em] text-[10px]">Retrieving Core Identity...</p>
    </div>
  )

  return (
    <div className="max-w-4xl mx-auto space-y-12 pb-24">
      {/* Page Header */}
      <div className="space-y-4 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-black uppercase tracking-widest mb-2"
        >
          Identity Management
        </motion.div>
        <h1 className="text-5xl font-black tracking-tighter text-white">Intelligence Profile</h1>
        <p className="max-w-lg mx-auto text-slate-500 font-medium">Build your unique skill vector to calibrate the AI recommendation engine.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left: Input Analysis */}
        <div className="md:col-span-1 space-y-6">
           <div className="glass-card p-8 rounded-[2rem] border-primary/10">
              <h3 className="text-white font-black text-lg mb-6 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                Input Node
              </h3>
              <form onSubmit={handleAddSkill} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-1">Skill Identifier</label>
                  <Input
                    value={newSkill}
                    onChange={e => setNewSkill(e.target.value)}
                    placeholder="e.g. React.js, Rust..."
                    className="h-12 bg-slate-950/50 border-white/5 focus-visible:ring-primary/40 rounded-xl text-white font-medium"
                  />
                </div>
                <Button type="submit" className="w-full h-12 font-black rounded-xl bg-white text-slate-950 hover:bg-slate-200 atom-hover">
                  Add to Profile
                </Button>
              </form>
           </div>

           <div className="p-8 space-y-4">
              <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Guideline</h4>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                Our semantic engine performs better when skills are mapped precisely (e.g., 'React.js' instead of just 'Web Dev').
              </p>
           </div>
        </div>

        {/* Right: Vector Visualization */}
        <div className="md:col-span-2 space-y-6">
           <div className="glass-card p-8 rounded-[2.5rem] flex flex-col min-h-[400px]">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-white font-black text-lg flex items-center gap-2">
                  <BrainCircuit className="w-5 h-5 text-primary" />
                  Skill Vector Cloud
                </h3>
                <Badge className="bg-slate-950 text-slate-400 border-white/5 font-black">{skills.length} Nodes</Badge>
              </div>

              <div className="flex-grow flex flex-wrap gap-2.5 content-start">
                <AnimatePresence mode="popLayout">
                  {skills.length === 0 ? (
                    <motion.div 
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      className="w-full h-40 flex items-center justify-center text-slate-700 font-bold uppercase tracking-widest text-xs border-2 border-dashed border-white/5 rounded-3xl"
                    >
                      Empty Identity Vector
                    </motion.div>
                  ) : (
                    skills.map(skill => (
                      <motion.div
                        key={skill}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8, filter: "blur(8px)" }}
                        layout
                      >
                        <Badge className="bg-primary/5 text-primary border-primary/20 font-black text-xs py-2 px-4 rounded-xl flex items-center gap-2 hover:bg-primary/10 transition-colors group">
                          {skill}
                          <button onClick={() => handleRemoveSkill(skill)} className="text-slate-500 group-hover:text-rose-400 transition-colors">
                            <X size={14} strokeWidth={3} />
                          </button>
                        </Badge>
                      </motion.div>
                    ))
                  )}
                </AnimatePresence>
              </div>

              <div className="mt-12 pt-8 border-t border-white/5 flex flex-col gap-4">
                <Button 
                  onClick={handleSave} 
                  disabled={saving || skills.length === 0}
                  className="w-full h-16 text-lg font-black bg-white text-slate-950 hover:bg-slate-200 rounded-2xl shadow-2xl atom-hover"
                >
                  {saving ? (
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                      Synchronizing...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Save className="w-5 h-5" />
                      Commit Changes to Registry
                    </div>
                  )}
                </Button>
                <p className="text-center text-[10px] text-slate-600 font-bold uppercase tracking-widest">
                  Authentication: Signed in as {user?.email}
                </p>
              </div>
           </div>
        </div>
      </div>
    </div>
  )
}
