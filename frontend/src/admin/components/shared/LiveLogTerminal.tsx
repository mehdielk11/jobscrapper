import { useEffect, useRef } from 'react'
import { Copy, Terminal } from 'lucide-react'
import { toast } from 'react-hot-toast'
import type { LogLine } from '../../hooks/useRealtimeLogs'

interface LiveLogTerminalProps {
  logs: LogLine[]
  isStreaming?: boolean
}

const levelColors: Record<LogLine['level'], string> = {
  INFO: 'text-muted-foreground',
  WARNING: 'text-amber-500',
  ERROR: 'text-red-500',
}
const levelBg: Record<LogLine['level'], string> = {
  INFO: 'text-muted-foreground/80',
  WARNING: 'text-amber-600',
  ERROR: 'text-red-600',
}

/**
 * Terminal-style log viewer.
 * Auto-scrolls to bottom on new entries. Color-codes by log level.
 */
export function LiveLogTerminal({ logs, isStreaming = false }: LiveLogTerminalProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  const copyAll = () => {
    const text = logs
      .map(l => `[${l.timestamp}] [${l.level}] ${l.message}`)
      .join('\n')
    navigator.clipboard.writeText(text)
    toast.success('Logs copied to clipboard')
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
      {/* Terminal header bar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <Terminal size={12} className="text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground font-mono font-bold uppercase tracking-wider">Scraper Logs</span>
          {isStreaming && (
            <span className="flex items-center gap-1 text-[10px] text-emerald-500 font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              LIVE
            </span>
          )}
        </div>
        <button
          onClick={copyAll}
          className="flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors font-bold uppercase"
        >
          <Copy size={11} />
          Copy
        </button>
      </div>

      {/* Log body */}
      <div className="h-64 overflow-y-auto p-4 font-mono text-[11px] space-y-0.5 bg-background/30 scrollbar-thin scrollbar-thumb-muted">
        {logs.length === 0 ? (
          <p className="text-muted-foreground italic">No logs yet. Run a scraper to see output here.</p>
        ) : (
          logs.map((log, i) => (
            <div key={i} className="flex gap-3 leading-relaxed">
              <span className="text-muted-foreground flex-shrink-0 tabular-nums">
                {new Date(log.timestamp).toLocaleTimeString()}
              </span>
              <span className={`flex-shrink-0 w-14 ${levelBg[log.level]}`}>[{log.level}]</span>
              <span className={levelColors[log.level]}>{log.message}</span>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
