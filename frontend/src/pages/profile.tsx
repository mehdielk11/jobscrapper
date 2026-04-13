import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '@/context/auth-context'
import { getProfile, saveProfile } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { X, Sparkles, BrainCircuit, Save, Loader2, Trash2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import axios from 'axios'

export default function Profile() {
  const { user } = useAuth()
  const [skills, setSkills] = useState<string[]>([])
  const [newSkill, setNewSkill] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const [showDropdown, setShowDropdown] = useState(false)
  const [isFetching, setIsFetching] = useState(false)
  const { toast } = useToast()
  const [eliteRegistry, setEliteRegistry] = useState<{en: string, fr: string, freq: number}[]>([])

  // Load Profile Root Data
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

  // Load Elite Registry on mount
  useEffect(() => {
    fetch('/src/data/elite_skills.json')
      .then(res => res.json())
      .then(data => setEliteRegistry(data))
      .catch(err => console.error('Failed to load elite registry:', err))
  }, [])

  useEffect(() => {
    const query = newSkill.trim().toLowerCase()
    if (query.length < 2) {
      setSuggestions([])
      setShowDropdown(false)
      return
    }

    const handler = setTimeout(async () => {
      setIsFetching(true)
      setShowDropdown(true)

      // 1. Primary Search: Elite Registry (Local & Instant)
      const localMatches = eliteRegistry.filter(item => 
        item.en.includes(query) || item.fr.includes(query)
      ).sort((a, b) => b.freq - a.freq) // Prioritize by frequency/market signal

      // Filter and deduplicate
      const processedLocal = Array.from(new Set(localMatches.flatMap(m => [m.en, m.fr])))
        .filter(s => {
          const wordCount = s.trim().split(/\s+/).length
          return wordCount >= 1 && wordCount <= 3 && 
                 s.toLowerCase().includes(query) && 
                 !skills.includes(s.toLowerCase())
        })
        .slice(0, 50)

      if (processedLocal.length > 0) {
        setSuggestions(processedLocal)
        setIsFetching(false)
        return
      }

      // 2. Secondary Search: ESCO API Fallback (Only if local empty)
      try {
        const [enRes, frRes] = await Promise.allSettled([
          axios.get(`https://ec.europa.eu/esco/api/search?text=${encodeURIComponent(query)}&language=en&type=skill&limit=10`),
          axios.get(`https://ec.europa.eu/esco/api/search?text=${encodeURIComponent(query)}&language=fr&type=skill&limit=10`)
        ])

        const enSkills = enRes.status === 'fulfilled' ? (enRes.value.data._embedded?.results?.map((r: any) => r.title) || []) : []
        const frSkills = frRes.status === 'fulfilled' ? (frRes.value.data._embedded?.results?.map((r: any) => r.title) || []) : []
        
        const allFetched = [...enSkills, ...frSkills]
        const processed = Array.from(new Set(allFetched))
          .filter((s: string) => {
            const wordCount = s.trim().split(/\s+/).length
            return wordCount >= 1 && wordCount <= 3 && !skills.includes(s.toLowerCase())
          })
          .slice(0, 10)

        setSuggestions(processed)
        if (processed.length === 0) setShowDropdown(false)
      } catch (error) {
        console.error('Deep Search Error:', error)
        setShowDropdown(false)
      } finally {
        setIsFetching(false)
      }
    }, 300)

    return () => clearTimeout(handler)
  }, [newSkill, skills, eliteRegistry])

  const handleAddSkill = (skillToAdd?: string) => {
    const s = (skillToAdd || newSkill).trim()
    if (!s) return
    if (skills.length >= 20) {
      toast({ title: "Skill Limit Reached", description: "You can only have up to 20 skills in your profile.", variant: "destructive" })
      return
    }
    const normalized = s.toLowerCase()
    if (!skills.includes(normalized)) {
      setSkills([...skills, normalized])
    }
    setNewSkill('')
    setShowDropdown(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showDropdown && !isFetching) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setHighlightedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : prev))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setHighlightedIndex(prev => (prev > 0 ? prev - 1 : prev))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (skills.length >= 20) {
          toast({ title: "Skill Limit Reached", description: "You can only have up to 20 skills in your profile.", variant: "destructive" })
          return
        }
        if (highlightedIndex >= 0) {
          handleAddSkill(suggestions[highlightedIndex])
        } else {
          handleAddSkill()
        }
      } else if (e.key === 'Escape') {
        setShowDropdown(false)
      }
    }
  }

  const [showClearConfirm, setShowClearConfirm] = useState(false)

  const handleClearAll = () => {
    setSkills([])
    setShowClearConfirm(false)
    toast({ title: "Nodes Purged", description: "Your skill vector has been reset." })
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

  const [recommendedSkills, setRecommendedSkills] = useState<string[]>([])

  // Dynamic Recommendations logic
  useEffect(() => {
    if (skills.length === 0) {
      setRecommendedSkills([])
      return
    }

    // Heuristic: Find elite skills that share keywords with current skills but aren't already selected
    const currentKeywords = Array.from(new Set(skills.flatMap(s => s.split(/\s+/))))
      .filter(w => w.length > 3) // Ignore short glue words

    const matches = eliteRegistry
      .filter(item => {
        const isAlreadySelected = skills.includes(item.en) || skills.includes(item.fr)
        if (isAlreadySelected) return false
        
        // Match if any keyword is present in en or fr
        return currentKeywords.some(kw => 
          item.en.includes(kw) || item.fr.includes(kw)
        )
      })
      .sort((a, b) => b.freq - a.freq)
      .slice(0, 10)
      .map(m => m.en) // Use EN as primary display

    // If matches are few, pad with top global elite skills
    if (matches.length < 5) {
      const globalTop = eliteRegistry
        .filter(item => !skills.includes(item.en) && !matches.includes(item.en))
        .sort((a, b) => b.freq - a.freq)
        .slice(0, 10 - matches.length)
        .map(m => m.en)
      setRecommendedSkills([...matches, ...globalTop])
    } else {
      setRecommendedSkills(matches)
    }
  }, [skills, eliteRegistry])

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
          {/* Unified Input Section */}
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-tech-cyan/20 rounded-[1.5rem] blur opacity-0 group-focus-within:opacity-100 transition duration-1000"></div>
            <div className="relative">
              <form onSubmit={(e) => { e.preventDefault(); handleAddSkill(); }} className="flex items-center gap-3">
                <div className="relative flex-grow">
                  <Sparkles className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-primary opacity-50" />
                  <Input
                    value={newSkill}
                    onChange={e => setNewSkill(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                    placeholder="Identify new potential..."
                    className="w-full h-14 pl-12 pr-6 bg-white dark:bg-slate-950 border-2 border-slate-100 dark:border-white/5 focus-visible:ring-primary/40 focus-visible:border-primary/40 rounded-2xl text-base font-bold placeholder:text-slate-300 dark:placeholder:text-slate-700 shadow-inner"
                  />

                  {/* Autocomplete Dropdown */}
                  <AnimatePresence>
                    {showDropdown && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute z-50 left-0 right-0 mt-2 p-2 glass-card rounded-2xl border-primary/20 shadow-2xl space-y-1 overflow-y-auto max-h-80 custom-scrollbar"
                      >
                        {isFetching ? (
                          <div className="flex items-center gap-3 px-4 py-6">
                            <Loader2 className="w-4 h-4 text-primary animate-spin" />
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Discovering real-world skills...</span>
                          </div>
                        ) : (
                          suggestions.map((suggestion, index) => (
                            <motion.button
                              key={suggestion}
                              whileHover={{ x: 5 }}
                              onClick={() => handleAddSkill(suggestion)}
                              className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-between group ${
                                index === highlightedIndex 
                                  ? 'bg-primary text-white' 
                                  : 'text-slate-600 dark:text-slate-300 hover:bg-primary/10'
                              }`}
                            >
                              <span>{suggestion}</span>
                              <Sparkles className={`w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity ${
                                index === highlightedIndex ? 'text-white/50' : 'text-primary'
                              }`} />
                            </motion.button>
                          ))
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
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

          {/* Recommended Skills (Conditional & Dynamic) */}
          {skills.length > 0 && recommendedSkills.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-3 pt-2"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Recommended Skills</h4>
                <span className="text-[9px] text-slate-400 font-medium">Based on your nodes</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {recommendedSkills.map(s => (
                  <button
                    key={s}
                    onClick={() => handleAddSkill(s)}
                    className="px-3 py-1.5 bg-primary/5 dark:bg-primary/10 border border-primary/20 hover:border-primary rounded-lg text-[11px] font-bold text-primary transition-all flex items-center gap-2 group"
                  >
                    <Sparkles className="w-3 h-3 opacity-50 group-hover:opacity-100" />
                    {s}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Skill Visualization */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">My Skills</h4>
              {skills.length > 0 && (
                <div className="flex items-center gap-2">
                  <AnimatePresence mode="wait">
                    {showClearConfirm ? (
                      <motion.div 
                        key="confirm"
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                        className="flex items-center gap-2 bg-rose-500/10 p-1 rounded-lg border border-rose-500/20"
                      >
                        <span className="text-[9px] font-black text-rose-500 uppercase tracking-widest pl-2">Confirm?</span>
                        <button 
                          onClick={handleClearAll}
                          className="px-2 py-0.5 bg-rose-500 text-white rounded text-[9px] font-black uppercase hover:bg-rose-600 transition-colors"
                        >
                          Clear
                        </button>
                        <button 
                          onClick={() => setShowClearConfirm(false)}
                          className="px-2 py-0.5 bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-300 rounded text-[9px] font-black uppercase hover:bg-slate-300 transition-colors"
                        >
                          Cancel
                        </button>
                      </motion.div>
                    ) : (
                      <motion.button 
                        key="idle"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowClearConfirm(true)}
                        className="text-[9px] font-black text-rose-400 hover:text-rose-500 uppercase tracking-widest transition-colors flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-rose-500/5 group"
                      >
                        <Trash2 size={10} className="group-hover:scale-110 transition-transform" />
                        Clear All
                      </motion.button>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
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
