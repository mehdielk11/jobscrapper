import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Briefcase, Users, Tags, Bot, RefreshCw, Activity } from 'lucide-react'
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
  totalStudents: number
  totalSkills: number
  lastScrapeAt: string | null
  lastScrapeStatus: string | null
}

interface SystemEvent {
  id: string
  event_type: string
  message: string
  created_at: string
}

interface ScrapingTrendPoint {
  date: string
  [source: string]: number | string
}

const SOURCES = ['rekrute', 'emploidiali', 'indeed', 'linkedin', 'emploi-public', 'marocannonces']
const SOURCE_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']

const EVENT_ICONS: Record<string, string> = {
  scraper_run: '🕷️',
  skill_extracted: '🏷️',
  student_registered: '👥',
  job_moderated: '💼',
}

/**
 * Dashboard Page — single-glance platform KPIs, trend charts, and activity feed.
 */
export function DashboardPage() {
  const [stats, setStats] = useState<DashStats | null>(null)
  const [events, setEvents] = useState<SystemEvent[]>([])
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

      // Total students
      const { count: studentCount } = await supabase
        .from('students')
        .select('*', { count: 'exact', head: true })

      // Total skills in taxonomy (from job_skills pivot)
      const { data: skillsData } = await supabase
        .from('job_skills')
        .select('skill')
        .limit(1000)
      const uniqueSkills = new Set(skillsData?.map((s: { skill: string }) => s.skill) ?? [])

      // Last scrape
      const { data: lastRun } = await supabase
        .from('scraper_runs')
        .select('started_at, status')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      setStats({
        totalJobs: jobCount ?? 0,
        newToday: todayCount ?? 0,
        totalStudents: studentCount ?? 0,
        totalSkills: uniqueSkills.size,
        lastScrapeAt: lastRun?.started_at ?? null,
        lastScrapeStatus: lastRun?.status ?? null,
      })

      // Jobs distribution by source (donut)
      const { data: sourceDist } = await supabase
        .from('jobs')
        .select('source')
        .limit(2000)
      const sourceCounts: Record<string, number> = {}
      for (const j of (sourceDist ?? [])) {
        const s = j.source ?? 'unknown'
        sourceCounts[s] = (sourceCounts[s] ?? 0) + 1
      }
      setDonutData(Object.entries(sourceCounts).map(([name, value]) => ({ name, value })))

      // Scraping trend last 30 days (from scraper_runs)
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      const { data: runs } = await supabase
        .from('scraper_runs')
        .select('source, jobs_found, started_at')
        .gte('started_at', thirtyDaysAgo.toISOString())
        .order('started_at')
      
      // Group by date
      const byDate: Record<string, Record<string, number>> = {}
      for (const run of (runs ?? [])) {
        const date = run.started_at.slice(0, 10)
        if (!byDate[date]) byDate[date] = {}
        byDate[date][run.source] = (byDate[date][run.source] ?? 0) + run.jobs_found
      }
      setTrendData(Object.entries(byDate).map(([date, sources]) => ({ date, ...sources })))

      // Recent system events
      const { data: eventsData } = await supabase
        .from('system_events')
        .select('id, event_type, message, created_at')
        .order('created_at', { ascending: false })
        .limit(10)
      setEvents(eventsData ?? [])
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
    if (status === 'success') return 'text-emerald-400'
    if (status === 'failed') return 'text-red-400'
    if (status === 'running') return 'text-blue-400'
    return 'text-zinc-500'
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
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm text-zinc-300 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            Refresh
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
          title="Students"
          value={stats?.totalStudents.toLocaleString() ?? '—'}
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
          iconColor={stats?.lastScrapeStatus ? statusColor(stats.lastScrapeStatus) : 'text-zinc-500'}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-6">
        {/* Line chart */}
        <div className="lg:col-span-3 bg-[#1a1a1f] border border-white/5 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-zinc-300 mb-4 font-['Sora',sans-serif]">
            Jobs Scraped — Last 30 Days
          </h3>
          {trendData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#52525b' }} />
                <YAxis tick={{ fontSize: 10, fill: '#52525b' }} />
                <Tooltip
                  contentStyle={{ background: '#1a1a1f', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: '#e4e4e7' }}
                />
                {SOURCES.map((src, i) => (
                  <Line
                    key={src}
                    type="monotone"
                    dataKey={src}
                    stroke={SOURCE_COLORS[i]}
                    strokeWidth={1.5}
                    dot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-sm text-zinc-600">
              No scraping history yet
            </div>
          )}
        </div>

        {/* Donut chart */}
        <div className="lg:col-span-2 bg-[#1a1a1f] border border-white/5 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-zinc-300 mb-4 font-['Sora',sans-serif]">
            Jobs by Source
          </h3>
          {donutData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={donutData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  dataKey="value"
                  paddingAngle={3}
                >
                  {donutData.map((_, index) => (
                    <Cell key={index} fill={SOURCE_COLORS[index % SOURCE_COLORS.length]} />
                  ))}
                </Pie>
                <Legend
                  iconType="circle"
                  iconSize={8}
                  formatter={(v) => <span style={{ color: '#a1a1aa', fontSize: 11 }}>{v}</span>}
                />
                <Tooltip
                  contentStyle={{ background: '#1a1a1f', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-sm text-zinc-600">
              No data yet
            </div>
          )}
        </div>
      </div>

      {/* Activity feed */}
      <div className="bg-[#1a1a1f] border border-white/5 rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-zinc-300 mb-4 flex items-center gap-2 font-['Sora',sans-serif]">
          <Activity size={14} className="text-indigo-400" />
          Recent Activity
        </h3>
        {events.length === 0 ? (
          <p className="text-sm text-zinc-600 py-4 text-center">No system events recorded yet.</p>
        ) : (
          <div className="space-y-2">
            {events.map(event => (
              <div key={event.id} className="flex items-start gap-3 py-2.5 border-b border-white/5 last:border-0">
                <span className="text-base flex-shrink-0 mt-0.5">
                  {EVENT_ICONS[event.event_type] ?? '⚡'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-zinc-300 truncate">{event.message}</p>
                  <p className="text-xs text-zinc-600 mt-0.5">
                    {formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
                  </p>
                </div>
                <span className="text-xs text-zinc-600 flex-shrink-0 font-mono">
                  {event.event_type}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
