import { useState } from 'react'
import { Play, PlayCircle, Layers } from 'lucide-react'
import { PageHeader } from '../components/shared/PageHeader'
import { LiveLogTerminal } from '../components/shared/LiveLogTerminal'
import { SlideOverPanel } from '../components/shared/SlideOverPanel'
import { useScraperRun } from '../hooks/useScraperRun'
import { useRealtimeLogs } from '../hooks/useRealtimeLogs'
import { formatDistanceToNow } from 'date-fns'

const SCRAPERS = [
  { id: 'rekrute', label: 'ReKrute', domain: 'rekrute.com' },
  { id: 'emploidiali', label: 'EmploiDiali', domain: 'emploidiali.com' },
  { id: 'emploi-public', label: 'Emploi Public', domain: 'emploi-public.ma' },
  { id: 'marocannonces', label: 'MarocAnnonces', domain: 'marocannonces.com' },
  { id: 'indeed', label: 'Indeed', domain: 'indeed.com' },
  { id: 'linkedin', label: 'LinkedIn', domain: 'linkedin.com' },
]

const STATUS_STYLES: Record<string, string> = {
  idle: 'bg-zinc-800 text-zinc-400',
  running: 'bg-blue-500/20 text-blue-300 animate-pulse',
  success: 'bg-emerald-500/20 text-emerald-300',
  failed: 'bg-red-500/20 text-red-400',
  rate_limited: 'bg-amber-500/20 text-amber-300',
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
      <div className="bg-[#1a1a1f] border border-white/5 rounded-2xl p-5 mb-6">
        <div className="flex flex-wrap items-end gap-4">
          {/* Run All button */}
          <button
            onClick={() => runAllScrapers(limit, dryRun)}
            disabled={isRunning}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <PlayCircle size={16} />
            {isRunning ? `Running ${totalRunning} scrapers...` : 'Run All Scrapers'}
          </button>

          {/* Limit slider */}
          <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
            <div className="flex justify-between">
              <label className="text-xs text-zinc-500">Jobs per source</label>
              <span className="text-xs font-mono text-zinc-300">{limit}</span>
            </div>
            <input
              type="range"
              min={10}
              max={100}
              step={5}
              value={limit}
              onChange={e => setLimit(Number(e.target.value))}
              className="w-full accent-indigo-500"
            />
          </div>

          {/* Dry run toggle */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setDryRun(d => !d)}
              className={`relative w-10 h-5 rounded-full transition-colors ${dryRun ? 'bg-indigo-500' : 'bg-zinc-700'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${dryRun ? 'translate-x-5' : ''}`} />
            </button>
            <span className="text-xs text-zinc-400">
              Dry Run {dryRun && <span className="text-amber-400">(won't save to DB)</span>}
            </span>
          </div>

          {/* View all logs */}
          <button
            onClick={() => openLogs(undefined)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs text-zinc-400 hover:text-zinc-200 bg-white/5 hover:bg-white/10 transition-colors"
          >
            <Layers size={13} />
            View All Logs
          </button>
        </div>

        {/* Progress bar */}
        {isRunning && (
          <div className="mt-4 h-1 bg-zinc-800 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-500 rounded-full animate-pulse w-1/2" />
          </div>
        )}
      </div>

      {/* Scraper cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {SCRAPERS.map(scraper => {
          const state = scraperState[scraper.id]
          return (
            <div key={scraper.id} className="bg-[#1a1a1f] border border-white/5 rounded-2xl p-5 hover:border-white/10 transition-colors">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <img
                    src={`https://www.google.com/s2/favicons?domain=${scraper.domain}&sz=32`}
                    alt={scraper.label}
                    className="w-6 h-6 rounded"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                  />
                  <span className="text-sm font-semibold text-white font-['Sora',sans-serif]">{scraper.label}</span>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${STATUS_STYLES[state?.status ?? 'idle']}`}>
                  {state?.status ?? 'idle'}
                </span>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-3 mb-4 text-xs text-zinc-500">
                <div>
                  <p className="text-zinc-600 mb-0.5">Last run</p>
                  <p className="text-zinc-300 font-mono">
                    {state?.lastRun
                      ? formatDistanceToNow(new Date(state.lastRun), { addSuffix: true })
                      : 'Never'}
                  </p>
                </div>
                <div>
                  <p className="text-zinc-600 mb-0.5">Jobs found</p>
                  <p className="text-zinc-300 font-mono">{state?.jobsFound ?? 0}</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => runScraper(scraper.id, limit, dryRun)}
                  disabled={state?.status === 'running' || isRunning}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Play size={12} />
                  Run
                </button>
                <button
                  onClick={() => openLogs(scraper.id)}
                  className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 text-xs transition-colors"
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
        title={activeLogSource ? `Logs — ${activeLogSource}` : 'All Scraper Logs'}
        width="lg"
      >
        <LiveLogTerminal logs={logs} isStreaming={isStreaming} />
      </SlideOverPanel>
    </div>
  )
}
