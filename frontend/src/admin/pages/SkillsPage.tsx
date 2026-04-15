import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus, Search, Trash2, Edit2, Check, X } from 'lucide-react'
import { toast } from 'react-hot-toast'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { PageHeader } from '../components/shared/PageHeader'

interface Skill {
  id: string
  name: string
  category: string
}

interface TopSkill {
  name: string
  count: number
}

const CATEGORIES = ['Technical', 'Soft Skills', 'Domain', 'Tools']
const CAT_COLORS: Record<string, string> = {
  Technical: 'bg-indigo-500/20 text-indigo-300',
  'Soft Skills': 'bg-emerald-500/20 text-emerald-300',
  Domain: 'bg-amber-500/20 text-amber-300',
  Tools: 'bg-cyan-500/20 text-cyan-300',
}

/**
 * SkillsPage — manage master skills taxonomy and view demand analytics.
 */
export function SkillsPage() {
  const [skills, setSkills] = useState<Skill[]>([])
  const [search, setSearch] = useState('')
  const [newSkillName, setNewSkillName] = useState('')
  const [newSkillCat, setNewSkillCat] = useState('Technical')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [topSkills, setTopSkills] = useState<TopSkill[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchSkills = async () => {
      const { data } = await supabase
        .from('skills_taxonomy')
        .select('id, name, category')
        .order('category')
      setSkills(data ?? [])
      setLoading(false)
    }

    const fetchTopSkills = async () => {
      const { data } = await supabase
        .from('job_skills')
        .select('skill')
        .limit(2000)
      const counts: Record<string, number> = {}
      for (const s of (data ?? [])) {
        counts[s.skill] = (counts[s.skill] ?? 0) + 1
      }
      setTopSkills(
        Object.entries(counts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 20)
          .map(([name, count]) => ({ name, count }))
      )
    }

    fetchSkills()
    fetchTopSkills()
  }, [])

  const filtered = useMemo(() => {
    return skills.filter(s => s.name.toLowerCase().includes(search.toLowerCase()))
  }, [search, skills])

  const addSkill = async () => {
    if (!newSkillName.trim()) return
    const { data, error } = await supabase
      .from('skills_taxonomy')
      .insert({ name: newSkillName.trim().toLowerCase(), category: newSkillCat })
      .select()
      .single()
    if (error) {
      toast.error('Failed to add skill')
    } else {
      setSkills(prev => [...prev, data])
      setNewSkillName('')
      toast.success('Skill added')
    }
  }

  const deleteSkill = async (id: string) => {
    const { error } = await supabase.from('skills_taxonomy').delete().eq('id', id)
    if (error) {
      toast.error('Delete failed')
    } else {
      setSkills(prev => prev.filter(s => s.id !== id))
      toast.success('Skill removed')
    }
  }

  const saveEdit = async (id: string) => {
    const { error } = await supabase
      .from('skills_taxonomy')
      .update({ name: editName.trim().toLowerCase() })
      .eq('id', id)
    if (error) {
      toast.error('Update failed')
    } else {
      setSkills(prev => prev.map(s => s.id === id ? { ...s, name: editName.trim().toLowerCase() } : s))
      setEditingId(null)
      toast.success('Skill updated')
    }
  }

  const byCategory = CATEGORIES.reduce<Record<string, Skill[]>>((acc, cat) => {
    acc[cat] = filtered.filter(s => s.category === cat)
    return acc
  }, {})

  return (
    <div>
      <PageHeader
        title="Skills Taxonomy"
        description="Manage the master skills list powering NLP extraction"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Skills list */}
        <div className="bg-[#1a1a1f] border border-white/5 rounded-2xl overflow-hidden">
          {/* Add new */}
          <div className="p-4 border-b border-white/5 space-y-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
                <input
                  type="text"
                  placeholder="Search skills..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-[#0f0f11] border border-white/5 rounded-lg text-sm text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50"
                />
              </div>
              <select
                value={newSkillCat}
                onChange={e => setNewSkillCat(e.target.value)}
                className="px-2 py-1.5 bg-[#0f0f11] border border-white/5 rounded-lg text-xs text-zinc-400 focus:outline-none"
              >
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="New skill name..."
                value={newSkillName}
                onChange={e => setNewSkillName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addSkill()}
                className="flex-1 px-3 py-1.5 bg-[#0f0f11] border border-white/5 rounded-lg text-sm text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50"
              />
              <button
                onClick={addSkill}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/20 text-indigo-300 text-xs hover:bg-indigo-500/30 transition-colors"
              >
                <Plus size={13} />
                Add
              </button>
            </div>
          </div>

          {/* Skills by category */}
          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="p-4 space-y-2">
                {[1,2,3,4,5].map(i => <div key={i} className="h-8 bg-white/5 rounded-lg animate-pulse" />)}
              </div>
            ) : (
              CATEGORIES.map(cat => (
                byCategory[cat].length > 0 && (
                  <div key={cat}>
                    <div className={`sticky top-0 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-widest ${CAT_COLORS[cat]} bg-[#1a1a1f]`}>
                      {cat} ({byCategory[cat].length})
                    </div>
                    {byCategory[cat].map(skill => (
                      <div key={skill.id} className="flex items-center gap-2 px-4 py-2 hover:bg-white/[0.03] group border-b border-white/[0.03]">
                        {editingId === skill.id ? (
                          <>
                            <input
                              value={editName}
                              onChange={e => setEditName(e.target.value)}
                              className="flex-1 text-sm bg-[#0f0f11] border border-indigo-500/30 rounded px-2 py-0.5 text-zinc-200 focus:outline-none"
                              autoFocus
                            />
                            <button onClick={() => saveEdit(skill.id)} className="text-emerald-400 hover:text-emerald-300"><Check size={13} /></button>
                            <button onClick={() => setEditingId(null)} className="text-zinc-500 hover:text-zinc-300"><X size={13} /></button>
                          </>
                        ) : (
                          <>
                            <span className="flex-1 text-sm text-zinc-300 font-mono">{skill.name}</span>
                            <button
                              onClick={() => { setEditingId(skill.id); setEditName(skill.name) }}
                              className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-zinc-300 transition-opacity"
                            >
                              <Edit2 size={12} />
                            </button>
                            <button
                              onClick={() => deleteSkill(skill.id)}
                              className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 transition-opacity"
                            >
                              <Trash2 size={12} />
                            </button>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )
              ))
            )}
          </div>
        </div>

        {/* Most demanded skills chart */}
        <div className="bg-[#1a1a1f] border border-white/5 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-zinc-300 mb-4 font-['Sora',sans-serif]">
            Top 20 Most Demanded Skills
          </h3>
          {topSkills.length > 0 ? (
            <ResponsiveContainer width="100%" height={380}>
              <BarChart data={topSkills} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: '#52525b' }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#a1a1aa' }} width={100} />
                <Tooltip
                  contentStyle={{ background: '#1a1a1f', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }}
                />
                <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-sm text-zinc-600">
              No job skills data yet
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
