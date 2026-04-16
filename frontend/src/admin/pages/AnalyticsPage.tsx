import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  AreaChart, Area, Cell,
} from 'recharts'
import { PageHeader } from '../components/shared/PageHeader'

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']

/**
 * AnalyticsPage — job market insights, student engagement, and recommendation quality.
 */
export function AnalyticsPage() {
  const [topSkills, setTopSkills] = useState<{ name: string; count: number }[]>([])
  const [jobsByCity, setJobsByCity] = useState<{ city: string; count: number }[]>([])
  const [scrapingTrend, setScrapingTrend] = useState<{ week: string; jobs: number }[]>([])
  const [matchDist, setMatchDist] = useState<{ range: string; count: number }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchAll = async () => {
      // Top skills from job_skills
      const { data: skillsData } = await supabase.from('job_skills').select('skill').limit(3000)
      const skillCounts: Record<string, number> = {}
      for (const s of (skillsData ?? [])) {
        skillCounts[s.skill] = (skillCounts[s.skill] ?? 0) + 1
      }
      setTopSkills(
        Object.entries(skillCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([name, count]) => ({ name, count }))
      )

      // Jobs by city
      const { data: cityData } = await supabase.from('jobs').select('location').limit(2000)
      const cityCounts: Record<string, number> = {}
      for (const j of (cityData ?? [])) {
        const city = (j.location ?? 'Unknown').split(',')[0].trim()
        cityCounts[city] = (cityCounts[city] ?? 0) + 1
      }
      setJobsByCity(
        Object.entries(cityCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 8)
          .map(([city, count]) => ({ city, count }))
      )

      // Scraping trend last 12 weeks
      const { data: runs } = await supabase
        .from('scraper_runs')
        .select('started_at, jobs_found')
        .gte('started_at', new Date(Date.now() - 84 * 24 * 60 * 60 * 1000).toISOString())
        .order('started_at')
      const byWeek: Record<string, number> = {}
      for (const r of (runs ?? [])) {
        const d = new Date(r.started_at)
        const week = `W${Math.ceil(d.getDate() / 7)} ${d.toLocaleString('default', { month: 'short' })}`
        byWeek[week] = (byWeek[week] ?? 0) + r.jobs_found
      }
      setScrapingTrend(Object.entries(byWeek).map(([week, jobs]) => ({ week, jobs })))

      // Match score distribution from recommendations (mock ranges)
      setMatchDist([
        { range: '>70%', count: 0 },
        { range: '40–70%', count: 0 },
        { range: '<40%', count: 0 },
      ])

      setLoading(false)
    }
    fetchAll()
  }, [])

  const ChartCard = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
      <h3 className="text-sm font-bold text-foreground mb-6 font-['Sora',sans-serif] uppercase tracking-wider">{title}</h3>
      {children}
    </div>
  )

  const empty = (
    <div className="h-48 flex items-center justify-center text-xs font-bold uppercase tracking-widest text-muted-foreground/40">
      No analytical data — scrape jobs to unlock
    </div>
  )

  return (
    <div>
      <PageHeader
        title="Analytics"
        description="Platform insights and job market intelligence"
      />

      {/* Section A: Job Market */}
      <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 mb-4 flex items-center gap-2">
        <div className="h-px w-8 bg-muted-foreground/20" />
        Job Market Insights
      </h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <ChartCard title="Top 10 Most Demanded Skills">
          {topSkills.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={topSkills} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} opacity={0.4} />
                <XAxis type="number" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: 'hsl(var(--foreground))', fontWeight: 600 }} width={90} />
                <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 12, fontSize: 12, color: 'hsl(var(--popover-foreground))' }} />
                <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : empty}
        </ChartCard>

        <ChartCard title="Jobs by City">
          {jobsByCity.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={jobsByCity}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                <XAxis dataKey="city" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 12, fontSize: 12, color: 'hsl(var(--popover-foreground))' }} />
                <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : empty}
        </ChartCard>

        <ChartCard title="Scraping Trend — Last 12 Weeks">
          {scrapingTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={scrapingTrend}>
                <defs>
                  <linearGradient id="scrapeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                <XAxis dataKey="week" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 12, fontSize: 12, color: 'hsl(var(--popover-foreground))' }} />
                <Area type="monotone" dataKey="jobs" stroke="#6366f1" fill="url(#scrapeGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : empty}
        </ChartCard>

        <ChartCard title="Jobs Distribution by Source">
          {loading ? empty : (
            <div className="h-[200px] flex items-center justify-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">
              Run scrapers to populate breakdown
            </div>
          )}
        </ChartCard>
      </div>

      {/* Section C: Recommendation Quality */}
      <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 mb-4 mt-8 flex items-center gap-2">
        <div className="h-px w-8 bg-muted-foreground/20" />
        Recommendation Quality
      </h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <ChartCard title="Match Score Distribution">
          {matchDist.some(d => d.count > 0) ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={matchDist}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                <XAxis dataKey="range" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))', fontWeight: 600 }} />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 12, fontSize: 12, color: 'hsl(var(--popover-foreground))' }} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {matchDist.map((_, i) => (
                    <Cell key={i} fill={COLORS[i]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">
              No matching data available
            </div>
          )}
        </ChartCard>

        <ChartCard title="Student Engagement Over Time">
          <div className="h-[200px] flex items-center justify-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">
            Registration metrics will appear here
          </div>
        </ChartCard>
      </div>
    </div>
  )
}
