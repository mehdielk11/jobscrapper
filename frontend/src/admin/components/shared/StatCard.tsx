import { LucideIcon } from 'lucide-react'

interface StatCardProps {
  title: string
  value: string | number
  delta?: string
  deltaType?: 'up' | 'down' | 'neutral'
  icon: LucideIcon
  loading?: boolean
  iconColor?: string
}

/**
 * KPI card for the admin dashboard.
 * Shows a title, big value, optional delta badge, and an icon.
 * Renders a skeleton shimmer while loading=true.
 */
export function StatCard({
  title,
  value,
  delta,
  deltaType = 'neutral',
  icon: Icon,
  loading = false,
  iconColor = 'text-indigo-400',
}: StatCardProps) {
  const deltaColors = {
    up: 'text-emerald-400',
    down: 'text-red-400',
    neutral: 'text-muted-foreground',
  }
  const deltaSymbol = { up: '↑', down: '↓', neutral: '' }

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-2xl p-4 animate-pulse transition-colors duration-500">
        <div className="h-4 w-24 bg-muted rounded mb-3" />
        <div className="h-7 w-28 bg-muted rounded mb-1.5" />
        <div className="h-3 w-16 bg-muted/50 rounded" />
      </div>
    )
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-4 hover:border-primary/20 transition-all group duration-500">
      <div className="flex items-start justify-between mb-3">
        <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider">{title}</p>
        <div className={`p-1.5 rounded-lg bg-muted group-hover:bg-primary/10 transition-colors ${iconColor}`}>
          <Icon size={14} />
        </div>
      </div>
      <p className="text-2xl font-bold text-foreground font-mono tracking-tight">{value}</p>
      {delta && (
        <p className={`text-[10px] mt-1 ${deltaColors[deltaType]}`}>
          {deltaSymbol[deltaType]} {delta}
        </p>
      )}
    </div>
  )
}
