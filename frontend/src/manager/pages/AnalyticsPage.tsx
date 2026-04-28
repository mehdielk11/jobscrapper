import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  AreaChart, Area, Cell, PieChart, Pie,
} from 'recharts'
import { Users, BookOpen, TrendingUp, Award, Loader2 } from 'lucide-react'

const COLORS = ['#10b981', '#6366f1', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6']
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

interface Analytics {
  total_members: number
  members_with_skills: number
  total_skills_entries: number
  avg_skills_per_member: number
  top_skills: { skill: string; count: number }[]
  skill_coverage: { range: string; count: number }[]
  member_growth: { month: string; count: number }[]
}

export function AnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return
        const resp = await fetch(`${API_BASE}/api/org/mine/analytics?token=${session.access_token}`)
        if (resp.ok) {
          setData(await resp.json())
        }
      } catch {
        // ignore
      } finally {
        setLoading(false)
      }
    }
    fetchAnalytics()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="text-center py-32 text-sm text-muted-foreground">
        Failed to load analytics data.
      </div>
    )
  }

  const KpiCard = ({ icon: Icon, label, value, sub }: { icon: any; label: string; value: string | number; sub?: string }) => (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
          <Icon size={18} className="text-emerald-500" />
        </div>
      </div>
      <p className="text-2xl font-black text-foreground font-['Sora',sans-serif]">{value}</p>
      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">{label}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  )

  const ChartCard = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
      <h3 className="text-sm font-bold text-foreground mb-6 font-['Sora',sans-serif] uppercase tracking-wider">{title}</h3>
      {children}
    </div>
  )

  const tooltipStyle = {
    background: 'hsl(var(--popover))',
    border: '1px solid hsl(var(--border))',
    borderRadius: 12,
    fontSize: 12,
    color: 'hsl(var(--popover-foreground))',
  }

  const emptyState = (
    <div className="h-48 flex items-center justify-center text-xs font-bold uppercase tracking-widest text-muted-foreground/40">
      No data available yet
    </div>
  )

  const skillCovPct = data.total_members > 0
    ? Math.round((data.members_with_skills / data.total_members) * 100)
    : 0

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-black text-foreground font-['Sora',sans-serif] tracking-tight">Analytics</h1>
        <p className="text-sm text-muted-foreground mt-1">Organisation skill intelligence and member insights</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KpiCard icon={Users} label="Total Members" value={data.total_members} />
        <KpiCard
          icon={Award}
          label="Skill Coverage"
          value={`${skillCovPct}%`}
          sub={`${data.members_with_skills} of ${data.total_members} members have skills`}
        />
        <KpiCard icon={BookOpen} label="Total Skill Entries" value={data.total_skills_entries} />
        <KpiCard icon={TrendingUp} label="Avg Skills / Member" value={data.avg_skills_per_member} />
      </div>

      {/* Charts section */}
      <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 mb-4 flex items-center gap-2">
        <div className="h-px w-8 bg-muted-foreground/20" />
        Skill Distribution
      </h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
        {/* Top Skills */}
        <ChartCard title="Top Skills Across Members">
          {data.top_skills.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data.top_skills} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} opacity={0.4} />
                <XAxis type="number" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis type="category" dataKey="skill" tick={{ fontSize: 10, fill: 'hsl(var(--foreground))', fontWeight: 600 }} width={100} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {data.top_skills.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : emptyState}
        </ChartCard>

        {/* Skill coverage breakdown */}
        <ChartCard title="Member Skill Coverage">
          {data.skill_coverage.some(d => d.count > 0) ? (
            <div className="flex items-center gap-6">
              <ResponsiveContainer width="50%" height={220}>
                <PieChart>
                  <Pie
                    data={data.skill_coverage}
                    dataKey="count"
                    nameKey="range"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    strokeWidth={0}
                  >
                    {data.skill_coverage.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-3">
                {data.skill_coverage.map((d, i) => (
                  <div key={d.range} className="flex items-center gap-2.5">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                    <span className="text-xs text-muted-foreground flex-1">{d.range}</span>
                    <span className="text-xs font-bold text-foreground">{d.count}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : emptyState}
        </ChartCard>
      </div>

      {/* Growth */}
      <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 mb-4 flex items-center gap-2">
        <div className="h-px w-8 bg-muted-foreground/20" />
        Growth
      </h2>
      <div className="grid grid-cols-1 gap-4 mb-8">
        <ChartCard title="Cumulative Member Growth">
          {data.member_growth.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={data.member_growth}>
                <defs>
                  <linearGradient id="growthGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="count" stroke="#10b981" fill="url(#growthGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : emptyState}
        </ChartCard>
      </div>
    </div>
  )
}
