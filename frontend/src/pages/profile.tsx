import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '@/context/auth-context'
import { getProfile, saveProfile } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { X, Sparkles } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export default function Profile() {
  const { user } = useAuth()
  const [skills, setSkills] = useState<string[]>([])
  const [newSkill, setNewSkill] = useState('')
  const [loading, setLoading] = useState(true)
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
    try {
      await saveProfile(user.id, user.email || 'Student', skills)
      toast({ title: "Profile Saved", description: "Your skills have been updated successfully." })
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    }
  }

  if (loading) return (
    <div className="flex justify-center py-20">
      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
    </div>
  )

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="max-w-3xl mx-auto space-y-6 pt-6"
    >
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-primary/20 via-blue-500/20 to-transparent p-6 sm:p-8 border-b border-border/50">
          <div className="flex items-center gap-3 mb-2">
            <Sparkles className="w-6 h-6 text-primary" />
            <h2 className="text-3xl font-bold text-foreground">My Skill Profile</h2>
          </div>
          <p className="text-muted-foreground text-lg">Add the technical and soft skills you possess to get accurate, vectorized job recommendations.</p>
        </div>
        
        <div className="p-6 sm:p-8 space-y-8">
          <form onSubmit={handleAddSkill} className="flex gap-3">
            <Input
              value={newSkill}
              onChange={e => setNewSkill(e.target.value)}
              placeholder="e.g. Python, SQL, Communication..."
              className="h-12 bg-white/50 dark:bg-black/20 focus-visible:ring-primary shadow-sm"
            />
            <Button type="submit" className="h-12 px-6 rounded-xl shadow-primary/20 shadow-md">Add Skill</Button>
          </form>

          <div className="flex flex-wrap gap-3 p-6 border rounded-xl min-h-[140px] bg-white/40 dark:bg-black/10 shadow-inner items-start content-start">
            <AnimatePresence>
              {skills.length === 0 && (
                <motion.p 
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="text-muted-foreground w-full text-center py-4"
                >
                  No skills added yet. Start typing above!
                </motion.p>
              )}
              {skills.map(skill => (
                <motion.div
                  key={skill}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8, filter: "blur(4px)" }}
                  layout
                >
                  <Badge variant="secondary" className="text-sm py-1.5 px-3 flex items-center gap-2 bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 font-medium">
                    {skill}
                    <button onClick={() => handleRemoveSkill(skill)} className="hover:text-destructive hover:bg-destructive/10 rounded-full p-0.5 transition-colors">
                      <X size={14} />
                    </button>
                  </Badge>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          
          <Button onClick={handleSave} size="lg" className="w-full h-14 text-lg rounded-xl shadow-primary/30 shadow-lg hover:shadow-primary/50 transition-all font-semibold">
            Save Profile & Get Recommended
          </Button>
        </div>
      </div>
    </motion.div>
  )
}
