import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Cell, Legend
} from 'recharts'
import { PageHeader } from '../components/shared/PageHeader'
import { 
  Briefcase, 
  Target, 
  Layers, 
  Cpu, 
  Zap,
  TrendingUp,
  Layout
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
  color: string
}

interface CategoryData {
  subject: string
  A: number
  fullMark: number
}

/**
 * SkillsPage — view market demand analytics for extracted skills.
 * Redesigned for premium data-dense UX.
 */
export function SkillsPage() {
  const [topSkills, setTopSkills] = useState<TopSkill[]>([])
  const [stats, setStats] = useState<StatMetric[]>([])
  const [categoryData, setCategoryData] = useState<CategoryData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      
      // 1. Fetch Metrics
      const [
        { count: totalJobs },
        { data: jobSkillsData },
        taxonomyData
      ] = await Promise.all([
        supabase.from('jobs').select('*', { count: 'exact', head: true }),
        supabase.from('job_skills').select('skill, job_id').limit(10000),
        fetch('/api/taxonomy').then(res => res.json()).catch(() => ({ categories: {} }))
      ])

      // 2. Process Skills
      const counts: Record<string, number> = {}
      for (const s of (jobSkillsData ?? [])) {
        const name = s.skill.toLowerCase()
        counts[name] = (counts[name] ?? 0) + 1
      }
      
      const sortedSkills = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 30)
        .map(([name, count]) => ({ 
          name, 
          count,
          category: Object.entries(taxonomyData.categories ?? {}).find(([_, list]) => 
            (list as string[]).includes(name)
          )?.[0] || 'other'
        }))

      setTopSkills(sortedSkills)

      // 3. Process Categories for Radar
      const catCounts: Record<string, number> = {
        technical: 0,
        domain: 0,
        soft: 0,
        tool: 0
      }

      for (const skill of (jobSkillsData ?? [])) {
        const name = skill.skill.toLowerCase()
        for (const [cat, list] of Object.entries(taxonomyData.categories ?? {})) {
          if ((list as string[]).includes(name)) {
            catCounts[cat] = (catCounts[cat] ?? 0) + 1
            break
          }
        }
      }

      const totalSkillsCount = jobSkillsData?.length || 1
      setCategoryData([
        { subject: 'Technical', A: (catCounts.technical / totalSkillsCount) * 100, fullMark: 100 },
        { subject: 'Domain', A: (catCounts.domain / totalSkillsCount) * 100, fullMark: 100 },
        { subject: 'Soft Skills', A: (catCounts.soft / totalSkillsCount) * 100, fullMark: 100 },
        { subject: 'Tools', A: (catCounts.tool / totalSkillsCount) * 100, fullMark: 100 },
      ])

      // 4. Set Stats Cards
      const uniqueJobIds = new Set((jobSkillsData ?? []).map((s: any) => s.job_id))
      const jobsWithSkillsCount = uniqueJobIds.size
      const totalCount = totalJobs || 0
      const yieldValue = totalCount > 0 ? Math.round((jobsWithSkillsCount / totalCount) * 100) : 0
      const uniqueCount = Object.keys(counts).length

      setStats([
        { 
          label: 'Market Coverage', 
          value: totalCount, 
          sub: 'Total jobs scanned', 
          icon: Briefcase, 
          color: 'text-blue-400' 
        },
        { 
          label: 'Intelligence Yield', 
          value: `${yieldValue}%`, 
          sub: 'Extraction efficiency', 
          icon: Zap, 
          color: 'text-orange-400' 
        },
        { 
          label: 'Knowledge Base', 
          value: uniqueCount, 
          sub: 'Distinct skills catalogued', 
          icon: Layers, 
          color: 'text-indigo-400' 
        },
        { 
          label: 'Top Signal', 
          value: sortedSkills[0]?.name || 'N/A', 
          sub: 'Most demanded skillset', 
          icon: TrendingUp, 
          color: 'text-emerald-400' 
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
        <AnimatePresence>
          {loading ? (
            Array(4).fill(0).map((_, i) => (
              <div key={i} className="h-24 bg-white/5 border border-white/5 rounded-2xl animate-pulse" />
            ))
          ) : (
            stats.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="glass-card p-5 group hover:border-indigo-500/30 transition-all cursor-default"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">{stat.label}</p>
                    <h3 className={`text-2xl font-bold font-mono ${stat.color}`}>{stat.value}</h3>
                    <p className="text-[10px] text-zinc-600 mt-1 font-medium">{stat.sub}</p>
                  </div>
                  <div className={`p-2 rounded-xl bg-white/5 group-hover:bg-indigo-500/10 transition-colors`}>
                    <stat.icon className={`w-5 h-5 ${stat.color}`} />
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Main Chart - 30 Top Skills */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
          className="lg:col-span-8 glass-card p-6"
        >
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
                <Target className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-zinc-200">Market Demand Intensity</h3>
                <p className="text-xs text-zinc-500">Frequency of extracted skills across all sources</p>
              </div>
            </div>
            <div className="flex gap-2">
              <div className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[9px] font-bold uppercase text-zinc-400">Top 30</div>
            </div>
          </div>

          <div className="h-[650px] w-full min-h-[650px]">
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
                          <div className="mt-1 flex items-center justify-between gap-8">
                            <span className="text-xs text-zinc-500">Category</span>
                            <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-white/5 text-zinc-400">
                              {payload[0].payload.category}
                            </span>
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
        </motion.div>

        {/* Sidebar Widgets */}
        <div className="lg:col-span-4 space-y-6">
          {/* Category Dist Weight */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
            className="glass-card p-6"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-xl bg-orange-500/10 text-orange-400">
                <Layout className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-zinc-200 uppercase tracking-wider">Skill Clusters</h3>
            </div>

            <div className="h-[300px] w-full mt-4 min-h-[300px]">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={categoryData}>
                  <PolarGrid stroke="rgba(255,255,255,0.05)" />
                  <PolarAngleAxis 
                    dataKey="subject" 
                    tick={{ fill: '#71717a', fontSize: 10, fontWeight: 700 }} 
                  />
                  <PolarRadiusAxis 
                    angle={30} 
                    domain={[0, 100]} 
                    tick={false}
                    axisLine={false}
                  />
                  <Radar
                    name="Market Weight"
                    dataKey="A"
                    stroke="#6366f1"
                    strokeWidth={2}
                    fill="#6366f1"
                    fillOpacity={0.4}
                  />
                  <Tooltip
                    contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '8px', fontSize: '10px' }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            
            <div className="mt-6 space-y-3">
              {categoryData.map((item, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-xs text-zinc-500">{item.subject}</span>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-24 bg-white/5 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-indigo-500/40 rounded-full" 
                        style={{ width: `${item.A}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-mono text-zinc-400 font-bold">{Math.round(item.A)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Quick Insights */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6 }}
            className="glass-card p-6 bg-indigo-500/5"
          >
            <div className="flex items-center gap-3 mb-4 text-indigo-400">
              <Cpu className="w-5 h-5" />
              <h3 className="text-xs font-bold uppercase tracking-widest">Market Insight</h3>
            </div>
            <p className="text-xs text-zinc-300 leading-relaxed">
              Technical skills continue to dominate the extraction yield. Focus on clustering 
              <span className="text-indigo-400 font-bold ml-1">Domain expertise</span> 
              to provide higher-value recommendations to senior students.
            </p>
            <div className="mt-6 pt-6 border-t border-white/5">
              <button className="w-full py-2 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 rounded-xl text-[10px] font-bold text-indigo-400 uppercase tracking-tighter transition-all">
                Generate Market Report
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
