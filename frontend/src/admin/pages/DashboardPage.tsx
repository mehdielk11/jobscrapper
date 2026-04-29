import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Briefcase, Users, Tags, Bot, RefreshCw } from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { StatCard } from '../components/shared/StatCard'
import { PageHeader } from '../components/shared/PageHeader'
import { formatDistanceToNow } from 'date-fns'

interface DashStats {
  totalJobs: number
  newToday: number
  totalUsers: number
  totalSkills: number
  lastScrapeAt: string | null
  lastScrapeStatus: string | null
}

interface PipelineHealth {
  pending: number
  extracted: number
  no_skills_found: number
  failed: number
}

interface ScrapingTrendPoint {
  date: string
  [source: string]: number | string
}

const SOURCES_CONFIG: Record<string, { label: string, color: string }> = {
  'rekrute': { label: 'ReKrute', color: '#6366f1' },
  'emploidiali': { label: 'EmploiDiali', color: '#10b981' },
  'indeed': { label: 'Indeed', color: '#f59e0b' },
  'linkedin': { label: 'LinkedIn', color: '#ef4444' },
  'emploi-public': { label: 'Emploi Public', color: '#8b5cf6' },
  'emploipublic': { label: 'Emploi Public', color: '#8b5cf6' }, // Normalize
  'marocannonces': { label: 'Maroc Annonces', color: '#06b6d4' },
}

const DEFAULT_COLOR = '#71717a'



/**
 * Dashboard Page — single-glance platform KPIs, trend charts, and activity feed.
 */
export function DashboardPage() {
  const [stats, setStats] = useState<DashStats | null>(null)
  const [pipelineHealth, setPipelineHealth] = useState<PipelineHealth>({ pending: 0, extracted: 0, no_skills_found: 0, failed: 0 })
  const [trendData, setTrendData] = useState<ScrapingTrendPoint[]>([])
  const [donutData, setDonutData] = useState<{ name: string; value: number }[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchAll = async () => {
    setLoading(true)
    try {
      // Total jobs
      const { count: jobCount } = await supabase
        .from('jobs')
        .select('*', { count: 'exact', head: true })

      // Jobs added today
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      const { count: todayCount } = await supabase
        .from('jobs')
        .select('*', { count: 'exact', head: true })
        .gte('scraped_at', todayStart.toISOString())

      // Total users
      const { count: userCount } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })

      // Total skills in taxonomy (from job_skills pivot)
      const { data: skillsData } = await supabase
        .from('job_skills')
        .select('skill')
        .limit(1000)
      const uniqueSkills = new Set(skillsData?.map((s: { skill: string }) => s.skill) ?? [])

      // Last explicit run from the admin panel
      const { data: lastRun } = await supabase
        .from('scraper_runs')
        .select('started_at, status')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      // Last job scraped (captures cron jobs)
      const { data: lastJob } = await supabase
        .from('jobs')
        .select('scraped_at')
        .order('scraped_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      let finalScrapeAt = lastRun?.started_at ?? null
      let finalStatus = lastRun?.status ?? null

      if (lastJob?.scraped_at) {
        if (!finalScrapeAt || new Date(lastJob.scraped_at) > new Date(finalScrapeAt)) {
          finalScrapeAt = lastJob.scraped_at
          finalStatus = 'success'
        }
      }

      setStats({
        totalJobs: jobCount ?? 0,
        newToday: todayCount ?? 0,
        totalUsers: userCount ?? 0,
        totalSkills: uniqueSkills.size,
        lastScrapeAt: finalScrapeAt,
        lastScrapeStatus: finalStatus,
      })

      // Jobs distribution by source (donut)
      const { data: sourceDist } = await supabase
        .from('jobs')
        .select('source')
        .limit(5000)
      const sourceCounts: Record<string, number> = {}
      for (const j of (sourceDist ?? [])) {
        const rawSource = j.source?.toLowerCase() ?? 'unknown'
        const config = SOURCES_CONFIG[rawSource]
        const label = config?.label ?? 
                     (rawSource === 'unknown' ? 'Unknown' : rawSource.charAt(0).toUpperCase() + rawSource.slice(1))
        sourceCounts[label] = (sourceCounts[label] ?? 0) + 1
      }
      setDonutData(
        Object.entries(sourceCounts)
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value)
      )

      // Scraping trend last 30 days (from jobs table to include background scrapes)
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      thirtyDaysAgo.setHours(0, 0, 0, 0)

      const { data: recentJobs } = await supabase
        .from('jobs')
        .select('source, scraped_at')
        .gte('scraped_at', thirtyDaysAgo.toISOString())
        .order('scraped_at')

      let minDateStr = ''
      const grouped: Record<string, Record<string, number>> = {}

      for (const job of (recentJobs ?? [])) {
        if (!job.scraped_at || !job.source) continue
        const date = job.scraped_at.slice(0, 10)
        const src = job.source.toLowerCase()
        
        if (!grouped[date]) grouped[date] = {}
        grouped[date][src] = (grouped[date][src] ?? 0) + 1
        
        if (!minDateStr || date < minDateStr) {
          minDateStr = date
        }
      }

      const trendArray: ScrapingTrendPoint[] = []
      if (minDateStr) {
        const todayStr = new Date().toISOString().slice(0, 10)
        let currentStr = minDateStr
        const d = new Date(minDateStr + 'T00:00:00Z')
        
        const allSources = Object.keys(SOURCES_CONFIG).filter(k => k !== 'emploipublic')
        
        let safety = 0
        while (currentStr <= todayStr && safety <= 31) {
          const point: Record<string, number | string> = { date: currentStr }
          const dayData = grouped[currentStr] || {}
          
          for (const src of allSources) {
            let count = dayData[src] ?? 0
            if (src === 'emploi-public' && dayData['emploipublic']) {
              count += dayData['emploipublic']
            }
            point[src] = count
          }
          
          trendArray.push(point as ScrapingTrendPoint)
          d.setUTCDate(d.getUTCDate() + 1)
          currentStr = d.toISOString().slice(0, 10)
          safety++
        }
      }

      setTrendData(trendArray)

      // Pipeline Health Breakdown
      const { data: pipelineData } = await supabase.from('jobs').select('nlp_status')
      const health: PipelineHealth = { pending: 0, extracted: 0, no_skills_found: 0, failed: 0 }
      pipelineData?.forEach(job => {
        const s = job.nlp_status as keyof PipelineHealth
        if (health[s] !== undefined) {
          health[s]++
        } else if (!s) {
          health.pending++ // Default to pending if null
        }
      })
      setPipelineHealth(health)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { fetchAll() }, [])

  const handleRefresh = () => {
    setRefreshing(true)
    fetchAll()
  }

  const statusColor = (status: string | null) => {
    if (status === 'success') return 'text-emerald-500 font-bold'
    if (status === 'failed') return 'text-red-500 font-bold'
    if (status === 'running') return 'text-blue-500 font-bold animate-pulse'
    return 'text-muted-foreground'
  }

  return (
    <div>
      <PageHeader
        title="Platform Dashboard"
        description="Platform health overview"
        action={
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-card border border-border hover:bg-muted text-[10px] font-black uppercase tracking-widest text-foreground transition-all disabled:opacity-50 shadow-sm"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            Refresh Data
          </button>
        }
      />

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          title="Total Jobs"
          value={stats?.totalJobs.toLocaleString() ?? '—'}
          delta={stats?.newToday ? `+${stats.newToday} today` : undefined}
          deltaType="up"
          icon={Briefcase}
          loading={loading}
          iconColor="text-indigo-400"
        />
        <StatCard
          title="Users"
          value={stats?.totalUsers.toLocaleString() ?? '—'}
          icon={Users}
          loading={loading}
          iconColor="text-emerald-400"
        />
        <StatCard
          title="Skills in Taxonomy"
          value={stats?.totalSkills.toLocaleString() ?? '—'}
          icon={Tags}
          loading={loading}
          iconColor="text-amber-400"
        />
        <StatCard
          title="Last Scrape"
          value={stats?.lastScrapeAt
            ? formatDistanceToNow(new Date(stats.lastScrapeAt), { addSuffix: true })
            : 'Never'}
          delta={stats?.lastScrapeStatus ?? undefined}
          deltaType={stats?.lastScrapeStatus === 'success' ? 'up' : 'neutral'}
          icon={Bot}
          loading={loading}
          iconColor={stats?.lastScrapeStatus ? statusColor(stats.lastScrapeStatus) : 'text-muted-foreground'}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-6">
        {/* Line chart */}
        <div className="lg:col-span-3 bg-card border border-border rounded-2xl p-6 transition-all duration-500 shadow-sm">
          <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-6">
            Platform Integration Trend
          </h3>
          {trendData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis 
                  dataKey="date" 
                  stroke="hsl(var(--muted-foreground))" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontWeight: 600 }}
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontWeight: 600 }}
                />
                <Tooltip
                  contentStyle={{ 
                    background: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))', 
                    borderRadius: 12, 
                    fontSize: 12,
                    boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
                    color: 'hsl(var(--foreground))'
                  }}
                  labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 'bold' }}
                />
                {Object.keys(SOURCES_CONFIG).filter(k => k !== 'emploipublic').map((src) => (
                  <Line
                    key={src}
                    type="monotone"
                    dataKey={src}
                    stroke={SOURCES_CONFIG[src].color}
                    strokeWidth={2}
                    dot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">
              No scraping history yet
            </div>
          )}
        </div>

        {/* Donut chart */}
        <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-6 transition-all duration-500 shadow-sm">
          <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-6">
            Jobs by Source
          </h3>
          {donutData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={donutData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  dataKey="value"
                  paddingAngle={5}
                  animationDuration={1500}
                >
                  {donutData.map((entry, index) => {
                    const configEntry = Object.values(SOURCES_CONFIG).find(c => c.label === entry.name)
                    return (
                      <Cell 
                        key={index} 
                        fill={configEntry?.color ?? DEFAULT_COLOR} 
                        stroke="none"
                      />
                    )
                  })}
                </Pie>
                <Legend
                  verticalAlign="bottom"
                  align="center"
                  iconType="circle"
                  iconSize={6}
                  wrapperStyle={{ paddingTop: 20 }}
                  formatter={(v) => <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{v}</span>}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const total = donutData.reduce((acc, curr) => acc + curr.value, 0)
                      const percent = ((payload[0].value as number / total) * 100).toFixed(1)
                      return (
                        <div className="bg-popover border border-border p-3 rounded-xl shadow-2xl backdrop-blur-md transition-colors duration-500">
                          <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1">Source Share</p>
                          <p className="text-sm font-bold text-foreground">{payload[0].name}</p>
                          <div className="mt-2 flex items-center justify-between gap-8">
                            <span className="text-xs text-muted-foreground">Volume</span>
                            <span className="text-xs font-mono font-bold text-foreground">{payload[0].value}</span>
                          </div>
                          <div className="flex items-center justify-between gap-8">
                            <span className="text-xs text-muted-foreground">Market Share</span>
                            <span className="text-xs font-mono font-bold text-emerald-500">{percent}%</span>
                          </div>
                        </div>
                      )
                    }
                    return null
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">
              No data yet
            </div>
          )}
        </div>
      </div>

      {/* Pipeline Health */}
      <div className="bg-card border border-border rounded-2xl p-6 transition-all duration-500 shadow-sm flex flex-col">
        <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-6">
          Pipeline Health &amp; NLP Status
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 flex-1">
          {/* Pending */}
          <div className="bg-muted/30 border border-border rounded-xl p-4 flex flex-col justify-center">
            <div className="flex items-center gap-2 mb-2 text-zinc-500">
              <RefreshCw size={14} className="animate-spin" />
              <span className="text-[10px] font-black uppercase tracking-widest">Pending</span>
            </div>
            <p className="text-2xl font-bold text-foreground tabular-nums">
              {pipelineHealth.pending.toLocaleString()}
            </p>
          </div>

          {/* Extracted */}
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex flex-col justify-center">
            <div className="flex items-center gap-2 mb-2 text-emerald-500">
              <Bot size={14} />
              <span className="text-[10px] font-black uppercase tracking-widest">Extracted</span>
            </div>
            <p className="text-2xl font-bold text-emerald-500 tabular-nums">
              {pipelineHealth.extracted.toLocaleString()}
            </p>
          </div>

          {/* No Skills Found */}
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex flex-col justify-center">
            <div className="flex items-center gap-2 mb-2 text-amber-500">
              <Tags size={14} />
              <span className="text-[10px] font-black uppercase tracking-widest">No Skills Found</span>
            </div>
            <p className="text-2xl font-bold text-amber-500 tabular-nums">
              {pipelineHealth.no_skills_found.toLocaleString()}
            </p>
          </div>

          {/* Failed */}
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex flex-col justify-center">
            <div className="flex items-center gap-2 mb-2 text-red-500">
              <Briefcase size={14} />
              <span className="text-[10px] font-black uppercase tracking-widest">Failed</span>
            </div>
            <p className="text-2xl font-bold text-red-500 tabular-nums">
              {pipelineHealth.failed.toLocaleString()}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
