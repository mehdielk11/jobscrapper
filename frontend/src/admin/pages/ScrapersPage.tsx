import { useState, useEffect, useRef } from 'react'
import {
  Play, PlayCircle, Layers, Activity, Globe,
  Terminal, CheckCircle2, XCircle, AlertTriangle,
  Wifi, WifiOff, Cpu, Zap
} from 'lucide-react'

import { PageHeader } from '../components/shared/PageHeader'
import { SlideOverPanel } from '../components/shared/SlideOverPanel'
import { useScraperRun } from '../hooks/useScraperRun'
import { useRealtimeLogs } from '../hooks/useRealtimeLogs'
import { useNLPStatus } from '../hooks/useNLPStatus'
import { ScraperLogViewer } from '../components/shared/ScraperLogViewer'
import { formatDistanceToNow } from 'date-fns'
import type { LogLine } from '../hooks/useRealtimeLogs'

// ── Scraper definitions ─────────────────────────────────────────────────────
const SCRAPERS = [
  { id: 'rekrute',       label: 'ReKrute',       domain: 'rekrute.com' },
  { id: 'emploidiali',   label: 'EmploiDiali',   domain: 'emploidiali.ma', iconUrl: 'https://emploidiali.ma/wp-content/uploads/2025/07/cropped-favicon-emploi-diali-512x512-1-1-32x32.png' },
  { id: 'emploi-public', label: 'Emploi Public', domain: 'emploi-public.ma', iconUrl: 'https://www.emploi-public.ma/starterkit/build/assets/media/icons/favicon.ico' },
  { id: 'marocannonces', label: 'MarocAnnonces', domain: 'marocannonces.com' },
  { id: 'indeed',        label: 'Indeed',        domain: 'indeed.com' },
  { id: 'linkedin',      label: 'LinkedIn',      domain: 'linkedin.com' },
]

// ── Types ───────────────────────────────────────────────────────────────────
const STATUS_STYLES: Record<string, string> = {
  idle:          'bg-muted text-muted-foreground border border-border',
  running:       'bg-primary/10 text-primary border border-primary/30 animate-pulse',
  success:       'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20',
  failed:        'bg-red-500/10 text-red-500 border border-red-500/20',
  'rate-limited':'bg-amber-500/10 text-amber-500 border border-amber-500/20',
}

const LOG_LEVEL_STYLES: Record<string, string> = {
  INFO:    'text-sky-400',
  WARNING: 'text-amber-400',
  ERROR:   'text-red-400',
}

// ── Sub-components ──────────────────────────────────────────────────────────
function ScraperIcon({ scraper }: { scraper: typeof SCRAPERS[0] }) {
  const [error, setError] = useState(false)
  const url = scraper.iconUrl || `https://www.google.com/s2/favicons?domain=${scraper.domain}&sz=32`
  return (
    <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center overflow-hidden border border-border/50 flex-shrink-0">
      {!error
        ? <img src={url} alt={scraper.label} className="w-full h-full object-contain" onError={() => setError(true)} />
        : <Globe size={14} className="text-muted-foreground" />
      }
    </div>
  )
}

function safeFormatDistance(dateStr: string | null) {
  if (!dateStr) return 'Never'
  try {
    const d = new Date(dateStr)
    return isNaN(d.getTime()) ? 'Never' : formatDistanceToNow(d, { addSuffix: true })
  } catch { return 'Never' }
}

function StatusDot({ status }: { status: string }) {
  if (status === 'running')
    return <span className="w-2 h-2 rounded-full bg-primary animate-pulse flex-shrink-0" />
  if (status === 'success')
    return <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
  if (status === 'failed')
    return <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
  if (status === 'rate-limited')
    return <span className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" />
  return <span className="w-2 h-2 rounded-full bg-muted-foreground/30 flex-shrink-0" />
}

/**
 * Inline always-visible live log terminal — no panel needed.
 */
function InlineTerminal({
  logs,
  isStreaming,
  isLoadingHistory = false,
}: {
  logs: LogLine[]
  isStreaming: boolean
  isLoadingHistory?: boolean
}) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs.length])

  return (
    <div className="bg-zinc-950 rounded-xl border border-zinc-800 overflow-hidden flex flex-col font-mono text-xs shadow-xl">
      {/* Terminal header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800 bg-zinc-900/80">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <span className="w-3 h-3 rounded-full bg-red-500/70" />
            <span className="w-3 h-3 rounded-full bg-amber-500/70" />
            <span className="w-3 h-3 rounded-full bg-emerald-500/70" />
          </div>
          <span className="text-zinc-500 text-[10px] uppercase tracking-widest font-bold ml-2">
            Live Output
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {isStreaming ? (
            <>
              <Wifi size={11} className="text-emerald-400" />
              <span className="text-[9px] text-emerald-400 uppercase font-bold tracking-widest">Streaming</span>
            </>
          ) : (
            <>
              <WifiOff size={11} className="text-zinc-600" />
              <span className="text-[9px] text-zinc-600 uppercase font-bold tracking-widest">Standby</span>
            </>
          )}
        </div>
      </div>

      {/* Log lines */}
      <div className="flex-1 overflow-y-auto max-h-72 p-3 space-y-0.5">
        {isLoadingHistory ? (
          <div className="flex items-center gap-2 py-4 justify-center">
            <div className="w-3 h-3 rounded-full border border-zinc-600 border-t-transparent animate-spin" />
            <p className="text-zinc-600 text-[10px] font-bold uppercase tracking-widest">Loading history...</p>
          </div>
        ) : logs.length === 0 ? (
          <p className="text-zinc-600 text-[10px] italic py-4 text-center">
            Waiting for log output...
          </p>
        ) : (
          logs.map((line, i) => (
            <div key={i} className="flex gap-2 leading-relaxed hover:bg-zinc-900/60 px-1 rounded">
              <span className="text-zinc-600 flex-shrink-0 tabular-nums">
                {new Date(line.timestamp).toLocaleTimeString('fr-MA', { hour12: false })}
              </span>
              <span className={`flex-shrink-0 font-black text-[9px] uppercase tracking-widest pt-px ${LOG_LEVEL_STYLES[line.level] ?? 'text-zinc-400'}`}>
                {line.level}
              </span>
              <span className="text-zinc-300 break-all">{line.message}</span>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}

// ── Main component ──────────────────────────────────────────────────────────
/**
 * ScrapersPage — live scraper control center with real-time status, logs,
 * and NLP engine monitor. No page refresh needed.
 */
export function ScrapersPage() {
  const [limit, setLimit] = useState(30)
  const [dryRun, setDryRun] = useState(false)
  const [logsOpen, setLogsOpen] = useState(false)
  const [activeLogSource, setActiveLogSource] = useState<string | undefined>(undefined)

  const { scraperState, runScraper, runAllScrapers, isRunning } = useScraperRun()
  // Always-on log stream (no filter = all sources) — persists page refresh via DB pre-load
  const { logs: globalLogs, clearLogs: clearGlobal, isStreaming, isLoadingHistory } = useRealtimeLogs({ historyHours: 6 })
  // Panel-specific logs (filtered by selected source)
  const { logs: panelLogs, clearLogs: clearPanel, isStreaming: panelStreaming } = useRealtimeLogs({ source: activeLogSource })

  const { status: nlpStatus } = useNLPStatus()

  const openLogs = (source?: string) => {
    setActiveLogSource(source)
    clearPanel()
    setLogsOpen(true)
  }

  const totalRunning = Object.values(scraperState).filter(s => s.status === 'running').length
  const nlpProgress = nlpStatus?.total ? Math.round((nlpStatus.processed / nlpStatus.total) * 100) : 0

  return (
    <div className="space-y-6">
      <PageHeader
        title="Scraper Control Center"
        description="Run, monitor, and debug all platform scrapers — live"
      />

      {/* ── Top row: Controls + NLP Monitor ──────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* Scraper controls */}
        <div className="xl:col-span-2 bg-card border border-border rounded-2xl p-6 shadow-sm">
          <div className="flex flex-wrap items-end gap-4">
            {/* Run All */}
            <button
              onClick={() => runAllScrapers(limit, dryRun)}
              disabled={isRunning}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-bold uppercase tracking-wider transition-all shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <PlayCircle size={16} />
              {isRunning
                ? `Running ${totalRunning} scraper${totalRunning !== 1 ? 's' : ''}...`
                : 'Run All Scrapers'
              }
            </button>

            {/* Limit slider */}
            <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
              <div className="flex justify-between items-center mb-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Jobs per source</label>
                <span className="text-xs font-black text-primary bg-primary/10 px-2 py-0.5 rounded-md min-w-[2.5rem] text-center">{limit}</span>
              </div>
              <input
                type="range" min={10} max={100} step={5} value={limit}
                onChange={e => setLimit(Number(e.target.value))}
                className="w-full h-1.5 bg-muted rounded-full accent-primary cursor-pointer appearance-none"
              />
            </div>

            {/* Dry run */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setDryRun(d => !d)}
                className={`relative w-10 h-5 rounded-full transition-all duration-300 shadow-inner ${dryRun ? 'bg-primary' : 'bg-muted'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-300 ${dryRun ? 'translate-x-5' : ''}`} />
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
              Full Logs
            </button>
          </div>

          {/* Running progress bar */}
          {isRunning && (
            <div className="mt-4 space-y-1">
              <div className="h-1 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full animate-[shimmer_1.5s_infinite]" style={{ width: '60%' }} />
              </div>
              <p className="text-[9px] text-muted-foreground uppercase tracking-widest font-bold animate-pulse">
                Pipeline active — results streaming in...
              </p>
            </div>
          )}
        </div>

        {/* NLP Engine monitor */}
        <div className={`relative overflow-hidden bg-card border rounded-2xl p-6 shadow-sm transition-all duration-500 ${
          nlpStatus?.status === 'processing' ? 'border-indigo-500/40 ring-1 ring-indigo-500/10' : 'border-border'
        }`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${nlpStatus?.status === 'processing' ? 'bg-indigo-500/10 text-indigo-500 animate-pulse' : 'bg-muted text-muted-foreground'}`}>
                <Cpu size={18} />
              </div>
              <div>
                <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">NLP Engine</h3>
                <p className="text-sm font-bold text-foreground">Skills Extractor</p>
              </div>
            </div>
            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
              nlpStatus?.status === 'processing' ? 'bg-indigo-500/10 text-indigo-500' : 'bg-muted text-muted-foreground'
            }`}>
              {nlpStatus?.status ?? 'idle'}
            </span>
          </div>

          {nlpStatus?.status === 'processing' ? (
            <div className="space-y-3">
              <div className="flex justify-between items-end">
                <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-1">
                  <Zap size={10} />
                  Extracting Skills...
                </p>
                <p className="text-xs font-black text-foreground tabular-nums">
                  {nlpStatus.processed} / {nlpStatus.total}
                </p>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-700 ease-out"
                  style={{ width: `${nlpProgress}%` }}
                />
              </div>
              <p className="text-[9px] text-indigo-400/60 tabular-nums">{nlpProgress}% complete</p>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground font-medium">Standing by for new jobs...</p>
              <button
                onClick={() => openLogs('nlp_engine')}
                className="text-[10px] font-black uppercase tracking-widest text-indigo-500 hover:text-indigo-400 transition-colors"
              >
                Diagnostics
              </button>
            </div>
          )}

          {nlpStatus?.status === 'processing' && (
            <div className="absolute -bottom-12 -right-12 w-24 h-24 bg-indigo-500/10 blur-3xl rounded-full pointer-events-none" />
          )}
        </div>
      </div>

      {/* ── Scraper cards grid ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {SCRAPERS.map(scraper => {
          const state = scraperState[scraper.id]
          const status = state?.status ?? 'idle'
          return (
            <div
              key={scraper.id}
              className={`bg-card border rounded-2xl p-5 transition-all shadow-sm group ${
                status === 'running'
                  ? 'border-primary/40 ring-1 ring-primary/10 shadow-primary/5'
                  : 'border-border hover:border-primary/30 hover:shadow-md'
              }`}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <ScraperIcon scraper={scraper} />
                    {/* Pulsing ring when running */}
                    {status === 'running' && (
                      <span className="absolute -inset-1 rounded-lg border border-primary/40 animate-ping" />
                    )}
                  </div>
                  <span className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                    {scraper.label}
                  </span>
                </div>
                <span className={`text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-widest ${STATUS_STYLES[status]}`}>
                  {status}
                </span>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-4 mb-5">
                <div>
                  <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest mb-1">Last run</p>
                  <p className="text-xs text-foreground font-semibold">{safeFormatDistance(state?.lastRun ?? null)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest mb-1">Jobs found</p>
                  <p className="text-xs text-foreground font-semibold font-mono">{state?.jobsFound ?? 0}</p>
                </div>
              </div>

              {/* Status indicator bar */}
              {status === 'running' && (
                <div className="mb-4 h-0.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full animate-[shimmer_1.2s_ease-in-out_infinite]" style={{ width: '70%' }} />
                </div>
              )}
              {status === 'success' && (
                <div className="mb-4 flex items-center gap-1.5 text-emerald-500">
                  <CheckCircle2 size={12} />
                  <span className="text-[9px] font-black uppercase tracking-widest">Completed successfully</span>
                </div>
              )}
              {status === 'failed' && (
                <div className="mb-4 flex items-center gap-1.5 text-red-500">
                  <XCircle size={12} />
                  <span className="text-[9px] font-black uppercase tracking-widest">Run failed</span>
                </div>
              )}
              {status === 'rate-limited' && (
                <div className="mb-4 flex items-center gap-1.5 text-amber-500">
                  <AlertTriangle size={12} />
                  <span className="text-[9px] font-black uppercase tracking-widest">Rate limited</span>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => runScraper(scraper.id, limit, dryRun)}
                  disabled={status === 'running' || isRunning}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground text-[10px] font-black uppercase tracking-widest transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Play size={12} />
                  Run
                </button>
                <button
                  onClick={() => openLogs(scraper.id)}
                  className="px-4 py-2.5 rounded-xl bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground text-[10px] font-black uppercase tracking-widest transition-all border border-border"
                >
                  <Terminal size={12} />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Inline live activity feed — always visible, no panel needed ───── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity size={14} className={isStreaming ? 'text-primary animate-pulse' : 'text-muted-foreground'} />
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Live Activity Feed
            </span>
            {isStreaming && (
              <span className="px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-[8px] font-black uppercase tracking-widest border border-primary/20">
                Live
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-muted-foreground font-mono">
              {isLoadingHistory ? 'Loading history...' : `${globalLogs.length} events`}
            </span>
            {globalLogs.length > 0 && (
              <button
                onClick={clearGlobal}
                className="text-[9px] font-black uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        <InlineTerminal logs={globalLogs} isStreaming={isStreaming} isLoadingHistory={isLoadingHistory} />

        {/* Per-source status row */}
        <div className="flex flex-wrap gap-3 pt-1">
          {SCRAPERS.map(s => {
            const st = scraperState[s.id]?.status ?? 'idle'
            return (
              <div key={s.id} className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground">
                <StatusDot status={st} />
                <span className={st === 'running' ? 'text-primary' : st === 'success' ? 'text-emerald-500' : st === 'failed' ? 'text-red-500' : ''}>{s.label}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Slide-over panel (full history) ──────────────────────────────── */}
      <SlideOverPanel
        isOpen={logsOpen}
        onClose={() => { setLogsOpen(false); clearPanel() }}
        title={activeLogSource ? `Diagnostic — ${activeLogSource}` : 'Global Scraper Diagnostic'}
        width="3xl"
      >
        <ScraperLogViewer
          source={activeLogSource}
          liveLogs={panelLogs}
          isStreaming={panelStreaming}
        />
      </SlideOverPanel>
    </div>
  )
}
