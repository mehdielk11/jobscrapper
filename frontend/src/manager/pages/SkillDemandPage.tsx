import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { Target } from 'lucide-react'

/**
 * SkillDemandPage — read-only view of global skill demand data.
 * Simplified view focusing on market intensity.
 */
export function SkillDemandPage() {
  const [topSkills, setTopSkills] = useState<{ name: string; count: number }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)

      const { data: jobSkillsData } = await supabase
        .from('job_skills')
        .select('skill')
        .limit(10000)

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

        <div className="h-[550px] w-full">
          {loading ? (
            <div className="h-full flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
            </div>
          ) : topSkills.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topSkills} layout="vertical" margin={{ left: 20, right: 40 }}>
                <defs>
                  <linearGradient id="barGradientMgr" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#059669" stopOpacity={0.8} />
                    <stop offset="100%" stopColor="#34d399" stopOpacity={1} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} opacity={0.3} />
                <XAxis type="number" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))', fontWeight: 600 }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 13, fill: 'hsl(var(--foreground))', fontWeight: 700 }}
                  width={160}
                  interval={0}
                />
                <Tooltip
                  cursor={{ fill: 'hsl(var(--muted))', opacity: 0.15 }}
                  contentStyle={{
                    background: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 12,
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'hsl(var(--popover-foreground))',
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                  }}
                />
                <Bar dataKey="count" fill="url(#barGradientMgr)" radius={[0, 6, 6, 0]} barSize={26} animationDuration={1500} />
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
