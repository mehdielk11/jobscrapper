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
  RefreshCcw, AlertCircle, CheckCircle2
} from 'lucide-react'
import { toast } from '@/hooks/use-toast'

export default function Recommendations() {
  const { user } = useAuth()
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  
  // Filters & Sorting state
  const [searchTerm, setSearchTerm] = useState('')
  const [filterSource, setFilterSource] = useState('All Sources')
  const [sortBy, setSortBy] = useState<'score' | 'title' | 'company'>('score')
  const [showLowScores, setShowLowScores] = useState(false)
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 8

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
        title: "Scraper Started",
        description: "The background scraping process has been initiated. Results will appear shortly.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to trigger scraping process.",
        variant: "destructive"
      })
    } finally {
      setRefreshing(false)
    }
  }

  // Derived filtered & sorted data
  const filteredData = useMemo(() => {
    let result = recommendations.filter(rec => {
      // 1. Search filter
      const matchesSearch = 
        rec.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
        rec.company.toLowerCase().includes(searchTerm.toLowerCase())
      
      // 2. Source filter
      const matchesSource = filterSource === 'All Sources' || rec.source === filterSource
      
      // 3. Threshold filter (60%)
      const matchesThreshold = showLowScores || rec.match_score >= 60
      
      return matchesSearch && matchesSource && matchesThreshold
    })

    // 4. Sorting
    result.sort((a, b) => {
      if (sortBy === 'score') return b.match_score - a.match_score
      if (sortBy === 'title') return a.title.localeCompare(b.title)
      if (sortBy === 'company') return a.company.localeCompare(b.company)
      return 0
    })

    return result
  }, [recommendations, searchTerm, filterSource, sortBy, showLowScores])

  // Pagination logic
  const totalPages = Math.ceil(filteredData.length / itemsPerPage)
  const paginatedData = filteredData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  const sources = useMemo(() => {
    const unique = new Set(recommendations.map(r => r.source))
    return ['All Sources', ...Array.from(unique)]
  }, [recommendations])

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-32 space-y-4">
      <motion.div 
        animate={{ rotate: 360 }} 
        transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }} 
        className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full shadow-lg" 
      />
      <p className="text-muted-foreground font-medium animate-pulse">Calculating matches...</p>
    </div>
  )

  return (
    <div className="max-w-6xl mx-auto space-y-8 pt-6 pb-20 px-4">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 rounded-xl">
              <Activity className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-4xl font-black tracking-tight text-foreground">Recommendations</h1>
          </div>
          <p className="text-muted-foreground text-lg">AI-ranked job offers based on your profile skills.</p>
        </div>
        
        <Button 
          onClick={handleRefresh} 
          disabled={refreshing}
          variant="outline"
          className="rounded-xl border-2 hover:bg-primary/5 group transition-all"
        >
          <RefreshCcw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
          {refreshing ? 'Triggering...' : 'Refresh Database'}
        </Button>
      </div>

      {/* Controls: Search, Filter, Sort, Toggle */}
      <div className="glass-card p-4 rounded-2xl border flex flex-col lg:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input 
            type="text"
            placeholder="Search job title or company..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-xl pl-10 pr-4 py-2.5 focus:ring-2 focus:ring-primary/20 transition-all outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 rounded-xl px-3 py-1.5 border border-transparent hover:border-slate-200 transition-all">
            <Filter className="w-4 h-4 text-slate-400" />
            <select 
              value={filterSource} 
              onChange={e => setFilterSource(e.target.value)}
              className="bg-transparent text-sm font-semibold outline-none border-none py-1"
            >
              {sources.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 rounded-xl px-3 py-1.5 border border-transparent hover:border-slate-200 transition-all">
            <ArrowUpDown className="w-4 h-4 text-slate-400" />
            <select 
              value={sortBy} 
              onChange={e => setSortBy(e.target.value as any)}
              className="bg-transparent text-sm font-semibold outline-none border-none py-1"
            >
              <option value="score">Sort by Match %</option>
              <option value="title">Sort by Title</option>
              <option value="company">Sort by Company</option>
            </select>
          </div>

          <div 
            onClick={() => setShowLowScores(!showLowScores)}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 cursor-pointer transition-all border-2 ${showLowScores ? 'bg-primary/5 border-primary/20' : 'bg-slate-50 dark:bg-slate-900 border-transparent'}`}
          >
            <div className={`w-3 h-3 rounded-full ${showLowScores ? 'bg-primary' : 'bg-slate-300'}`} />
            <span className="text-sm font-bold select-none">Show All Matches</span>
          </div>
        </div>
      </div>

      {/* Results List */}
      <AnimatePresence mode="wait">
        {filteredData.length > 0 ? (
          <motion.div 
            key="results"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="space-y-4"
          >
            {paginatedData.map((rec, idx) => (
              <motion.div 
                key={rec.url + idx}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="glass-card rounded-2xl overflow-hidden hover:border-primary/50 transition-all group relative border border-transparent"
              >
                <div className={`absolute top-0 left-0 w-1.5 h-full ${rec.match_score >= 70 ? 'bg-emerald-500' : (rec.match_score >= 40 ? 'bg-amber-500' : 'bg-rose-500')}`} />
                
                <div className="p-6 md:p-8 flex flex-col md:flex-row gap-6 items-start justify-between">
                  <div className="flex-1 space-y-4">
                    <div>
                      <h3 className="text-2xl font-bold text-foreground mb-2 group-hover:text-primary transition-colors">{rec.title}</h3>
                      <div className="flex flex-wrap items-center gap-5 text-sm text-muted-foreground font-semibold">
                        <span className="flex items-center gap-1.5"><Building className="w-4 h-4 text-slate-400" /> {rec.company}</span>
                        <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4 text-slate-400" /> {rec.job?.location || 'Morocco'}</span>
                        <Badge variant="secondary" className="bg-slate-100 dark:bg-slate-800 uppercase tracking-tighter text-[10px]">{rec.source}</Badge>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                      {rec.matched_skills?.length > 0 && (
                        <div className="space-y-2">
                          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Matched
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {rec.matched_skills.map(s => <Badge key={s} className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800/30 font-bold">{s}</Badge>)}
                          </div>
                        </div>
                      )}
                      {rec.missing_skills?.length > 0 && (
                        <div className="space-y-2">
                          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" /> Gap
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {rec.missing_skills.slice(0, 5).map(s => <Badge key={s} variant="outline" className="text-slate-500 border-slate-200 dark:border-slate-800 font-bold text-[10px]">{s}</Badge>)}
                            {rec.missing_skills.length > 5 && <span className="text-[10px] text-slate-400 font-black">+{rec.missing_skills.length - 5}</span>}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-center md:items-end gap-6 shrink-0 w-full md:w-auto">
                    <div className="flex flex-col items-center justify-center p-5 rounded-2xl bg-slate-50/50 dark:bg-slate-900/50 border min-w-[140px]">
                      <span className={`text-4xl font-black ${rec.match_score >= 70 ? 'text-emerald-500' : (rec.match_score >= 40 ? 'text-amber-500' : 'text-rose-500')}`}>
                        {rec.match_score.toFixed(0)}%
                      </span>
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mt-1">Similarity</span>
                    </div>
                    
                    <a href={rec.url} target="_blank" rel="noreferrer" className="w-full">
                      <Button className="w-full shadow-lg rounded-xl flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all font-bold">
                        View Offer <ExternalLink className="w-4 h-4" />
                      </Button>
                    </a>
                  </div>
                </div>
              </motion.div>
            ))}
            
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-4 py-8">
                <Button 
                  variant="ghost" 
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => p - 1)}
                  className="rounded-xl"
                >
                  <ChevronLeft className="w-4 h-4 mr-2" /> Prev
                </Button>
                <div className="flex gap-2">
                  {Array.from({ length: totalPages }).map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setCurrentPage(i + 1)}
                      className={`w-10 h-10 rounded-xl font-bold transition-all ${currentPage === i + 1 ? 'bg-primary text-white shadow-lg' : 'hover:bg-slate-100 text-slate-500'}`}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
                <Button 
                  variant="ghost"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(p => p + 1)}
                  className="rounded-xl"
                >
                  Next <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div 
            key="empty"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="p-16 text-center glass-card rounded-2xl mt-8 border-dashed border-2"
          >
            <div className="bg-slate-100 dark:bg-slate-800 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-8">
              <Activity className="w-12 h-12 text-slate-400" />
            </div>
            <h2 className="text-3xl font-black mb-4">No matches found.</h2>
            <p className="text-secondary-foreground text-lg max-w-xl mx-auto opacity-70">
              {searchTerm ? "Try adjusting your search terms or filters." : "Try expanding your profile skills, or click 'Refresh Database' to pull latest offers."}
            </p>
            {searchTerm && <Button onClick={() => setSearchTerm('')} variant="link" className="mt-4 font-bold">Clear search</Button>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
