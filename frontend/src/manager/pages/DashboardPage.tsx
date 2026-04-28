import { useEffect, useState } from 'react'
import { Users, BarChart3, Award, Copy, Check } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { useManagerOrg } from '../hooks/useManagerOrg'
import { useOrgMembers } from '../hooks/useOrgMembers'

export function DashboardPage() {
  const { org } = useManagerOrg()
  const { members, loading } = useOrgMembers()
  const [copied, setCopied] = useState(false)

  const totalMembers = members.length
  const avgSkills = totalMembers > 0
    ? (members.reduce((sum, m) => sum + m.skills.length, 0) / totalMembers).toFixed(1)
    : '0'

  // Top skills across all members
  const skillCounts: Record<string, number> = {}
  for (const m of members) {
    for (const s of m.skills) {
      skillCounts[s] = (skillCounts[s] ?? 0) + 1
    }
  }
  const topSkills = Object.entries(skillCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)

  const copyInviteCode = () => {
    if (!org?.invite_code) return
    navigator.clipboard.writeText(org.invite_code)
    setCopied(true)
    toast.success('Invite code copied!')
    setTimeout(() => setCopied(false), 2000)
  }

  const stats = [
    { title: 'Total Members', value: totalMembers.toString(), icon: Users, color: 'text-emerald-400' },
    { title: 'Avg Skills / Student', value: avgSkills, icon: BarChart3, color: 'text-blue-400' },
    { title: 'Unique Skills', value: Object.keys(skillCounts).length.toString(), icon: Award, color: 'text-amber-400' },
  ]

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-foreground font-['Sora',sans-serif]">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Overview of your organisation's members and skills</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {stats.map((stat) => (
          <div key={stat.title} className="bg-card border border-border rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className={`p-2 rounded-xl bg-muted/50 ${stat.color}`}>
                <stat.icon size={18} />
              </div>
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{stat.title}</p>
            </div>
            <p className="text-2xl font-bold text-foreground font-['Sora',sans-serif]">
              {loading ? '—' : stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Invite Code Card */}
      {org && (
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
          <h2 className="text-sm font-bold text-foreground mb-4 font-['Sora',sans-serif] uppercase tracking-wider">Invite Code</h2>
          <p className="text-xs text-muted-foreground mb-4">Share this code with students so they can join your organisation.</p>
          <div className="flex items-center gap-3">
            <code className="flex-1 px-4 py-3 rounded-xl bg-muted/50 border border-border text-lg font-mono font-bold text-foreground tracking-[0.3em] text-center">
              {org.invite_code}
            </code>
            <button
              onClick={copyInviteCode}
              className="p-3 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors border border-emerald-500/20"
            >
              {copied ? <Check size={18} /> : <Copy size={18} />}
            </button>
          </div>
        </div>
      )}

      {/* Top Skills */}
      {topSkills.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
          <h2 className="text-sm font-bold text-foreground mb-6 font-['Sora',sans-serif] uppercase tracking-wider">Top Skills in Organisation</h2>
          <div className="space-y-3">
            {topSkills.map(([skill, count]) => {
              const maxCount = topSkills[0][1] as number
              const pct = (count / maxCount) * 100
              return (
                <div key={skill} className="flex items-center gap-4">
                  <span className="text-xs font-medium text-foreground w-32 truncate capitalize">{skill}</span>
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground font-mono w-8 text-right">{count}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
