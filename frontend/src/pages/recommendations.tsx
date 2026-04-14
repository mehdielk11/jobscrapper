import { useEffect, useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '@/context/auth-context'
import { useRecommendations } from '@/context/recommendations-context'
import { triggerScrape } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Building, MapPin, ExternalLink,
  Search, ChevronLeft, ChevronRight,
  RefreshCcw, AlertCircle, Sparkles
} from 'lucide-react'
import { toast } from '@/hooks/use-toast'

export default function Recommendations() {
  const { user } = useAuth()
  // Pull from global cache — survives tab switching / navigation
  const { data: recommendations, totalScanned, loading, error, fetchIfNeeded } = useRecommendations()
  const [refreshing, setRefreshing] = useState(false)

  const [searchTerm, setSearchTerm] = useState('')
  const [filterSource, setFilterSource] = useState('All Sources')
  const [sortBy, setSortBy] = useState<'score' | 'title' | 'company'>('score')
  const [minScore, setMinScore] = useState(0)
  const [maxScore, setMaxScore] = useState(100)

  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 12

  // fetchIfNeeded is stable (useCallback with [] deps) so this is lint-clean
  useEffect(() => {
    if (user) fetchIfNeeded(user.id)
  }, [user, fetchIfNeeded])

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await triggerScrape()
      toast({
        title: "Pipeline Triggered",
        description: "Scrapers are running in the background. Refresh in a few minutes.",
      })
      // Force re-fetch to pick up new data
      if (user) await fetchIfNeeded(user.id, true)
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
      const matchesRange = rec.match_score >= minScore && rec.match_score <= maxScore
      return matchesSearch && matchesSource && matchesRange
    })
    result.sort((a, b) => {
      if (sortBy === 'score') return b.match_score - a.match_score
      if (sortBy === 'title') return a.title.localeCompare(b.title)
      if (sortBy === 'company') return a.company.localeCompare(b.company)
      return 0
    })
    return result
  }, [recommendations, searchTerm, filterSource, sortBy, minScore, maxScore])

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
    <div className="space-y-6 pb-20">
      {/* Header section with Stats */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-slate-50 dark:bg-slate-900/40 p-6 rounded-2xl border border-slate-200 dark:border-white/5">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-black tracking-tighter text-slate-950 dark:text-white">Discovery</h1>
            <Badge className="bg-primary text-white font-black px-2 py-0.5 text-[9px] rounded-full">AI RANKED</Badge>
          </div>
          <p className="text-slate-500 dark:text-slate-400 font-medium text-sm leading-relaxed">
            Discover opportunities tailored specifically for your career vector and skill set.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden lg:flex items-center gap-6 px-6 border-r border-slate-200 dark:border-white/5 mr-4 font-black">
            <div className="text-center"><div className="text-slate-950 dark:text-white text-xl">{filteredData.length}</div><div className="text-[9px] text-slate-500 uppercase">Matches</div></div>
            <div className="text-center"><div className="text-emerald-500 text-xl">{filteredData.filter(r => r.match_score >= 70).length}</div><div className="text-[9px] text-slate-500 uppercase">Strong</div></div>
          </div>
          <Button
            onClick={handleRefresh}
            disabled={refreshing}
            className="rounded-xl h-11 px-6 font-black bg-black dark:bg-white text-white dark:text-black hover:opacity-90 shadow-lg"
          >
            <RefreshCcw className={`w-3.5 h-3.5 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Sync Results
          </Button>
        </div>
      </div>

      {/* Advanced Control Grid */}
      <div className="flex flex-col xl:flex-row gap-3 items-center bg-white/50 dark:bg-slate-900/60 p-3 rounded-2xl border border-slate-200 dark:border-white/5">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text" placeholder="Filter opportunities..."
            value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white/50 dark:bg-slate-950/50 border border-slate-200 dark:border-white/5 rounded-xl pl-12 pr-4 py-2.5 focus:border-slate-900 transition-all outline-none text-slate-900 dark:text-white font-medium text-sm"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto text-xs">
          <select
            value={filterSource} onChange={e => setFilterSource(e.target.value)}
            className="bg-white/50 dark:bg-slate-950/50 border border-slate-200 dark:border-white/5 rounded-xl px-4 py-2.5 font-bold text-slate-900 dark:text-white outline-none cursor-pointer transition-all"
          >
            {sources.map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          <select
            value={sortBy} onChange={e => setSortBy(e.target.value as any)}
            className="bg-white/50 dark:bg-slate-950/50 border border-slate-200 dark:border-white/5 rounded-xl px-4 py-2.5 font-bold text-slate-900 dark:text-white outline-none cursor-pointer transition-all"
          >
            <option value="score">Best Match</option>
            <option value="title">Alphabetical</option>
            <option value="company">Corporate</option>
          </select>

          <div className="flex items-center gap-2 bg-white/50 dark:bg-slate-950/50 border border-slate-200 dark:border-white/5 rounded-xl px-4 py-2">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Min {minScore}%</span>
            <input
              type="range" min="0" max="100" step="5"
              value={minScore} onChange={e => setMinScore(Math.min(parseInt(e.target.value), maxScore))}
              className="w-16 h-1 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-black dark:accent-white"
            />
          </div>
        </div>
      </div>

      {/* Discovery Results */}
      <AnimatePresence mode="wait">
        {filteredData.length > 0 ? (
          <motion.div
            key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"
          >
            {paginatedData.map((rec, idx) => (
              <motion.div
                key={rec.url} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.03 }}
                className="bg-white dark:bg-slate-900 group p-6 rounded-2xl border border-slate-200 dark:border-white/5 flex flex-col justify-between gap-6 hover:border-slate-300 dark:hover:border-white/20 transition-all duration-200 shadow-sm"
              >
                <div className="space-y-4">
                  <div className="flex justify-between items-start gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-[8px] font-black tracking-widest uppercase border-slate-200 dark:border-white/10 text-slate-500">{rec.source}</Badge>
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><MapPin className="w-2.5 h-2.5" /> {rec.job?.location || 'Morocco'}</span>
                      </div>
                      <h3 className="text-xl font-black text-slate-950 dark:text-white leading-tight transition-colors cursor-pointer">{rec.title}</h3>
                      <div className="flex items-center gap-2 text-slate-500 font-bold text-xs"><Building className="w-3.5 h-3.5 opacity-50" /> {rec.company}</div>
                    </div>
                    <div className="text-center px-2 py-2 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-100 dark:border-white/5 min-w-[70px] flex-shrink-0">
                      <div className={`text-lg font-black ${rec.match_score >= 70 ? 'text-emerald-500' : (rec.match_score >= 40 ? 'text-amber-500' : 'text-rose-500')}`}>
                        {rec.match_score.toFixed(0)}%
                      </div>
                      <div className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Match</div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {rec.matched_skills?.slice(0, 10).map(s => (
                      <Badge
                        key={s}
                        className="bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-500/20 font-black text-[9px] px-2 py-0.5 uppercase transition-all hover:bg-blue-600 dark:hover:bg-blue-600 hover:text-white dark:hover:text-white cursor-default"
                      >
                        {s}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 dark:border-white/5 flex items-center justify-between">
                  <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{rec.matched_skills?.length || 0} Matches</div>
                  <a href={rec.url} target="_blank" rel="noreferrer">
                    <Button variant="outline" className="rounded-lg font-black text-[10px] uppercase tracking-widest h-9 px-4 border-slate-200 dark:border-white/10 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all">
                      Analyze <ExternalLink className="w-3 h-3 ml-2" />
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
            <AlertCircle className={`w-16 h-16 mx-auto mb-6 ${error ? 'text-red-400' : 'text-slate-400 dark:text-slate-700'}`} />
            <h2 className="text-3xl font-black text-slate-950 dark:text-white mb-4">
              {error ? 'Failed to load recommendations' : 'No matching vectors found.'}
            </h2>
            <p className="text-slate-600 dark:text-slate-500 font-medium max-w-sm mx-auto">
              {error ?? 'Try widening your search terms or lowering the matching threshold.'}
            </p>
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
