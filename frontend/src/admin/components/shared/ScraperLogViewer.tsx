import { useState } from 'react'
import { History, Activity, Clock, CheckCircle2, XCircle, AlertTriangle, ChevronRight } from 'lucide-react'
import { useScraperHistory, type ScraperRun, type ScraperLog } from '../../hooks/useScraperHistory'
import { LiveLogTerminal } from './LiveLogTerminal'
import { formatDistanceToNow } from 'date-fns'
import type { LogLine } from '../../hooks/useRealtimeLogs'

interface ScraperLogViewerProps {
  source?: string
  liveLogs: LogLine[]
  isStreaming: boolean
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

export function ScraperLogViewer({ source, liveLogs, isStreaming }: ScraperLogViewerProps) {
  const [activeTab, setActiveTab] = useState<'live' | 'history'>('live')
  const [selectedRun, setSelectedRun] = useState<ScraperRun | null>(null)
  const [runLogs, setRunLogs] = useState<ScraperLog[]>([])
  const { history, loading, getRunLogs } = useScraperHistory(source)

  const handleRunClick = async (run: ScraperRun) => {
    setSelectedRun(run)
    const logs = await getRunLogs(run.id)
    setRunLogs(logs)
  }

  // Map DB logs to terminal format
  const mappedRunLogs: LogLine[] = runLogs.map(l => ({
    level: (l.level as 'INFO' | 'WARNING' | 'ERROR') || 'INFO',
    message: l.message,
    timestamp: l.created_at
  }))

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-muted/50 border border-border rounded-xl mb-4 self-start">
        <button
          onClick={() => setActiveTab('live')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm ${
            activeTab === 'live' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          }`}
        >
          <Activity size={14} />
          Live Output
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm ${
            activeTab === 'history' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          }`}
        >
          <History size={14} />
          Run History
        </button>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        {activeTab === 'live' ? (
          <LiveLogTerminal logs={liveLogs} isStreaming={isStreaming} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
            {/* History List */}
            <div className="bg-card border border-border rounded-xl overflow-hidden flex flex-col shadow-sm">
              <div className="px-4 py-3 border-b border-border bg-muted/20 flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/80">Recent Runs</span>
                <Clock size={14} className="text-muted-foreground" />
              </div>
              <div className="flex-1 overflow-y-auto">
                {loading ? (
                  <div className="p-8 text-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40 italic animate-pulse">Loading history...</div>
                ) : history.length === 0 ? (
                  <div className="p-8 text-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40 italic">No runs found for this source.</div>
                ) : (
                  history.map(run => (
                    <button
                      key={run.id}
                      onClick={() => handleRunClick(run)}
                      className={`w-full flex items-center justify-between p-4 border-b border-border transition-all ${
                        selectedRun?.id === run.id ? 'bg-primary/5 border-primary/20' : 'hover:bg-muted/50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {run.status === 'success' ? (
                          <CheckCircle2 size={16} className="text-emerald-400" />
                        ) : run.status === 'failed' ? (
                          <XCircle size={16} className="text-red-400" />
                        ) : run.status === 'rate-limited' ? (
                          <AlertTriangle size={16} className="text-amber-400" />
                        ) : (
                          <Activity size={16} className="text-blue-400 animate-pulse" />
                        )}
                        <div className="text-left">
                          <p className="text-sm font-bold text-foreground">
                            {safeFormatDistance(run.started_at)}
                          </p>
                           <p className="text-[10px] text-muted-foreground font-mono font-medium">
                            {run.jobs_saved} jobs • {run.id?.slice(0, 8) || 'unknown'}
                          </p>
                        </div>
                      </div>
                      <ChevronRight size={14} className="text-zinc-700" />
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Run Details / Logs */}
            <div className="flex flex-col h-full min-h-[400px]">
              {selectedRun ? (
                <div className="flex flex-col h-full">
                  <div className="flex flex-col gap-2 mb-4 bg-muted/30 p-4 rounded-xl border border-border">
                    <p className="text-[10px] text-muted-foreground uppercase font-black tracking-[0.2em]">Run Details</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Status</p>
                        <p className={`text-xs font-mono font-black ${
                          selectedRun.status === 'success' ? 'text-emerald-500' : 'text-red-500'
                        }`}>{selectedRun.status.toUpperCase()}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Jobs Found</p>
                        <p className="text-xs text-foreground font-mono font-bold">{selectedRun.jobs_found}</p>
                      </div>
                    </div>
                    {selectedRun.error_message && (
                      <div className="mt-2 p-2 bg-destructive/10 border border-destructive/20 rounded-lg">
                        <p className="text-[10px] text-destructive italic font-medium">{selectedRun.error_message}</p>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-h-0">
                    <LiveLogTerminal logs={mappedRunLogs} />
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center bg-card border border-dashed border-border rounded-xl p-8 text-center shadow-sm">
                  <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mb-4 transition-transform group-hover:scale-110">
                    <History size={20} className="text-muted-foreground" />
                  </div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Select a run to view diagnostics</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
