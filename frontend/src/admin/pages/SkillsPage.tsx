import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { PageHeader } from '../components/shared/PageHeader'
import { StatCard } from '../components/shared/StatCard'
import { 
  Briefcase, 
  Target, 
  Layers, 
  Zap,
  TrendingUp,
} from 'lucide-react'

interface TopSkill {
  name: string
  count: number
  category?: string
}


// App standard source colors
const SOURCES_MAP = ['rekrute', 'emploidiali', 'indeed', 'linkedin', 'emploi-public', 'marocannonces']

/**
 * SkillsPage — view market demand analytics for extracted skills.
 * Redesigned for premium data-dense UX.
 */
export function SkillsPage() {
  const [topSkills, setTopSkills] = useState<TopSkill[]>([])
  const [stats, setStats] = useState<any[]>([])
  const [sourceData, setSourceData] = useState<{ name: string, value: number, color: string }[]>([])
  const [totalJobsCount, setTotalJobsCount] = useState(0)
  const [loading, setLoading] = useState(true)

  const SOURCE_COLORS_PALETTE = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      
      // 1. Fetch Metrics
      const [
        { count: totalCountInDb },
        { data: jobSkillsData }
      ] = await Promise.all([
        supabase.from('jobs').select('*', { count: 'exact', head: true }),
        supabase.from('job_skills').select('skill, job_id, jobs(source)').limit(10000)
      ])

      const currentTotalJobs = totalCountInDb || 0
      setTotalJobsCount(currentTotalJobs)

      // 2. Process Skills
      const counts: Record<string, number> = {}
      const sourceCounts: Record<string, number> = {}

      for (const s of (jobSkillsData ?? [])) {
        const name = s.skill.toLowerCase()
        counts[name] = (counts[name] ?? 0) + 1

        const source = (s as any).jobs?.source?.toLowerCase() || 'other'
        sourceCounts[source] = (sourceCounts[source] ?? 0) + 1
      }
      
      const sortedSkills = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 30)
        .map(([name, count]) => ({ 
          name, 
          count
        }))

      setTopSkills(sortedSkills)

      // 3. Process Source Breakdown
      const formattedSourceData = Object.entries(sourceCounts)
        .map(([name, value]) => {
          const colorIndex = SOURCES_MAP.indexOf(name)
          return {
            name,
            value,
            color: colorIndex !== -1 ? SOURCE_COLORS_PALETTE[colorIndex] : '#71717a'
          }
        })
        .sort((a, b) => b.value - a.value)

      setSourceData(formattedSourceData)

      // 4. Set Stats Cards
      const uniqueJobIds = new Set((jobSkillsData ?? []).map((s: any) => s.job_id))
      const jobsWithSkillsCount = uniqueJobIds.size
      const totalCount = currentTotalJobs || 0
      const yieldValue = totalCount > 0 ? Math.round((jobsWithSkillsCount / totalCount) * 100) : 0
      const uniqueCount = Object.keys(counts).length

      setStats([
        { 
          title: 'Total Jobs', 
          value: totalCount.toLocaleString(), 
          delta: 'Market size analyzed', 
          icon: Briefcase, 
          iconColor: 'text-indigo-400' 
        },
        { 
          title: 'Extraction Rate', 
          value: `${yieldValue}%`, 
          delta: 'Jobs with skill data', 
          icon: Zap, 
          iconColor: 'text-emerald-400' 
        },
        { 
          title: 'Skill Catalog', 
          value: uniqueCount.toLocaleString(), 
          delta: 'Unique skills found', 
          icon: Layers, 
          iconColor: 'text-amber-400' 
        },
        { 
          title: 'Most Demanded', 
          value: sortedSkills[0]?.name || 'N/A', 
          delta: 'Top requirement', 
          icon: TrendingUp, 
          iconColor: 'text-blue-400' 
        },
      ])

      setLoading(false)
    }

    fetchData()
  }, [])

  return (
    <div className="space-y-8 pb-12">
      <PageHeader
        title="Skill Demand Intelligence"
        description="Comprehensive market analysis of current technical requirements and emerging skills"
      />

      {/* KPI Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          Array(4).fill(0).map((_, i) => (
            <div key={i} className="h-32 bg-muted border border-border rounded-2xl animate-pulse" />
          ))
        ) : (
          stats.map((stat, i) => (
            <StatCard
              key={i}
              title={stat.title}
              value={stat.value}
              delta={stat.delta}
              icon={stat.icon}
              iconColor={stat.iconColor}
              loading={loading}
            />
          ))
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Main Chart - 30 Top Skills */}
        <div 
          className="lg:col-span-8 bg-card border border-border rounded-2xl p-6 shadow-sm"
        >
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
                <Target className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground font-['Sora',sans-serif]">Market Demand Intensity</h3>
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Frequency of extracted skills across all sources</p>
              </div>
            </div>
            <div className="flex gap-2">
              <div className="px-3 py-1 rounded-lg bg-primary/10 border border-primary/20 text-[9px] font-black uppercase tracking-widest text-primary shadow-sm">Top 30</div>
            </div>
          </div>

          <div className="h-[430px] w-full min-h-[400px]">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <BarChart data={topSkills} layout="vertical" margin={{ left: 20, right: 40 }}>
                <defs>
                  <linearGradient id="barGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#4f46e5" stopOpacity={0.8} />
                    <stop offset="100%" stopColor="#818cf8" stopOpacity={1} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} opacity={0.4} />
                <XAxis 
                  type="number" 
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))', fontWeight: 600 }} 
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                />
                <YAxis 
                  type="category" 
                  dataKey="name" 
                  tick={{ fontSize: 11, fill: 'hsl(var(--foreground))', fontWeight: 700 }} 
                  width={140}
                  interval={0}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                />
                <Tooltip
                  cursor={{ fill: 'hsl(var(--muted))', opacity: 0.1 }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-popover border border-border p-4 rounded-xl shadow-2xl backdrop-blur-md">
                          <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-1.5 opacity-80">Skill Profile</p>
                          <p className="text-sm font-bold text-popover-foreground">{payload[0].payload.name}</p>
                          <div className="mt-3 flex items-center justify-between gap-10">
                            <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-tight">Appearances</span>
                            <span className="text-xs font-black text-primary">{payload[0].value}</span>
                          </div>
                        </div>
                      )
                    }
                    return null
                  }}
                />
                <Bar 
                  dataKey="count" 
                  fill="url(#barGradient)"
                  radius={[0, 4, 4, 0]} 
                  barSize={16}
                  animationDuration={1500}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Sidebar Widgets */}
        <div className="lg:col-span-4 space-y-6">
          {/* Source Distribution */}
          <div className="bg-card border border-border rounded-2xl p-6 transition-all duration-500 shadow-sm flex flex-col h-full">
            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-6">
              Source Intelligence
            </h3>
            <div className="flex-1 space-y-6">
              {sourceData.map((stat) => (
                <div key={stat.name} className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground capitalize">{stat.name}</span>
                    <span className="text-muted-foreground font-mono">{stat.value} skills</span>
                  </div>
                  <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(stat.value / totalJobsCount) * 100}%` }}
                      className="h-full bg-primary"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
