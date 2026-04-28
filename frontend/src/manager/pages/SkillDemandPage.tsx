import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { Briefcase, Layers, TrendingUp, Target, Zap } from 'lucide-react'

/**
 * SkillDemandPage — read-only view of global skill demand data.
 * Same data as admin SkillsPage but without admin controls.
 */
export function SkillDemandPage() {
  const [topSkills, setTopSkills] = useState<{ name: string; count: number }[]>([])
  const [stats, setStats] = useState<{ title: string; value: string; icon: any; color: string }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)

      const [
        { count: totalCountInDb },
        { data: jobSkillsData }
      ] = await Promise.all([
        supabase.from('jobs').select('*', { count: 'exact', head: true }),
        supabase.from('job_skills').select('skill, job_id').limit(10000)
      ])

      const currentTotalJobs = totalCountInDb || 0
      const counts: Record<string, number> = {}

      for (const s of (jobSkillsData ?? [])) {
        const name = s.skill.toLowerCase()
        counts[name] = (counts[name] ?? 0) + 1
      }

      const sortedSkills = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 30)
        .map(([name, count]) => ({ name, count }))

      setTopSkills(sortedSkills)

      const uniqueJobIds = new Set((jobSkillsData ?? []).map((s: any) => s.job_id))
      const jobsWithSkillsCount = uniqueJobIds.size
      const yieldValue = currentTotalJobs > 0 ? Math.round((jobsWithSkillsCount / currentTotalJobs) * 100) : 0
      const uniqueCount = Object.keys(counts).length

      setStats([
        { title: 'Total Jobs', value: currentTotalJobs.toLocaleString(), icon: Briefcase, color: 'text-indigo-400' },
        { title: 'Extraction Rate', value: `${yieldValue}%`, icon: Zap, color: 'text-emerald-400' },
        { title: 'Skill Catalog', value: uniqueCount.toLocaleString(), icon: Layers, color: 'text-amber-400' },
        { title: 'Most Demanded', value: sortedSkills[0]?.name || 'N/A', icon: TrendingUp, color: 'text-blue-400' },
      ])

      setLoading(false)
    }

    fetchData()
  }, [])

  return (
    <div className="space-y-8 pb-12">
      <div>
        <h1 className="text-xl font-bold text-foreground font-['Sora',sans-serif]">Skill Demand Intelligence</h1>
        <p className="text-sm text-muted-foreground mt-1">Market analysis of current technical requirements across all job sources</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          Array(4).fill(0).map((_, i) => (
            <div key={i} className="h-28 bg-card border border-border rounded-2xl animate-pulse" />
          ))
        ) : (
          stats.map((stat, i) => (
            <div key={i} className="bg-card border border-border rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <div className={`p-2 rounded-xl bg-muted/50 ${stat.color}`}>
                  <stat.icon size={16} />
                </div>
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{stat.title}</p>
              </div>
              <p className="text-lg font-bold text-foreground font-['Sora',sans-serif] truncate">{stat.value}</p>
            </div>
          ))
        )}
      </div>

      {/* Chart */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
            <Target className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground font-['Sora',sans-serif]">Market Demand Intensity</h3>
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Top 30 most demanded skills</p>
          </div>
        </div>

        <div className="h-[430px] w-full">
          {topSkills.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topSkills} layout="vertical" margin={{ left: 20, right: 40 }}>
                <defs>
                  <linearGradient id="barGradientMgr" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#059669" stopOpacity={0.8} />
                    <stop offset="100%" stopColor="#34d399" stopOpacity={1} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} opacity={0.4} />
                <XAxis type="number" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))', fontWeight: 600 }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 11, fill: 'hsl(var(--foreground))', fontWeight: 700 }}
                  width={140}
                  interval={0}
                />
                <Tooltip
                  cursor={{ fill: 'hsl(var(--muted))', opacity: 0.1 }}
                  contentStyle={{
                    background: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 12,
                    fontSize: 12,
                    color: 'hsl(var(--popover-foreground))',
                  }}
                />
                <Bar dataKey="count" fill="url(#barGradientMgr)" radius={[0, 4, 4, 0]} barSize={16} animationDuration={1500} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">
              No skill data available yet
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
