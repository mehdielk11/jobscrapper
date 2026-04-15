import { useState } from 'react'
import { Play, PlayCircle, Layers } from 'lucide-react'
import { PageHeader } from '../components/shared/PageHeader'
import { SlideOverPanel } from '../components/shared/SlideOverPanel'
import { useScraperRun } from '../hooks/useScraperRun'
import { useRealtimeLogs } from '../hooks/useRealtimeLogs'
import { formatDistanceToNow } from 'date-fns'
import { ScraperLogViewer } from '../components/shared/ScraperLogViewer'

const SCRAPERS = [
  { id: 'rekrute', label: 'ReKrute', domain: 'rekrute.com' },
  { id: 'emploidiali', label: 'EmploiDiali', domain: 'emploidiali.com' },
  { id: 'emploi-public', label: 'Emploi Public', domain: 'emploi-public.ma' },
  { id: 'marocannonces', label: 'MarocAnnonces', domain: 'marocannonces.com' },
  { id: 'indeed', label: 'Indeed', domain: 'indeed.com' },
  { id: 'linkedin', label: 'LinkedIn', domain: 'linkedin.com' },
]

const STATUS_STYLES: Record<string, string> = {
  idle: 'bg-muted text-muted-foreground border border-border',
  running: 'bg-primary/10 text-primary border border-primary/20 animate-pulse',
  success: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20',
  failed: 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20',
  'rate-limited': 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20',
}

/**
 * Safe date formatter to avoid crashes on invalid dates.
 */
function safeFormatDistance(dateStr: string | null) {
  if (!dateStr) return 'Never'
  try {
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) return 'Never'
    return formatDistanceToNow(date, { addSuffix: true })
  } catch (e) {
    return 'Never'
  }
}

/**
 * ScrapersPage — run individual or all scrapers, view real-time log output.
 */
export function ScrapersPage() {
  const [limit, setLimit] = useState(30)
  const [dryRun, setDryRun] = useState(false)
  const [logsOpen, setLogsOpen] = useState(false)
  const [activeLogSource, setActiveLogSource] = useState<string | undefined>(undefined)

  const { scraperState, runScraper, runAllScrapers, isRunning } = useScraperRun()
  const { logs, clearLogs, isStreaming } = useRealtimeLogs(activeLogSource)

  const openLogs = (source?: string) => {
    setActiveLogSource(source)
    setLogsOpen(true)
  }

  const totalRunning = Object.values(scraperState).filter(s => s.status === 'running').length

  return (
    <div>
      <PageHeader
        title="Scraper Control Center"
        description="Run, monitor, and debug all platform scrapers"
      />

      {/* Global controls */}
      <div className="bg-card border border-border rounded-2xl p-6 mb-8 shadow-sm">
        <div className="flex flex-wrap items-end gap-4">
          {/* Run All button */}
          <button
            onClick={() => runAllScrapers(limit, dryRun)}
            disabled={isRunning}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-bold uppercase tracking-wider transition-all shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <PlayCircle size={16} />
            {isRunning ? `Running ${totalRunning} scrapers...` : 'Run All Scrapers'}
          </button>

          {/* Limit slider */}
          <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
            <div className="flex justify-between items-center mb-1">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Jobs per source</label>
              <span className="text-xs font-black text-primary bg-primary/10 px-2 py-0.5 rounded-md min-w-[2.5rem] text-center">{limit}</span>
            </div>
            <input
              type="range"
              min={10}
              max={100}
              step={5}
              value={limit}
              onChange={e => setLimit(Number(e.target.value))}
              className="w-full h-1.5 bg-muted rounded-full accent-primary cursor-pointer appearance-none"
            />
          </div>

          {/* Dry run toggle */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setDryRun(d => !d)}
              className={`relative w-10 h-5 rounded-full transition-all duration-300 shadow-inner ${dryRun ? 'bg-primary' : 'bg-muted'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-300 flex items-center justify-center ${dryRun ? 'translate-x-5' : ''}`} />
            </button>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              Dry Run {dryRun && <span className="text-amber-500">(simulation)</span>}
            </span>
          </div>

          <button
            onClick={() => openLogs(undefined)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-foreground bg-muted/50 hover:bg-muted border border-border transition-all"
          >
            <Layers size={13} />
            View All Logs
          </button>
        </div>

        {/* Progress bar */}
        {isRunning && (
          <div className="mt-6 h-1 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full animate-pulse w-1/2" />
          </div>
        )}
      </div>

      {/* Scraper cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {SCRAPERS.map(scraper => {
          const state = scraperState[scraper.id]
          return (
            <div key={scraper.id} className="bg-card border border-border rounded-2xl p-5 hover:border-primary/30 transition-all hover:shadow-lg group shadow-sm">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <img
                    src={`https://www.google.com/s2/favicons?domain=${scraper.domain}&sz=32`}
                    alt={scraper.label}
                    className="w-6 h-6 rounded"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                  />
                  <span className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">{scraper.label}</span>
                </div>
                <span className={`text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-widest ${STATUS_STYLES[state?.status ?? 'idle']}`}>
                  {state?.status ?? 'idle'}
                </span>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest mb-1">Last run</p>
                  <p className="text-xs text-foreground font-semibold">
                    {safeFormatDistance(state?.lastRun ?? null)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest mb-1">Jobs found</p>
                  <p className="text-xs text-foreground font-semibold font-mono">{state?.jobsFound ?? 0}</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => runScraper(scraper.id, limit, dryRun)}
                  disabled={state?.status === 'running' || isRunning}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground text-[10px] font-black uppercase tracking-widest transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Play size={14} />
                  Run
                </button>
                <button
                  onClick={() => openLogs(scraper.id)}
                  className="px-4 py-2.5 rounded-xl bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground text-[10px] font-black uppercase tracking-widest transition-all border border-border"
                >
                  Logs
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Log slide-over panel */}
      <SlideOverPanel
        isOpen={logsOpen}
        onClose={() => { setLogsOpen(false); clearLogs() }}
        title={activeLogSource ? `Scraper Diagnostic — ${activeLogSource}` : 'Global Scraper Diagnostic'}
        width="3xl"
      >
        <ScraperLogViewer 
          source={activeLogSource} 
          liveLogs={logs} 
          isStreaming={isStreaming} 
        />
      </SlideOverPanel>
    </div>
  )
}
