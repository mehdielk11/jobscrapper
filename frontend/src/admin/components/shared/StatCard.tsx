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
      <div className="bg-card border border-border rounded-2xl p-5 animate-pulse transition-colors duration-500">
        <div className="h-5 w-28 bg-muted rounded mb-4" />
        <div className="h-8 w-32 bg-muted rounded mb-2" />
        <div className="h-3 w-20 bg-muted/50 rounded" />
      </div>
    )
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-5 hover:border-primary/20 transition-all group duration-500">
      <div className="flex items-start justify-between mb-4">
        <p className="text-lg text-muted-foreground font-medium">{title}</p>
        <div className={`p-2 rounded-lg bg-muted group-hover:bg-primary/10 transition-colors ${iconColor}`}>
          <Icon size={16} />
        </div>
      </div>
      <p className="text-3xl font-bold text-foreground font-mono tracking-tight">{value}</p>
      {delta && (
        <p className={`text-xs mt-1.5 ${deltaColors[deltaType]}`}>
          {deltaSymbol[deltaType]} {delta}
        </p>
      )}
    </div>
  )
}
