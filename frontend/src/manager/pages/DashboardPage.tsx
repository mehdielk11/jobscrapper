import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useManagerOrg } from '../hooks/useManagerOrg'
import { useOrgMembers } from '../hooks/useOrgMembers'
import {
  Copy, Check, ArrowRight, Users, BarChart3, Tags, Settings,
  Target, UserCheck, Loader2, Award,
} from 'lucide-react'
import { toast } from 'react-hot-toast'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

interface AnalyticsSummary {
  market_readiness_pct: number
  skill_gap_count: number
  profile_completion_pct: number
  total_members: number
  members_with_skills: number
  avg_skills_per_member: number
  org_strengths: { skill: string; org_count: number; demand_count: number }[]
  skill_gaps: { skill: string; demand_count: number }[]
  recommendations: { type: string; title: string; message: string }[]
}

export function DashboardPage() {
  const { org } = useManagerOrg()
  const { members, loading: membersLoading } = useOrgMembers()
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null)
  const [topDemandSkill, setTopDemandSkill] = useState<string | null>(null)
  const [totalJobs, setTotalJobs] = useState(0)
  const [copied, setCopied] = useState(false)
  const navigate = useNavigate()

  // Fetch analytics summary
  useEffect(() => {
    const fetch_ = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return
        const resp = await fetch(`${API_BASE}/api/org/mine/analytics?token=${session.access_token}`)
        if (resp.ok) setAnalytics(await resp.json())
      } catch { /* ignore */ }
    }
    fetch_()
  }, [])

  // Fetch top demand skill + total jobs for the quick-link card
  useEffect(() => {
    const fetch_ = async () => {
      const [
        { count },
        { data: skillsData },
      ] = await Promise.all([
        supabase.from('jobs').select('*', { count: 'exact', head: true }),
        supabase.from('job_skills').select('skill').limit(5000),
      ])
      setTotalJobs(count || 0)
      const counts: Record<string, number> = {}
      for (const s of (skillsData ?? [])) {
        const sk = s.skill.toLowerCase()
        counts[sk] = (counts[sk] ?? 0) + 1
      }
      const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
      if (top) setTopDemandSkill(top[0])
    }
    fetch_()
  }, [])

  const copyCode = () => {
    if (!org?.invite_code) return
    navigator.clipboard.writeText(org.invite_code)
    setCopied(true)
    toast.success('Invite code copied!')
    setTimeout(() => setCopied(false), 2000)
  }

  // Derived data
  const totalMembers = members.length
  const uniqueSkills = new Set(members.flatMap(m => m.skills)).size



  // Recent 5 members (sorted by joined_at desc)
  const recentMembers = [...members]
    .sort((a, b) => (b.joined_at || '').localeCompare(a.joined_at || ''))
    .slice(0, 5)



  const loading = membersLoading || !analytics

  return (
    <div className="space-y-8 pb-12">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-black text-foreground font-['Sora',sans-serif] tracking-tight">Dashboard</h1>
        {org?.name && <p className="text-sm text-muted-foreground mt-1">Organisation overview for <span className="font-semibold text-foreground">{org.name}</span></p>}
      </div>

      {/* ── Health Snapshot KPIs ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Members */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
              <Users size={18} className="text-emerald-500" />
            </div>
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Total Members</p>
          </div>
          {!membersLoading ? (
            <p className="text-3xl font-black text-foreground font-['Sora',sans-serif]">{totalMembers}</p>
          ) : <SkeletonValue />}
          <p className="text-[10px] text-muted-foreground mt-1">in your organisation</p>
        </div>

        {/* Unique Skills */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
              <Award size={18} className="text-blue-400" />
            </div>
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Unique Skills</p>
          </div>
          {!membersLoading ? (
            <p className="text-3xl font-black text-foreground font-['Sora',sans-serif]">{uniqueSkills}</p>
          ) : <SkeletonValue />}
          <p className="text-[10px] text-muted-foreground mt-1">across all members</p>
        </div>

        {/* Profile Completion — progress ring */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
              <UserCheck size={18} className="text-amber-500" />
            </div>
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Profile Completion</p>
          </div>
          {analytics ? (
            <div className="flex items-end gap-3">
              <p className="text-3xl font-black text-foreground font-['Sora',sans-serif]">{analytics.profile_completion_pct}%</p>
              <ProgressRing pct={analytics.profile_completion_pct} />
            </div>
          ) : <SkeletonValue />}
          <p className="text-[10px] text-muted-foreground mt-1">{analytics ? `${analytics.members_with_skills} of ${analytics.total_members} with skills` : ''}</p>
        </div>

        {/* Skill Gaps */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center border border-red-500/20">
              <Target size={18} className="text-red-400" />
            </div>
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Skill Gaps</p>
          </div>
          {analytics ? (
            <p className="text-3xl font-black text-foreground font-['Sora',sans-serif]">{analytics.skill_gap_count}</p>
          ) : <SkeletonValue />}
          <p className="text-[10px] text-muted-foreground mt-1">demanded skills missing</p>
        </div>
      </div>

      {/* ── Invite Code + Recent Members (20/80 split) ─────────────── */}
      <div className="flex gap-4 items-stretch flex-col lg:flex-row">
        {/* Invite Code — 20% */}
        {org && (
          <div className="lg:w-[20%] flex-shrink-0 bg-card border border-border rounded-2xl p-5 shadow-sm flex flex-col items-center justify-center text-center gap-3">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Invite Code</p>
            <div className="flex items-center gap-2">
              <code className="px-4 py-2.5 rounded-xl bg-muted/50 border border-border text-base font-mono font-bold text-foreground tracking-[0.25em]">
                {org.invite_code}
              </code>
              <button
                onClick={copyCode}
                className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors border border-emerald-500/20 flex-shrink-0"
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
              </button>
            </div>
            <button
              onClick={() => navigate('/manager/settings')}
              className="text-[10px] font-bold text-muted-foreground hover:text-emerald-500 transition-colors flex items-center gap-1 mt-1"
            >
              Settings <ArrowRight size={10} />
            </button>
          </div>
        )}

        {/* Recent Members — 80% */}
        <div className="flex-1 bg-card border border-border rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-bold text-foreground font-['Sora',sans-serif] uppercase tracking-wider">Recent Members</h2>
            <button onClick={() => navigate('/manager/members')} className="text-[10px] font-bold text-emerald-500 hover:text-emerald-400 transition-colors flex items-center gap-1">
              View all <ArrowRight size={12} />
            </button>
          </div>
          {membersLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 text-emerald-500 animate-spin" />
            </div>
          ) : recentMembers.length > 0 ? (
            <div className="space-y-3">
              {recentMembers.map(m => (
                <div key={m.auth_user_id} className="flex items-center gap-3 py-2 px-3 rounded-xl hover:bg-muted/30 transition-colors">
                  <div className="w-9 h-9 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-emerald-500">
                      {(m.first_name?.[0] || m.email?.[0] || '?').toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {m.first_name && m.last_name ? `${m.first_name} ${m.last_name}` : m.email}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {m.skills.length} skill{m.skills.length !== 1 ? 's' : ''}
                      {m.joined_at && ` · Joined ${new Date(m.joined_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground/50 font-bold uppercase tracking-widest text-center py-8">
              No members yet — share your invite code
            </p>
          )}
        </div>
      </div>

      {/* ── Quick-link Cards ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <QuickCard
          icon={BarChart3}
          iconColor="text-indigo-400"
          iconBg="bg-indigo-500/10 border-indigo-500/20"
          title="Analytics"
          insight={analytics
            ? analytics.skill_gap_count > 0
              ? `${analytics.skill_gap_count} skill gap${analytics.skill_gap_count !== 1 ? 's' : ''} detected · ${analytics.market_readiness_pct}% market readiness`
              : `${analytics.market_readiness_pct}% market readiness · No skill gaps`
            : 'Loading...'
          }
          onClick={() => navigate('/manager/analytics')}
        />
        <QuickCard
          icon={Tags}
          iconColor="text-emerald-400"
          iconBg="bg-emerald-500/10 border-emerald-500/20"
          title="Skill Demand"
          insight={topDemandSkill
            ? `Top demanded: ${topDemandSkill} · ${totalJobs.toLocaleString()} jobs tracked`
            : 'Loading market data...'
          }
          onClick={() => navigate('/manager/skill-demand')}
        />
        <QuickCard
          icon={Users}
          iconColor="text-blue-400"
          iconBg="bg-blue-500/10 border-blue-500/20"
          title="Members"
          insight={!membersLoading
            ? `${totalMembers} member${totalMembers !== 1 ? 's' : ''} · ${members.filter(m => m.skills.length === 0).length} without skills`
            : 'Loading...'
          }
          onClick={() => navigate('/manager/members')}
        />
        <QuickCard
          icon={Settings}
          iconColor="text-gray-400"
          iconBg="bg-gray-500/10 border-gray-500/20"
          title="Settings"
          insight={org ? `${org.name} · Invite code active` : 'Manage organisation'}
          onClick={() => navigate('/manager/settings')}
        />
      </div>
    </div>
  )
}


/* ── Sub-components ─────────────────────────────────────────────────── */

function SkeletonValue() {
  return <div className="h-9 w-16 bg-muted rounded-lg animate-pulse" />
}

function ProgressRing({ pct }: { pct: number }) {
  const r = 16
  const stroke = 3
  const circumference = 2 * Math.PI * r
  const offset = circumference - (Math.min(pct, 100) / 100) * circumference
  const color = pct >= 70 ? '#10b981' : pct >= 40 ? '#f59e0b' : '#ef4444'
  return (
    <svg width={40} height={40} className="flex-shrink-0">
      <circle cx={20} cy={20} r={r} fill="none" stroke="hsl(var(--border))" strokeWidth={stroke} />
      <circle
        cx={20} cy={20} r={r} fill="none"
        stroke={color} strokeWidth={stroke}
        strokeDasharray={circumference} strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 20 20)"
        className="transition-all duration-700"
      />
    </svg>
  )
}

function QuickCard({ icon: Icon, iconColor, iconBg, title, insight, onClick }: {
  icon: any; iconColor: string; iconBg: string; title: string; insight: string; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="bg-card border border-border rounded-2xl p-5 shadow-sm text-left hover:border-emerald-500/30 hover:shadow-md transition-all group"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${iconBg}`}>
            <Icon size={16} className={iconColor} />
          </div>
          <p className="text-sm font-bold text-foreground">{title}</p>
        </div>
        <ArrowRight size={14} className="text-muted-foreground group-hover:text-emerald-500 transition-colors" />
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed capitalize">{insight}</p>
    </button>
  )
}
