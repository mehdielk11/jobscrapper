import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  AreaChart, Area, Cell, PieChart, Pie,
} from 'recharts'
import {
  Users, TrendingUp, Target, Shield, AlertTriangle, CheckCircle2,
  Lightbulb, Loader2, ChevronDown, ChevronUp, Zap,
} from 'lucide-react'

const TIER_COLORS = { high: '#10b981', medium: '#f59e0b', low: '#ef4444' }
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

interface Analytics {
  total_members: number
  members_with_skills: number
  avg_skills_per_member: number
  profile_completion_pct: number
  market_readiness_pct: number
  skill_gap_count: number
  org_strengths: { skill: string; org_count: number; demand_count: number }[]
  skill_gaps: { skill: string; demand_count: number }[]
  student_readiness: {
    name: string; email: string; skills_count: number;
    hard_count: number; soft_count: number;
    matched_jobs: number; avg_score: number;
    readiness_pct: number; tier: string; joined_at: string | null
  }[]
  readiness_distribution: { tier: string; count: number }[]
  top_org_skills: { skill: string; count: number }[]
  top_org_hard: { skill: string; count: number }[]
  top_org_soft: { skill: string; count: number }[]
  top_demand_skills: { skill: string; count: number }[]
  top_demand_hard: { skill: string; count: number }[]
  top_demand_soft: { skill: string; count: number }[]
  member_growth: { month: string; count: number }[]
  recommendations: { type: string; title: string; message: string }[]
}

export function AnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAllStudents, setShowAllStudents] = useState(false)

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return
        const resp = await fetch(`${API_BASE}/api/org/mine/analytics?token=${session.access_token}`)
        if (resp.ok) setData(await resp.json())
      } catch { /* ignore */ } finally { setLoading(false) }
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

  const tooltipStyle = {
    background: 'hsl(var(--popover))',
    border: '1px solid hsl(var(--border))',
    borderRadius: 12,
    fontSize: 12,
    color: 'hsl(var(--popover-foreground))',
  }

  const emptyState = (msg: string) => (
    <div className="h-48 flex items-center justify-center text-xs font-bold uppercase tracking-widest text-muted-foreground/40">
      {msg}
    </div>
  )

  const recIcon = (type: string) => {
    switch (type) {
      case 'warning': return <AlertTriangle size={16} className="text-amber-500" />
      case 'gap': return <Target size={16} className="text-red-400" />
      case 'strength': return <Zap size={16} className="text-emerald-500" />
      case 'success': return <CheckCircle2 size={16} className="text-emerald-500" />
      case 'critical': return <AlertTriangle size={16} className="text-red-500" />
      default: return <Lightbulb size={16} className="text-blue-400" />
    }
  }

  const recBorder = (type: string) => {
    switch (type) {
      case 'warning': return 'border-amber-500/30 bg-amber-500/5'
      case 'gap': return 'border-red-400/30 bg-red-400/5'
      case 'strength': return 'border-emerald-500/30 bg-emerald-500/5'
      case 'success': return 'border-emerald-500/30 bg-emerald-500/5'
      case 'critical': return 'border-red-500/30 bg-red-500/5'
      default: return 'border-blue-400/30 bg-blue-400/5'
    }
  }

  const readinessColor = data.market_readiness_pct >= 60 ? 'text-emerald-500' : data.market_readiness_pct >= 30 ? 'text-amber-500' : 'text-red-500'

  const studentsToShow = showAllStudents ? data.student_readiness : data.student_readiness.slice(0, 8)

  // Build separate overlay chart data for hard and soft skills
  // Normalize values to percentages of their respective max so both bars are visible
  const buildOverlay = (orgSkills: typeof data.top_org_hard, demandSkills: typeof data.top_demand_hard) => {
    const allSkills = new Set([
      ...orgSkills.map(s => s.skill),
      ...demandSkills.map(s => s.skill),
    ])
    const orgMap = Object.fromEntries(orgSkills.map(s => [s.skill, s.count]))
    const demandMap = Object.fromEntries(demandSkills.map(s => [s.skill, s.count]))
    return Array.from(allSkills)
      .map(skill => ({
        skill,
        org: orgMap[skill] || 0,
        market: demandMap[skill] || 0,
      }))
      .sort((a, b) => b.market - a.market)
      .slice(0, 12)
  }

  const hardOverlayData = buildOverlay(data.top_org_hard || [], data.top_demand_hard || [])
  const softOverlayData = buildOverlay(data.top_org_soft || [], data.top_demand_soft || [])

  return (
    <div className="space-y-8 pb-12">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-black text-foreground font-['Sora',sans-serif] tracking-tight">Analytics</h1>
        <p className="text-sm text-muted-foreground mt-1">Market readiness intelligence and organisation health</p>
      </div>

      {/* ── 1. KPI Cards ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
              <Shield size={18} className="text-emerald-500" />
            </div>
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Market Readiness</p>
          </div>
          <p className={`text-3xl font-black font-['Sora',sans-serif] ${readinessColor}`}>{data.market_readiness_pct}%</p>
          <p className="text-[10px] text-muted-foreground mt-1">of students with 5+ real job matches</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center border border-red-500/20">
              <Target size={18} className="text-red-400" />
            </div>
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Skill Gaps</p>
          </div>
          <p className="text-3xl font-black text-foreground font-['Sora',sans-serif]">{data.skill_gap_count}</p>
          <p className="text-[10px] text-muted-foreground mt-1">high-demand skills missing from org</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
              <TrendingUp size={18} className="text-blue-400" />
            </div>
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Avg Skills / Member</p>
          </div>
          <p className="text-3xl font-black text-foreground font-['Sora',sans-serif]">{data.avg_skills_per_member}</p>
          <p className="text-[10px] text-muted-foreground mt-1">{data.members_with_skills} of {data.total_members} have profiles</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
              <Users size={18} className="text-amber-500" />
            </div>
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Profile Completion</p>
          </div>
          <p className="text-3xl font-black text-foreground font-['Sora',sans-serif]">{data.profile_completion_pct}%</p>
          <p className="text-[10px] text-muted-foreground mt-1">{data.total_members} total members</p>
        </div>
      </div>

      {/* ── 4. Org vs Market Charts (Hard & Soft separated) ──────────── */}
      <SectionLabel label="Org Skills vs Market Demand" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Hard Skills Chart */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-2 h-2 rounded-full bg-indigo-500" />
            <h3 className="text-sm font-bold text-foreground font-['Sora',sans-serif] uppercase tracking-wider">Hard Skills</h3>
          </div>
          {hardOverlayData.length > 0 ? (
            <ResponsiveContainer width="100%" height={340}>
              <BarChart data={hardOverlayData} layout="vertical" margin={{ left: 10, right: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} opacity={0.4} />
                <XAxis type="number" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis type="category" dataKey="skill" tick={{ fontSize: 10, fill: 'hsl(var(--foreground))', fontWeight: 600 }} width={100} interval={0} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="market" name="Market Demand" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={8} fillOpacity={0.6} />
                <Bar dataKey="org" name="Your Org" fill="#10b981" radius={[0, 4, 4, 0]} barSize={8}>
                  {hardOverlayData.map((_, index) => (
                    <Cell key={index} fill="#10b981" />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : emptyState('No hard skill data')}
          <div className="mt-3 flex items-center gap-4 justify-center">
            <div className="flex items-center gap-1.5"><div className="w-3 h-2 rounded-sm bg-indigo-500 opacity-60" /><span className="text-[10px] font-bold text-muted-foreground">Market Demand (jobs)</span></div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-2 rounded-sm bg-emerald-500" /><span className="text-[10px] font-bold text-muted-foreground">Your Org (members)</span></div>
          </div>
        </div>

        {/* Soft Skills Chart */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-2 h-2 rounded-full bg-amber-500" />
            <h3 className="text-sm font-bold text-foreground font-['Sora',sans-serif] uppercase tracking-wider">Soft Skills</h3>
          </div>
          {softOverlayData.length > 0 ? (
            <ResponsiveContainer width="100%" height={340}>
              <BarChart data={softOverlayData} layout="vertical" margin={{ left: 10, right: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} opacity={0.4} />
                <XAxis type="number" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis type="category" dataKey="skill" tick={{ fontSize: 10, fill: 'hsl(var(--foreground))', fontWeight: 600 }} width={100} interval={0} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="market" name="Market Demand" fill="#f59e0b" radius={[0, 4, 4, 0]} barSize={8} fillOpacity={0.6} />
                <Bar dataKey="org" name="Your Org" fill="#10b981" radius={[0, 4, 4, 0]} barSize={8}>
                  {softOverlayData.map((_, index) => (
                    <Cell key={index} fill="#10b981" />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : emptyState('No soft skill data')}
          <div className="mt-3 flex items-center gap-4 justify-center">
            <div className="flex items-center gap-1.5"><div className="w-3 h-2 rounded-sm bg-amber-500 opacity-60" /><span className="text-[10px] font-bold text-muted-foreground">Market Demand (jobs)</span></div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-2 rounded-sm bg-emerald-500" /><span className="text-[10px] font-bold text-muted-foreground">Your Org (members)</span></div>
          </div>
        </div>
      </div>

      {/* ── 5. Student Readiness Table ──────────────────────────────── */}
      <SectionLabel label="Student Readiness" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Readiness distribution donut */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
          <h3 className="text-sm font-bold text-foreground mb-4 font-['Sora',sans-serif] uppercase tracking-wider">Distribution</h3>
          {data.readiness_distribution.some(d => d.count > 0) ? (
            <div className="flex flex-col items-center">
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={data.readiness_distribution} dataKey="count" nameKey="tier" cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} strokeWidth={0}>
                    {data.readiness_distribution.map((_, i) => (
                      <Cell key={i} fill={Object.values(TIER_COLORS)[i]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-2 w-full">
                {data.readiness_distribution.map((d, i) => (
                  <div key={d.tier} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: Object.values(TIER_COLORS)[i] }} />
                    <span className="text-xs text-muted-foreground flex-1">{d.tier}</span>
                    <span className="text-xs font-bold text-foreground">{d.count}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : emptyState('No members')}
        </div>

        {/* Student table */}
        <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-6 shadow-sm">
          <h3 className="text-sm font-bold text-foreground mb-4 font-['Sora',sans-serif] uppercase tracking-wider">Individual Readiness</h3>
          {data.student_readiness.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest">Student</th>
                      <th className="text-center py-2 px-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest">Hard</th>
                      <th className="text-center py-2 px-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest">Soft</th>
                      <th className="text-center py-2 px-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest">Job Matches</th>
                      <th className="text-center py-2 px-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest">Avg Score</th>
                      <th className="text-center py-2 px-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest">Readiness</th>
                      <th className="text-center py-2 px-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest">Tier</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentsToShow.map((s, i) => (
                      <tr key={i} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                        <td className="py-2.5 px-2">
                          <p className="font-medium text-foreground">{s.name}</p>
                          <p className="text-[10px] text-muted-foreground">{s.email}</p>
                        </td>
                        <td className="text-center py-2.5 px-2 font-mono font-bold text-foreground">{s.hard_count}</td>
                        <td className="text-center py-2.5 px-2 font-mono font-bold text-muted-foreground">{s.soft_count}</td>
                        <td className="text-center py-2.5 px-2 font-mono font-bold text-foreground">{s.matched_jobs}</td>
                        <td className="text-center py-2.5 px-2 font-mono font-bold text-muted-foreground">{s.avg_score}%</td>
                        <td className="text-center py-2.5 px-2">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(s.readiness_pct, 100)}%`, background: TIER_COLORS[s.tier as keyof typeof TIER_COLORS] || '#666' }} />
                            </div>
                            <span className="font-mono font-bold text-foreground w-8 text-right">{s.readiness_pct}%</span>
                          </div>
                        </td>
                        <td className="text-center py-2.5 px-2">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            s.tier === 'high' ? 'bg-emerald-500/10 text-emerald-500' :
                            s.tier === 'medium' ? 'bg-amber-500/10 text-amber-500' :
                            'bg-red-500/10 text-red-500'
                          }`}>{s.tier}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {data.student_readiness.length > 8 && (
                <button
                  onClick={() => setShowAllStudents(prev => !prev)}
                  className="mt-4 flex items-center gap-1.5 text-xs font-bold text-emerald-500 hover:text-emerald-400 transition-colors mx-auto"
                >
                  {showAllStudents ? <><ChevronUp size={14} /> Show less</> : <><ChevronDown size={14} /> Show all {data.student_readiness.length} students</>}
                </button>
              )}
            </>
          ) : emptyState('No student data')}
        </div>
      </div>

      {/* ── 2. Recommendations ──────────────────────────────────────── */}
      {data.recommendations.length > 0 && (
        <>
          <SectionLabel label="Recommendations" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {data.recommendations.map((rec, i) => (
              <div key={i} className={`border rounded-2xl p-5 ${recBorder(rec.type)}`}>
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex-shrink-0">{recIcon(rec.type)}</div>
                  <div>
                    <p className="text-sm font-bold text-foreground">{rec.title}</p>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{rec.message}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── 3. Skill Gap Analysis ───────────────────────────────────── */}
      <SectionLabel label="Skill Gap Analysis" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Gaps */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-2 h-2 rounded-full bg-red-400" />
            <h3 className="text-sm font-bold text-foreground font-['Sora',sans-serif] uppercase tracking-wider">Missing from Org</h3>
          </div>
          {data.skill_gaps.length > 0 ? (
            <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
              {data.skill_gaps.map(g => (
                <div key={g.skill} className="flex items-center justify-between py-2 px-3 rounded-xl bg-red-500/5 border border-red-500/10">
                  <span className="text-sm font-medium text-foreground capitalize">{g.skill}</span>
                  <span className="text-xs font-bold text-red-400">{g.demand_count} jobs</span>
                </div>
              ))}
            </div>
          ) : emptyState('No skill gaps — great!')}
        </div>

        {/* Strengths */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <h3 className="text-sm font-bold text-foreground font-['Sora',sans-serif] uppercase tracking-wider">Org Strengths</h3>
          </div>
          {data.org_strengths.length > 0 ? (
            <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
              {data.org_strengths.map(s => (
                <div key={s.skill} className="flex items-center justify-between py-2 px-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground capitalize">{s.skill}</span>
                    <span className="text-[10px] text-muted-foreground">{s.org_count} member{s.org_count !== 1 ? 's' : ''}</span>
                  </div>
                  <span className="text-xs font-bold text-emerald-500">{s.demand_count} jobs</span>
                </div>
              ))}
            </div>
          ) : emptyState('No overlapping demand skills')}
        </div>
      </div>

      {/* ── 6. Member Growth ────────────────────────────────────────── */}
      <SectionLabel label="Growth" />
      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
        <h3 className="text-sm font-bold text-foreground mb-6 font-['Sora',sans-serif] uppercase tracking-wider">Cumulative Member Growth</h3>
        {data.member_growth.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
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
        ) : emptyState('No growth data yet')}
      </div>
    </div>
  )
}

function SectionLabel({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 pt-4">
      <div className="w-1 h-6 bg-emerald-500 rounded-full" />
      <h2 className="text-sm font-bold text-foreground font-['Sora',sans-serif] uppercase tracking-wider">
        {label}
      </h2>
      <div className="flex-1 h-px bg-border" />
    </div>
  )
}
