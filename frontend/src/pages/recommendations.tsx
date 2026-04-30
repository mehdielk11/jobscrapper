import { useEffect, useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/auth-context'
import { useRecommendations } from '@/context/recommendations-context'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Building, MapPin, ExternalLink,
  Search, ChevronLeft, ChevronRight,
  AlertCircle, Sparkles, UserPlus,
  ArrowRight, Filter, X
} from 'lucide-react'

const DIPLOMAS = ["bac+2", "bac+3/Licence", "bac+5/master/Ingénieur", "Doctorat"];
const DATE_RANGES = [
  { label: "Any time", value: "" },
  { label: "Past 24 hours", value: "24h" },
  { label: "Past Week", value: "7d" },
  { label: "Past Month", value: "30d" },
  { label: "Custom", value: "custom" }
];

export default function Recommendations() {
  const { user } = useAuth()
  // Pull from global cache — survives tab switching / navigation
  const { data: recommendations, loading, error, fetchIfNeeded } = useRecommendations()
  const [searchTerm, setSearchTerm] = useState('')
  const [filterSource, setFilterSource] = useState('All Sources')
  const [minScore, setMinScore] = useState(0)
  const [maxScore] = useState(100)
  const [diplomaFilter, setDiplomaFilter] = useState<string[]>([])
  const [datePostedFilter, setDatePostedFilter] = useState<string>('')
  const [customDate, setCustomDate] = useState<string>('')
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false)

  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 12

  const datePostedGte = useMemo(() => {
    if (datePostedFilter === '24h') return new Date(Date.now() - 86400000).toISOString()
    if (datePostedFilter === '7d') return new Date(Date.now() - 7 * 86400000).toISOString()
    if (datePostedFilter === '30d') return new Date(Date.now() - 30 * 86400000).toISOString()
    if (datePostedFilter === 'custom' && customDate) return new Date(customDate).toISOString()
    return undefined
  }, [datePostedFilter, customDate])

  // fetchIfNeeded is stable (useCallback with [] deps) so this is lint-clean
  useEffect(() => {
    if (user) {
      const filters = {
        diploma: diplomaFilter.length > 0 ? diplomaFilter.join(',') : undefined,
        datePostedGte
      }
      fetchIfNeeded(user.id, filters, false)
    }
  }, [user, fetchIfNeeded, diplomaFilter, datePostedGte])

  const toggleDiploma = (d: string) => {
    setDiplomaFilter(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])
  }

  // Reset pagination when any filter changes
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, filterSource, minScore, diplomaFilter, datePostedFilter, customDate])

  const filteredData = useMemo(() => {
    let result = recommendations.filter(rec => {
      const matchesSearch = rec.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rec.company.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesSource = filterSource === 'All Sources' || rec.source === filterSource
      const matchesRange = rec.match_score >= minScore && rec.match_score <= maxScore
      return matchesSearch && matchesSource && matchesRange
    })
    result.sort((a, b) => b.match_score - a.match_score)
    return result
  }, [recommendations, searchTerm, filterSource, minScore, maxScore])

  const totalPages = Math.ceil(filteredData.length / itemsPerPage)
  const paginatedData = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  const sources = useMemo(() => {
    const unique = new Set(recommendations.map(r => r.source))
    return ['All Sources', ...Array.from(unique)]
  }, [recommendations])



  const getPageNumbers = (current: number, total: number) => {
    if (total <= 6) return Array.from({ length: total }, (_, i) => i + 1);
    if (current <= 3) return [1, 2, 3, 4, '...', total];
    if (current >= total - 2) return [1, '...', total - 3, total - 2, total - 1, total];
    return [1, '...', current - 1, current, current + 1, '...', total];
  };

  const filterContent = (
    <div className="space-y-8">
      <div>
        <h3 className="text-sm font-black text-slate-950 dark:text-white mb-4 uppercase tracking-wider">Diploma Level</h3>
        <div className="space-y-3">
          {DIPLOMAS.map(d => (
            <label key={d} className="flex items-center gap-3 cursor-pointer group" onClick={(e) => { e.preventDefault(); toggleDiploma(d); }}>
              <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${diplomaFilter.includes(d) ? 'bg-primary border-primary' : 'border-slate-300 dark:border-slate-600 group-hover:border-primary'}`}>
                {diplomaFilter.includes(d) && <div className="w-2 h-2 bg-white rounded-sm" />}
              </div>
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300 group-hover:text-slate-950 dark:group-hover:text-white transition-colors">{d}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-black text-slate-950 dark:text-white mb-4 uppercase tracking-wider">Date Posted</h3>
        <div className="space-y-3">
          {DATE_RANGES.map(r => (
            <label key={r.value} className="flex items-center gap-3 cursor-pointer group">
              <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${datePostedFilter === r.value ? 'border-primary' : 'border-slate-300 dark:border-slate-600 group-hover:border-primary'}`}>
                {datePostedFilter === r.value && <div className="w-2 h-2 bg-primary rounded-full" />}
              </div>
              <input type="radio" className="hidden" name="datePosted" value={r.value} checked={datePostedFilter === r.value} onChange={() => setDatePostedFilter(r.value)} />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300 group-hover:text-slate-950 dark:group-hover:text-white transition-colors">{r.label}</span>
            </label>
          ))}
          <AnimatePresence>
            {datePostedFilter === 'custom' && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="pt-2 overflow-hidden">
                <input
                  type="date"
                  value={customDate}
                  onChange={(e) => setCustomDate(e.target.value)}
                  className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm font-medium outline-none text-slate-900 dark:text-white focus:border-primary transition-all"
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-black text-slate-950 dark:text-white mb-4 uppercase tracking-wider">Match Score Minimum</h3>
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-black text-slate-500 uppercase tracking-widest">{minScore}%</span>
          <input
            type="range" min="0" max="100" step="5"
            value={minScore} onChange={e => setMinScore(Math.min(parseInt(e.target.value), maxScore))}
            className="flex-1 h-1 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-black dark:accent-white"
          />
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 pb-20">
      {/* Header section with Stats */}
      <div className="flex flex-row items-center justify-between gap-2 md:gap-6 bg-slate-50 dark:bg-slate-900/40 p-4 md:p-6 rounded-2xl border border-slate-200 dark:border-white/5">
        <div className="space-y-1 md:space-y-2">
          <div className="flex items-center gap-2 md:gap-3">
            <h1 className="text-xl md:text-3xl font-black tracking-tighter text-slate-950 dark:text-white">Discovery</h1>
            <Badge className="bg-primary text-white font-black px-1.5 md:px-2 py-0 md:py-0.5 text-[7px] md:text-[9px] rounded-full">AI RANKED</Badge>
          </div>
          <p className="hidden md:block text-slate-500 dark:text-slate-400 font-medium text-sm leading-relaxed">
            Discover opportunities tailored specifically for your career vector and skill set.
          </p>
        </div>

        <div className="flex items-center gap-3 md:gap-6 px-1 md:px-6 font-black text-[10px] md:text-xs">
          <div className="text-center">
            <div className="text-slate-950 dark:text-white text-base md:text-xl">{filteredData.length}</div>
            <div className="text-[7px] md:text-[9px] text-slate-500 uppercase">Matches</div>
          </div>
          <div className="text-center">
            <div className="text-emerald-500 text-base md:text-xl">{filteredData.filter(r => r.match_score >= 70).length}</div>
            <div className="text-[7px] md:text-[9px] text-slate-500 uppercase">Strong</div>
          </div>
        </div>
      </div>


      <div className="flex flex-col lg:flex-row gap-8 items-start">
        {/* Mobile Filters Modal */}
        <AnimatePresence>
          {isMobileFiltersOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 lg:hidden"
                onClick={() => setIsMobileFiltersOpen(false)}
              />
              <motion.div
                initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="fixed inset-x-0 bottom-0 z-50 bg-white dark:bg-slate-950 rounded-t-[2rem] shadow-[0_-10px_40px_rgba(0,0,0,0.1)] p-6 lg:hidden max-h-[85vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-black text-slate-950 dark:text-white tracking-tight">Filters</h2>
                  <Button variant="ghost" size="icon" className="rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900" onClick={() => setIsMobileFiltersOpen(false)}>
                    <X className="w-5 h-5" />
                  </Button>
                </div>
                
                {filterContent}

                <div className="mt-8 pt-6 border-t border-slate-100 dark:border-white/5 pb-4">
                  <Button className="w-full h-14 rounded-2xl font-black text-base shadow-xl shadow-primary/20" onClick={() => setIsMobileFiltersOpen(false)}>
                    Show Results
                  </Button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Amazon-style Left Sidebar (Desktop Only) */}
        <aside className="hidden lg:block w-64 flex-shrink-0 bg-slate-50 dark:bg-slate-900/20 p-6 rounded-2xl border border-slate-200 dark:border-white/5">
          {filterContent}
        </aside>

        {/* Discovery Results - Starting here */}
        <div className="flex-1 min-w-0 w-full flex flex-col gap-6">
          {/* Advanced Control Grid */}
          <div className="flex flex-col xl:flex-row gap-3 items-center bg-white/50 dark:bg-slate-900/60 p-3 rounded-2xl border border-slate-200 dark:border-white/5">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text" placeholder="Search opportunities..."
                value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white/50 dark:bg-slate-950/50 border border-slate-200 dark:border-white/5 rounded-xl pl-12 pr-4 py-2.5 focus:border-slate-900 transition-all outline-none text-slate-900 dark:text-white font-medium text-sm"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto text-xs">
              <Button
                variant="outline"
                className="lg:hidden rounded-xl bg-white dark:bg-slate-950 font-bold"
                onClick={() => setIsMobileFiltersOpen(!isMobileFiltersOpen)}
              >
                <Filter className="w-4 h-4 mr-2" /> Filters
              </Button>

              <select
                value={filterSource} onChange={e => setFilterSource(e.target.value)}
                className="bg-white/50 dark:bg-slate-950/50 border border-slate-200 dark:border-white/5 rounded-xl px-4 py-2.5 font-bold text-slate-900 dark:text-white outline-none cursor-pointer transition-all"
              >
                {sources.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <AnimatePresence mode="wait">

            {loading ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-20 md:py-40 px-4 space-y-4 md:space-y-6 glass-card rounded-[2rem] md:rounded-[3rem] border-dashed border-slate-200 dark:border-white/10 text-center"
              >
                <motion.div
                  animate={{ rotate: 360, scale: [1, 1.2, 1] }}
                  transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                  className="w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-2xl bg-primary/20 flex items-center justify-center border border-primary/30"
                >
                  <Sparkles className="text-primary w-6 h-6 md:w-8 md:h-8" />
                </motion.div>
                <p className="text-slate-500 font-black uppercase tracking-[0.1em] md:tracking-[0.3em] text-[10px] md:text-xs">Analyzing Market Vectors...</p>
              </motion.div>
            ) : filteredData.length > 0 ? (
              <motion.div
                key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="grid grid-cols-2 xl:grid-cols-3 gap-3 md:gap-6"
              >
                {paginatedData.map((rec, idx) => (
                  <motion.div
                    key={rec.url} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: idx * 0.03 }}
                    className="bg-white dark:bg-slate-900 group p-3 md:p-6 rounded-2xl border border-slate-200 dark:border-white/5 flex flex-col justify-between gap-3 md:gap-6 hover:border-slate-300 dark:hover:border-white/20 transition-all duration-200 shadow-sm"
                  >
                    <div className="space-y-2 md:space-y-4">
                      <div className="flex justify-between items-start gap-2 md:gap-4">
                        <div className="space-y-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-1 md:gap-2 mb-1">
                            <Badge variant="outline" className="text-[6px] md:text-[8px] font-black tracking-widest uppercase border-slate-200 dark:border-white/10 text-slate-500 px-1 md:px-2.5 py-0 md:py-0.5">{rec.source}</Badge>
                            <span className="text-[7px] md:text-[8px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><MapPin className="w-2 h-2 md:w-2.5 md:h-2.5 flex-shrink-0" /> <span className="truncate max-w-[50px] md:max-w-none">{rec.job?.location || 'Morocco'}</span></span>
                          </div>
                          <h3 className="text-sm md:text-xl font-black text-slate-950 dark:text-white leading-tight transition-colors cursor-pointer line-clamp-3 md:line-clamp-none break-words">{rec.title}</h3>
                          <div className="flex items-center gap-1 md:gap-2 text-slate-500 font-bold text-[9px] md:text-xs truncate max-w-[100px] md:max-w-none"><Building className="w-2.5 h-2.5 md:w-3.5 md:h-3.5 flex-shrink-0 opacity-50" /> <span className="truncate">{rec.company}</span></div>
                        </div>
                        <div className="text-center px-1.5 md:px-2 py-1.5 md:py-2 rounded-lg md:rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-100 dark:border-white/5 min-w-[45px] md:min-w-[70px] flex-shrink-0">
                          <div className={`text-xs md:text-lg font-black ${rec.match_score >= 70 ? 'text-emerald-500' : (rec.match_score >= 40 ? 'text-amber-500' : 'text-rose-500')}`}>
                            {rec.match_score.toFixed(0)}%
                          </div>
                          <div className="text-[5px] md:text-[7px] font-black text-slate-400 uppercase tracking-widest">Match</div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1 md:gap-1.5 h-6 md:h-auto overflow-hidden">
                        {rec.matched_skills?.slice(0, 10).map(s => (
                          <Badge
                            key={s}
                            className="bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-500/20 font-black text-[7px] md:text-[9px] px-1 md:px-2 py-0 md:py-0.5 uppercase transition-all hover:bg-blue-600 dark:hover:bg-blue-600 hover:text-white dark:hover:text-white cursor-default truncate max-w-[80px] md:max-w-none"
                          >
                            {s}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div className="pt-2 md:pt-4 border-t border-slate-100 dark:border-white/5 flex items-center justify-between">
                      <div className="text-[7px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest">{rec.matched_skills?.length || 0} {(rec.matched_skills?.length || 0) === 1 ? 'Match' : 'Matches'}</div>
                      <a href={rec.url} target="_blank" rel="noreferrer">
                        <Button variant="outline" className="rounded-md md:rounded-lg font-black text-[8px] md:text-[10px] uppercase tracking-widest h-7 md:h-9 px-2 md:px-4 border-slate-200 dark:border-white/10 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all">
                          Analyze <ExternalLink className="w-2.5 h-2.5 md:w-3 md:h-3 ml-1 md:ml-2" />
                        </Button>
                      </a>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="py-24 px-6 text-center glass-card rounded-[3rem] border-dashed border-slate-200 dark:border-white/10 relative overflow-hidden"
              >
                {/* Background Accent */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] -z-10" />

                {error?.includes('404') ? (
                  <div className="max-w-xl mx-auto space-y-8">
                    <div className="w-20 h-20 mx-auto bg-primary/10 rounded-3xl flex items-center justify-center border border-primary/20 shadow-[0_0_40px_-10px_rgba(var(--primary),0.3)]">
                      <UserPlus className="w-10 h-10 text-primary" />
                    </div>

                    <div className="space-y-4">
                      <h2 className="text-4xl font-black text-slate-950 dark:text-white tracking-tighter leading-none">
                        Complete your profile
                      </h2>
                      <p className="text-slate-600 dark:text-slate-400 font-medium text-lg leading-relaxed">
                        Add your skills to the profile page to unlock job recommendations tailored to your experience.
                      </p>
                    </div>

                    <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
                      <Link to="/profile">
                        <Button className="h-14 px-10 rounded-2xl font-black text-lg bg-black dark:bg-white text-white dark:text-black hover:scale-105 transition-all shadow-2xl shadow-primary/20">
                          Add Skills <ArrowRight className="ml-2 w-5 h-5" />
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        onClick={() => fetchIfNeeded(user?.id || '', undefined, true)}
                        className="h-14 px-8 rounded-2xl font-bold text-slate-500 hover:text-slate-950 dark:hover:text-white"
                      >
                        Try again
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="max-w-md mx-auto">
                    <AlertCircle className={`w-16 h-16 mx-auto mb-6 ${error ? 'text-rose-500' : 'text-slate-400 dark:text-slate-700'}`} />
                    <h2 className="text-3xl font-black text-slate-950 dark:text-white mb-4 tracking-tight">
                      {error ? 'System Desync' : 'No matching vectors'}
                    </h2>
                    <p className="text-slate-600 dark:text-slate-500 font-medium leading-relaxed mb-8">
                      {error ? 'The discovery engine encountered an unexpected error while analyzing job feeds.' : 'Expand your search terms or lower the matching threshold to find more results.'}
                    </p>
                    {error && (
                      <Button
                        variant="outline"
                        onClick={() => fetchIfNeeded(user?.id || '', undefined, true)}
                        className="rounded-xl font-bold border-slate-200 dark:border-white/10"
                      >
                        Reconnect Agent
                      </Button>
                    )}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Pagination inside flex-1 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 sm:gap-4 py-8 sm:py-12">
              <Button variant="ghost" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="rounded-xl text-slate-500 hover:text-white px-2 sm:px-4">
                <ChevronLeft className="w-4 h-4 sm:mr-2" /> <span className="hidden sm:inline">Prev</span>
              </Button>
              <div className="flex items-center gap-1 sm:gap-2">
                {getPageNumbers(currentPage, totalPages).map((p, i) => (
                  p === '...' ? (
                    <span key={`ellipsis-${i}`} className="text-slate-400 px-1 font-bold">...</span>
                  ) : (
                    <button 
                      key={`page-${p}`} 
                      onClick={() => setCurrentPage(p as number)} 
                      className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl font-black text-xs transition-all flex items-center justify-center ${currentPage === p ? 'bg-primary text-white shadow-xl shadow-primary/20 scale-110' : 'text-slate-600 hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                    >
                      {p}
                    </button>
                  )
                ))}
              </div>
              <Button variant="ghost" size="sm" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="rounded-xl text-slate-500 hover:text-white px-2 sm:px-4">
                <span className="hidden sm:inline">Next</span> <ChevronRight className="w-4 h-4 sm:ml-2" />
              </Button>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
