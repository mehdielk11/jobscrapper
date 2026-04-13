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

  const suggestedSkills = ['python', 'react', 'sql', 'javascript', 'typescript', 'node.js', 'aws', 'docker', 'machine learning', 'devops']

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
    <div className="max-w-5xl mx-auto space-y-8 pb-24">
      {/* Page Header */}
      <div className="space-y-4 text-center">
        <h1 className="text-5xl font-black tracking-tighter text-slate-950 dark:text-white">Profile Central</h1>
        <p className="max-w-xl mx-auto text-slate-600 dark:text-slate-500 font-medium text-lg italic opacity-80">
          "The skills you master define the opportunities you manifest."
        </p>
      </div>

      <div className="glass-card rounded-[2.5rem] border-primary/10 overflow-hidden shadow-2xl">
        {/* Hub Header */}
        <div className="p-8 border-b border-slate-200 dark:border-white/5 bg-slate-50/50 dark:bg-white/5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
              <BrainCircuit className="text-white w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-950 dark:text-white tracking-tight">Intelligence Vault</h2>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Registry: Active</p>
            </div>
          </div>
          <Badge className="bg-primary/10 text-primary border-primary/20 font-black px-4 py-1 rounded-full">
            {skills.length} Vector Nodes
          </Badge>
        </div>

        <div className="p-8 space-y-8">
          {/* Quick Add Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Frequent Skills</h4>
              <span className="text-[9px] text-slate-400 font-medium">Click to add</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {suggestedSkills.map(s => {
                const isSelected = skills.includes(s)
                return (
                  <button
                    key={s}
                    onClick={() => !isSelected && setSkills([...skills, s])}
                    disabled={isSelected}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all border ${
                      isSelected 
                        ? 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/5 text-slate-400 cursor-not-allowed opacity-50' 
                        : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:border-primary hover:text-primary'
                    }`}
                  >
                    {s}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Unified Input Section */}
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-tech-cyan/20 rounded-[1.5rem] blur opacity-0 group-focus-within:opacity-100 transition duration-1000"></div>
            <div className="relative">
              <form onSubmit={handleAddSkill} className="flex items-center gap-3">
                <div className="relative flex-grow">
                  <Sparkles className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-primary opacity-50" />
                  <Input
                    value={newSkill}
                    onChange={e => setNewSkill(e.target.value)}
                    placeholder="Identify new potential..."
                    className="w-full h-14 pl-12 pr-6 bg-white dark:bg-slate-950 border-2 border-slate-100 dark:border-white/5 focus-visible:ring-primary/40 focus-visible:border-primary/40 rounded-2xl text-base font-bold placeholder:text-slate-300 dark:placeholder:text-slate-700 shadow-inner"
                  />
                </div>
                <Button 
                  type="submit" 
                  className="h-14 px-8 font-black rounded-2xl bg-slate-950 dark:bg-white text-white dark:text-slate-950 hover:opacity-90 atom-hover"
                >
                  Add Skill
                </Button>
              </form>
            </div>
          </div>

          {/* Skill Visualization */}
          <div className="space-y-4">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Active Vector Cloud</h4>
            <div className="p-6 rounded-2xl bg-slate-50/50 dark:bg-white/5 border border-slate-200 dark:border-white/5 min-h-[160px] flex flex-wrap gap-2.5 items-start content-start">
              <AnimatePresence mode="popLayout">
                {skills.length === 0 ? (
                  <motion.div 
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="w-full h-24 flex items-center justify-center text-slate-400 font-bold uppercase tracking-widest text-[10px] border-2 border-dashed border-slate-200 dark:border-white/5 rounded-2xl"
                  >
                    No skills registered
                  </motion.div>
                ) : (
                  skills.map(skill => (
                    <motion.div
                      key={skill}
                      initial={{ opacity: 0, scale: 0.8, y: 5 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.8, filter: "blur(8px)" }}
                      layout
                    >
                      <Badge className="bg-white dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 font-bold text-xs py-2 px-4 rounded-xl flex items-center gap-2 shadow-lg hover:border-primary/50 transition-all group">
                        {skill}
                        <button onClick={() => handleRemoveSkill(skill)} className="text-slate-300 hover:text-rose-500 transition-colors">
                          <X size={14} strokeWidth={3} />
                        </button>
                      </Badge>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="pt-2 flex flex-col items-center gap-6">
            <Button 
              onClick={handleSave} 
              disabled={saving || skills.length === 0}
              className="w-full max-w-md h-14 text-lg font-black bg-primary text-white hover:bg-primary/90 rounded-2xl shadow-xl shadow-primary/20 atom-hover"
            >
              {saving ? (
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Save className="w-4 h-4" />
                  Save
                </div>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>

  )
}
