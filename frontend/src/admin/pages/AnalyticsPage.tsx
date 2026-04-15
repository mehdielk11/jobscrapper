import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  AreaChart, Area, LineChart, Line, PieChart, Pie, Cell, Legend,
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
    <div className="bg-[#1a1a1f] border border-white/5 rounded-2xl p-5">
      <h3 className="text-sm font-semibold text-zinc-300 mb-4 font-['Sora',sans-serif]">{title}</h3>
      {children}
    </div>
  )

  const empty = (
    <div className="h-48 flex items-center justify-center text-sm text-zinc-600">
      No data yet — scrape some jobs to see insights
    </div>
  )

  return (
    <div>
      <PageHeader
        title="Analytics"
        description="Platform insights and job market intelligence"
      />

      {/* Section A: Job Market */}
      <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-600 mb-3">
        Job Market Insights
      </h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <ChartCard title="Top 10 Most Demanded Skills">
          {topSkills.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={topSkills} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: '#52525b' }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#a1a1aa' }} width={90} />
                <Tooltip contentStyle={{ background: '#1a1a1f', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : empty}
        </ChartCard>

        <ChartCard title="Jobs by City">
          {jobsByCity.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={jobsByCity}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="city" tick={{ fontSize: 10, fill: '#52525b' }} />
                <YAxis tick={{ fontSize: 10, fill: '#52525b' }} />
                <Tooltip contentStyle={{ background: '#1a1a1f', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }} />
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
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="week" tick={{ fontSize: 10, fill: '#52525b' }} />
                <YAxis tick={{ fontSize: 10, fill: '#52525b' }} />
                <Tooltip contentStyle={{ background: '#1a1a1f', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }} />
                <Area type="monotone" dataKey="jobs" stroke="#6366f1" fill="url(#scrapeGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : empty}
        </ChartCard>

        <ChartCard title="Jobs Distribution by Source">
          {loading ? empty : (
            <div className="h-[200px] flex items-center justify-center text-sm text-zinc-600">
              Run scrapers to populate source distribution
            </div>
          )}
        </ChartCard>
      </div>

      {/* Section C: Recommendation Quality */}
      <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-600 mb-3">
        Recommendation Quality
      </h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <ChartCard title="Match Score Distribution">
          {matchDist.some(d => d.count > 0) ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={matchDist}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="range" tick={{ fontSize: 11, fill: '#a1a1aa' }} />
                <YAxis tick={{ fontSize: 10, fill: '#52525b' }} />
                <Tooltip contentStyle={{ background: '#1a1a1f', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {matchDist.map((_, i) => (
                    <Cell key={i} fill={COLORS[i]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-sm text-zinc-600">
              No recommendation data yet
            </div>
          )}
        </ChartCard>

        <ChartCard title="Student Engagement Over Time">
          <div className="h-[200px] flex items-center justify-center text-sm text-zinc-600">
            Student registration data will appear here
          </div>
        </ChartCard>
      </div>
    </div>
  )
}
