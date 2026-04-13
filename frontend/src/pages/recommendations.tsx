import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useAuth } from '@/context/auth-context'
import { getRecommendations } from '@/lib/api'
import { Recommendation } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Briefcase, Building, MapPin, ExternalLink, Activity } from 'lucide-react'

export default function Recommendations() {
  const { user } = useAuth()
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) {
      getRecommendations(user.id)
        .then(data => {
          setRecommendations(data || [])
          setLoading(false)
        })
        .catch(() => {
          setLoading(false)
        })
    }
  }, [user])

  if (loading) return (
    <div className="flex justify-center py-20">
      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
    </div>
  )

  if (recommendations.length === 0) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl mx-auto p-12 text-center glass-card rounded-2xl mt-12"
      >
        <div className="bg-slate-100 dark:bg-slate-800 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
          <Activity className="w-10 h-10 text-slate-400" />
        </div>
        <h2 className="text-3xl font-bold mb-4 text-foreground">No recommendations found yet.</h2>
        <p className="text-muted-foreground text-lg max-w-xl mx-auto">Try adding more specific skills to your profile, or wait a few moments for more jobs to be scraped into the engine.</p>
      </motion.div>
    )
  }

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  }

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 pt-6 pb-12">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-primary/10 rounded-xl">
          <Briefcase className="w-8 h-8 text-primary" />
        </div>
        <div>
          <h1 className="text-4xl font-extrabold text-foreground tracking-tight">Personalized Matches</h1>
          <p className="text-muted-foreground mt-1 text-lg">AI-ranked job offers based on your unique skill vector.</p>
        </div>
      </div>
      
      <motion.div variants={container} initial="hidden" animate="show" className="grid gap-6">
        {recommendations.map((rec, idx) => (
          <motion.div key={idx} variants={item} className="glass-card rounded-2xl overflow-hidden hover:border-primary/50 transition-colors group relative">
            <div className={`absolute top-0 left-0 w-1.5 h-full ${rec.match_score >= 70 ? 'bg-emerald-500' : (rec.match_score >= 40 ? 'bg-amber-500' : 'bg-rose-500')}`} />
            
            <div className="p-6 sm:p-8 flex flex-col md:flex-row gap-6 items-start justify-between">
              <div className="flex-1 space-y-4">
                <div>
                  <h3 className="text-2xl font-bold text-foreground mb-2 group-hover:text-primary transition-colors">{rec.title}</h3>
                  <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground font-medium">
                    <span className="flex items-center gap-1.5"><Building className="w-4 h-4" /> {rec.company}</span>
                    <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4" /> {rec.job?.location || 'Morocco'}</span>
                    <Badge variant="secondary" className="bg-slate-100 dark:bg-slate-800">{rec.source}</Badge>
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  {rec.matched_skills?.length > 0 && (
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-2 block">✓ Matched Skills</span>
                      <div className="flex flex-wrap gap-1.5">
                        {rec.matched_skills.map(s => <Badge key={s} className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800/30 hover:bg-emerald-100 font-medium">{s}</Badge>)}
                      </div>
                    </div>
                  )}
                  {rec.missing_skills?.length > 0 && (
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 block">↘ To Learn</span>
                      <div className="flex flex-wrap gap-1.5">
                        {rec.missing_skills.slice(0, 6).map(s => <Badge key={s} variant="outline" className="text-slate-500 border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-black/20 font-medium">{s}</Badge>)}
                        {rec.missing_skills.length > 6 && <span className="text-xs text-slate-400 flex items-center ml-1">+{rec.missing_skills.length - 6} more</span>}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col items-end gap-6 shrink-0 w-full md:w-auto mt-4 md:mt-0">
                <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white/50 dark:bg-black/20 border border-slate-100 dark:border-slate-800 min-w-[120px]">
                  <span className={`text-4xl font-black ${rec.match_score >= 70 ? 'text-emerald-500' : (rec.match_score >= 40 ? 'text-amber-500' : 'text-rose-500')}`}>
                    {rec.match_score.toFixed(0)}%
                  </span>
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">Match</span>
                </div>
                
                <a href={rec.url} target="_blank" rel="noreferrer" className="w-full">
                  <Button className="w-full shadow-lg rounded-xl flex items-center gap-2 group-hover:shadow-primary/25 transition-all">
                    View Offer <ExternalLink className="w-4 h-4 ml-1" />
                  </Button>
                </a>
              </div>
            </div>
          </motion.div>
        ))}
      </motion.div>
    </div>
  )
}
