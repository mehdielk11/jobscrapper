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
    neutral: 'text-zinc-400',
  }
  const deltaSymbol = { up: '↑', down: '↓', neutral: '' }

  if (loading) {
    return (
      <div className="bg-[#1a1a1f] border border-white/5 rounded-2xl p-5 animate-pulse">
        <div className="h-4 w-24 bg-white/10 rounded mb-4" />
        <div className="h-8 w-32 bg-white/10 rounded mb-2" />
        <div className="h-3 w-20 bg-white/5 rounded" />
      </div>
    )
  }

  return (
    <div className="bg-[#1a1a1f] border border-white/5 rounded-2xl p-5 hover:border-white/10 transition-all group">
      <div className="flex items-start justify-between mb-4">
        <p className="text-sm text-zinc-400 font-medium">{title}</p>
        <div className={`p-2 rounded-lg bg-white/5 group-hover:bg-white/8 transition-colors ${iconColor}`}>
          <Icon size={16} />
        </div>
      </div>
      <p className="text-3xl font-bold text-white font-mono tracking-tight">{value}</p>
      {delta && (
        <p className={`text-xs mt-1.5 ${deltaColors[deltaType]}`}>
          {deltaSymbol[deltaType]} {delta}
        </p>
      )}
    </div>
  )
}
