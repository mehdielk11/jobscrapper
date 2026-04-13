import { useEffect, useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '@/context/auth-context'
import { getRecommendations, triggerScrape } from '@/lib/api'
import { Recommendation } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  Briefcase, Building, MapPin, ExternalLink, Activity, 
  Search, Filter, ArrowUpDown, ChevronLeft, ChevronRight,
  RefreshCcw, AlertCircle, CheckCircle2, Sparkles
} from 'lucide-react'
import { toast } from '@/hooks/use-toast'

export default function Recommendations() {
  const { user } = useAuth()
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  
  const [searchTerm, setSearchTerm] = useState('')
  const [filterSource, setFilterSource] = useState('All Sources')
  const [sortBy, setSortBy] = useState<'score' | 'title' | 'company'>('score')
  const [showLowScores, setShowLowScores] = useState(false)
  
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 6

  useEffect(() => {
    fetchData()
  }, [user])

  const fetchData = async () => {
    if (!user) return
    setLoading(true)
    try {
      const data = await getRecommendations(user.id)
      setRecommendations(data || [])
    } catch (error) {
      console.error('Failed to fetch recommendations:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await triggerScrape()
      toast({
        title: "Pipeline Triggered",
        description: "Scrapers are running in the background. Refresh in a few minutes.",
      })
    } catch (error) {
      toast({ title: "Error", description: "Failed to trigger.", variant: "destructive" })
    } finally {
      setRefreshing(false)
    }
  }

  const filteredData = useMemo(() => {
    let result = recommendations.filter(rec => {
      const matchesSearch = rec.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           rec.company.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesSource = filterSource === 'All Sources' || rec.source === filterSource
      const matchesThreshold = showLowScores || rec.match_score >= 60
      return matchesSearch && matchesSource && matchesThreshold
    })
    result.sort((a, b) => {
      if (sortBy === 'score') return b.match_score - a.match_score
      if (sortBy === 'title') return a.title.localeCompare(b.title)
      if (sortBy === 'company') return a.company.localeCompare(b.company)
      return 0
    })
    return result
  }, [recommendations, searchTerm, filterSource, sortBy, showLowScores])

  const totalPages = Math.ceil(filteredData.length / itemsPerPage)
  const paginatedData = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  const sources = useMemo(() => {
    const unique = new Set(recommendations.map(r => r.source))
    return ['All Sources', ...Array.from(unique)]
  }, [recommendations])

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-40 space-y-6">
      <motion.div 
        animate={{ rotate: 360, scale: [1, 1.2, 1] }} 
        transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }} 
        className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center border border-primary/30"
      >
        <Sparkles className="text-primary w-8 h-8" />
      </motion.div>
      <p className="text-slate-500 font-black uppercase tracking-[0.3em] text-xs">Analyzing Market Vectors...</p>
    </div>
  )

  return (
    <div className="space-y-12 pb-20">
      {/* Header section with Stats */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 bg-slate-900/40 p-10 rounded-[2.5rem] border border-white/5">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <h1 className="text-5xl font-black tracking-tighter text-white">Discovery</h1>
            <Badge className="bg-primary text-white font-black px-3 py-1 text-xs">AI RANKED</Badge>
          </div>
          <p className="text-slate-400 font-medium text-lg leading-relaxed">
            Neural cross-matching of {recommendations.length} job offers against your profile.
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="hidden lg:flex items-center gap-6 px-8 border-r border-white/5 mr-4 font-black">
            <div className="text-center"><div className="text-white text-2xl">{filteredData.length}</div><div className="text-[10px] text-slate-500 uppercase">Total Matches</div></div>
            <div className="text-center"><div className="text-primary text-2xl">{filteredData.filter(r => r.match_score >= 80).length}</div><div className="text-[10px] text-slate-500 uppercase">Strong Fits</div></div>
          </div>
          <Button 
            onClick={handleRefresh} 
            disabled={refreshing}
            className="rounded-2xl h-14 px-8 font-black bg-white text-slate-950 hover:bg-slate-200 shadow-xl atom-hover"
          >
            <RefreshCcw className={`w-4 h-4 mr-3 ${refreshing ? 'animate-spin' : ''}`} />
            Sync Results
          </Button>
        </div>
      </div>

      {/* Advanced Control Grid */}
      <div className="flex flex-col xl:flex-row gap-4 items-center bg-slate-900/60 p-4 rounded-3xl border border-white/5">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input 
            type="text" placeholder="Search title, company, or tech stack..."
            value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950/50 border border-white/5 rounded-2xl pl-12 pr-4 py-3.5 focus:border-primary/50 transition-all outline-none text-white font-medium"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
          <select 
            value={filterSource} onChange={e => setFilterSource(e.target.value)}
            className="bg-slate-950/50 border border-white/5 rounded-2xl px-5 py-3.5 text-sm font-bold text-white outline-none cursor-pointer hover:border-white/20 transition-all min-w-[150px]"
          >
            {sources.map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          <select 
            value={sortBy} onChange={e => setSortBy(e.target.value as any)}
            className="bg-slate-950/50 border border-white/5 rounded-2xl px-5 py-3.5 text-sm font-bold text-white outline-none cursor-pointer hover:border-white/20 transition-all min-w-[150px]"
          >
            <option value="score">Score</option>
            <option value="title">Alphabetical</option>
            <option value="company">Corporate</option>
          </select>

          <div 
            onClick={() => setShowLowScores(!showLowScores)}
            className={`flex items-center gap-3 rounded-2xl px-6 py-3.5 cursor-pointer transition-all border ${showLowScores ? 'bg-primary border-primary/50 text-white' : 'bg-slate-950/50 border-white/5 text-slate-400 hover:border-white/20'}`}
          >
            <div className={`w-3 h-3 rounded-full ${showLowScores ? 'bg-white' : 'bg-slate-700'}`} />
            <span className="text-sm font-black select-none uppercase tracking-tighter">Extended Matches</span>
          </div>
        </div>
      </div>

      {/* Discovery Results */}
      <AnimatePresence mode="wait">
        {filteredData.length > 0 ? (
          <motion.div 
            key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-6"
          >
            {paginatedData.map((rec, idx) => (
              <motion.div 
                key={rec.url} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="glass-card group p-8 rounded-[2rem] flex flex-col justify-between gap-8 hover:border-primary/40 transition-all duration-300"
              >
                <div className="space-y-6">
                  <div className="flex justify-between items-start gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-[9px] font-black tracking-widest uppercase border-primary/20 text-primary bg-primary/5">{rec.source}</Badge>
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1"><MapPin className="w-2.5 h-2.5" /> {rec.job?.location || 'Morocco'}</span>
                      </div>
                      <h3 className="text-2xl font-black text-white leading-tight group-hover:text-primary transition-colors cursor-pointer">{rec.title}</h3>
                      <div className="flex items-center gap-2 text-slate-400 font-bold text-sm"><Building className="w-4 h-4 opacity-50" /> {rec.company}</div>
                    </div>
                    <div className="text-center px-4 py-3 rounded-2xl bg-slate-950/50 border border-white/5 min-w-[80px]">
                      <div className={`text-2xl font-black ${rec.match_score >= 80 ? 'text-primary' : (rec.match_score >= 50 ? 'text-white' : 'text-slate-500')}`}>
                        {rec.match_score.toFixed(0)}%
                      </div>
                      <div className="text-[8px] font-black text-slate-600 uppercase tracking-widest mt-1">Match</div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-1.5">
                      {rec.matched_skills?.slice(0, 10).map(s => <Badge key={s} className="bg-primary/10 text-primary border-primary/20 font-black text-[10px] px-2.5 py-1 uppercase">{s}</Badge>)}
                      {rec.missing_skills?.slice(0, 3).map(s => <Badge key={s} variant="outline" className="text-slate-600 border-white/5 font-black text-[10px] px-2.5 py-1 uppercase opacity-60 italic">{s}</Badge>)}
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                   <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">{rec.matched_skills?.length || 0} Matched Samples</div>
                   <a href={rec.url} target="_blank" rel="noreferrer">
                    <Button variant="outline" className="rounded-xl font-black text-[11px] uppercase tracking-widest h-11 px-6 border-white/10 hover:bg-white hover:text-slate-950 atom-hover">
                      Analyze Offer <ExternalLink className="w-3.5 h-3.5 ml-2" />
                    </Button>
                   </a>
                </div>
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <motion.div 
            key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="py-32 text-center glass-card rounded-[3rem] border-dashed"
          >
            <AlertCircle className="w-16 h-16 text-slate-700 mx-auto mb-6" />
            <h2 className="text-3xl font-black text-white mb-4">No matching vectors found.</h2>
            <p className="text-slate-500 font-medium max-w-sm mx-auto">Try widening your search terms or lowering the matching threshold.</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 py-12">
          <Button variant="ghost" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="rounded-xl text-slate-500 hover:text-white">
            <ChevronLeft className="w-4 h-4 mr-2" /> Prev
          </Button>
          <div className="flex gap-2">
            {Array.from({ length: totalPages }).map((_, i) => (
              <button key={i} onClick={() => setCurrentPage(i + 1)} className={`w-10 h-10 rounded-xl font-black text-xs transition-all ${currentPage === i + 1 ? 'bg-primary text-white shadow-xl shadow-primary/20 scale-110' : 'text-slate-600 hover:text-slate-300'}`}>
                {i + 1}
              </button>
            ))}
          </div>
          <Button variant="ghost" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="rounded-xl text-slate-500 hover:text-white">
            Next <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      )}
    </div>
  )
}
