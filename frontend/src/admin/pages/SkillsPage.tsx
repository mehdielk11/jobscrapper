import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend
} from 'recharts'
import { PageHeader } from '../components/shared/PageHeader'
import { StatCard } from '../components/shared/StatCard'
import { 
  Briefcase, 
  Target, 
  Layers, 
  Zap,
  TrendingUp,
  Activity
} from 'lucide-react'

interface TopSkill {
  name: string
  count: number
  category?: string
}

interface StatMetric {
  label: string
  value: string | number
  sub: string
  icon: any
}

// App standard source colors
const SOURCES_MAP = ['rekrute', 'emploidiali', 'indeed', 'linkedin', 'emploi-public', 'marocannonces']
const SOURCE_COLORS_PALETTE = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']

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
        .map(([name, value], index) => {
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
          title: 'Market Coverage', 
          value: totalCount.toLocaleString(), 
          delta: 'Total jobs scanned', 
          icon: Briefcase, 
          iconColor: 'text-indigo-400' 
        },
        { 
          title: 'Intelligence Yield', 
          value: `${yieldValue}%`, 
          delta: 'Extraction efficiency', 
          icon: Zap, 
          iconColor: 'text-emerald-400' 
        },
        { 
          title: 'Knowledge Base', 
          value: uniqueCount.toLocaleString(), 
          delta: 'Distinct skills catalogued', 
          icon: Layers, 
          iconColor: 'text-amber-400' 
        },
        { 
          title: 'Top Signal', 
          value: sortedSkills[0]?.name || 'N/A', 
          delta: 'Most demanded skillset', 
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
            <div key={i} className="h-32 bg-[#1a1a1f] border border-white/5 rounded-2xl animate-pulse" />
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
          className="lg:col-span-8 bg-[#1a1a1f] border border-white/5 rounded-2xl p-6"
        >
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
                <Target className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-zinc-300 font-['Sora',sans-serif]">Market Demand Intensity</h3>
                <p className="text-[10px] text-zinc-500">Frequency of extracted skills across all sources</p>
              </div>
            </div>
            <div className="flex gap-2">
              <div className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[9px] font-bold uppercase text-zinc-400">Top 30</div>
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
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" horizontal={false} />
                <XAxis 
                  type="number" 
                  tick={{ fontSize: 10, fill: '#52525b', fontWeight: 600 }} 
                  axisLine={{ stroke: 'rgba(255,255,255,0.05)' }}
                />
                <YAxis 
                  type="category" 
                  dataKey="name" 
                  tick={{ fontSize: 11, fill: '#a1a1aa', fontWeight: 600 }} 
                  width={140}
                  interval={0}
                  axisLine={{ stroke: 'rgba(255,255,255,0.05)' }}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,0.02)' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-[#1a1a1f] border border-white/10 p-3 rounded-xl shadow-2xl backdrop-blur-md">
                          <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1">Skill Profile</p>
                          <p className="text-sm font-bold text-zinc-200">{payload[0].payload.name}</p>
                          <div className="mt-2 flex items-center justify-between gap-8">
                            <span className="text-xs text-zinc-500">Appearances</span>
                            <span className="text-xs font-mono font-bold text-indigo-300">{payload[0].value}</span>
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
          <div 
            className="bg-[#1a1a1f] border border-white/5 rounded-2xl p-6 h-full flex flex-col"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
                <Activity className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider font-['Sora',sans-serif]">Source Intelligence</h3>
            </div>

            <div className="flex-1 min-h-[220px]">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <PieChart>
                  <Pie
                    data={sourceData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                    animationDuration={1500}
                  >
                    {sourceData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ background: '#1a1a1f', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '11px' }}
                    itemStyle={{ color: '#e4e4e7' }}
                  />
                  <Legend 
                    verticalAlign="bottom" 
                    align="center"
                    iconType="circle"
                    formatter={(value) => <span className="text-[10px] uppercase font-bold text-zinc-500">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            
            <div className="mt-8 space-y-4">
              {sourceData.slice(0, 4).map((item, i) => (
                <div key={i} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase text-zinc-500 tracking-wider">{item.name}</span>
                    <span className="text-[10px] font-mono font-bold text-zinc-400">{item.value} skills</span>
                  </div>
                  <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${stats[0] ? (item.value / totalJobsCount) * 100 : 0}%` }}
                      transition={{ duration: 1, delay: 0.8 }}
                      className="h-full rounded-full" 
                      style={{ backgroundColor: item.color }}
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
