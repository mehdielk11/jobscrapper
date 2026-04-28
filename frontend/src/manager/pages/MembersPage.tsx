import { useState } from 'react'
import { useOrgMembers, OrgMember } from '../hooks/useOrgMembers'
import { UserPlus, Trash2, Eye, X, Search } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'react-hot-toast'

export function MembersPage() {
  const { members, loading, addMember, removeMember } = useOrgMembers()
  const [showAddModal, setShowAddModal] = useState(false)
  const [addEmail, setAddEmail] = useState('')
  const [adding, setAdding] = useState(false)
  const [selected, setSelected] = useState<OrgMember | null>(null)
  const [removeTarget, setRemoveTarget] = useState<OrgMember | null>(null)
  const [removing, setRemoving] = useState(false)
  const [search, setSearch] = useState('')

  const filtered = members.filter(m => {
    const q = search.toLowerCase()
    return (
      m.first_name.toLowerCase().includes(q) ||
      m.last_name.toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q)
    )
  })

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!addEmail.trim()) return
    setAdding(true)
    try {
      await addMember(addEmail.trim())
      toast.success('Member added successfully')
      setAddEmail('')
      setShowAddModal(false)
    } catch (err: any) {
      toast.error(err.message || 'Failed to add member')
    } finally {
      setAdding(false)
    }
  }

  const handleRemove = async () => {
    if (!removeTarget) return
    setRemoving(true)
    try {
      await removeMember(removeTarget.auth_user_id)
      toast.success('Member removed')
      setRemoveTarget(null)
      setSelected(null)
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove member')
    } finally {
      setRemoving(false)
    }
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground font-['Sora',sans-serif]">Members</h1>
          <p className="text-sm text-muted-foreground mt-1">{members.length} student{members.length !== 1 ? 's' : ''} in your organisation</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest transition-all shadow-sm"
        >
          <UserPlus size={14} />
          Add Member
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or email..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 transition-all"
        />
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 text-center">
            <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            {search ? 'No members match your search.' : 'No members yet. Add students using their email or share your invite code.'}
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-[10px] font-black text-muted-foreground uppercase tracking-widest px-6 py-3">Student</th>
                <th className="text-left text-[10px] font-black text-muted-foreground uppercase tracking-widest px-6 py-3">Email</th>
                <th className="text-left text-[10px] font-black text-muted-foreground uppercase tracking-widest px-6 py-3">Skills</th>
                <th className="text-left text-[10px] font-black text-muted-foreground uppercase tracking-widest px-6 py-3">Joined</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map(m => (
                <tr
                  key={m.id}
                  className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => setSelected(m)}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-[10px] font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        {m.first_name?.[0]?.toUpperCase() || '?'}
                      </div>
                      <span className="text-sm font-bold text-foreground">{m.first_name} {m.last_name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">{m.email}</td>
                  <td className="px-6 py-4">
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-muted/50 text-muted-foreground border border-border/50 font-mono">
                      {m.skills.length}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs text-muted-foreground">
                    {m.joined_at ? formatDistanceToNow(new Date(m.joined_at), { addSuffix: true }) : '—'}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                      <button onClick={() => setSelected(m)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all">
                        <Eye size={14} />
                      </button>
                      <button onClick={() => setRemoveTarget(m)} className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Slide-over detail panel */}
      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSelected(null)} />
          <div className="relative w-full max-w-md bg-card border-l border-border shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-sm font-bold text-foreground">{selected.first_name} {selected.last_name}</h2>
              <button onClick={() => setSelected(null)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                <X size={16} className="text-muted-foreground" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div>
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Email</p>
                <p className="text-sm text-foreground">{selected.email}</p>
              </div>
              <div>
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Joined</p>
                <p className="text-sm text-foreground">
                  {selected.joined_at ? formatDistanceToNow(new Date(selected.joined_at), { addSuffix: true }) : '—'}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2.5">Skills ({selected.skills.length})</p>
                <div className="flex flex-wrap gap-2">
                  {selected.skills.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">No skills added yet.</p>
                  ) : (
                    selected.skills.map(skill => (
                      <span key={skill} className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 border border-emerald-500/10 tracking-tight">
                        {skill}
                      </span>
                    ))
                  )}
                </div>
              </div>
              <div className="pt-4 border-t border-border">
                <button
                  onClick={() => setRemoveTarget(selected)}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-destructive/10 text-destructive text-sm font-bold uppercase tracking-widest hover:bg-destructive hover:text-destructive-foreground transition-all"
                >
                  <Trash2 size={16} />
                  Remove from Organisation
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add member modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowAddModal(false)} />
          <div className="relative bg-card border border-border rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4 animate-in fade-in-0 zoom-in-95 duration-150">
            <h2 className="text-sm font-bold text-foreground mb-1">Add Member</h2>
            <p className="text-xs text-muted-foreground mb-6">Enter the student's email address to add them to your organisation.</p>
            <form onSubmit={handleAdd} className="space-y-4">
              <input
                type="email"
                value={addEmail}
                onChange={e => setAddEmail(e.target.value)}
                placeholder="student@email.com"
                className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 transition-all"
                required
                autoFocus
              />
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-muted text-foreground text-sm font-bold hover:bg-muted/80 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adding || !addEmail.trim()}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-500 transition-all disabled:opacity-50"
                >
                  {adding ? 'Adding...' : 'Add Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Remove confirmation modal */}
      {removeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setRemoveTarget(null)} />
          <div className="relative bg-card border border-border rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4 animate-in fade-in-0 zoom-in-95 duration-150">
            <h2 className="text-sm font-bold text-foreground mb-2">Remove Member</h2>
            <p className="text-xs text-muted-foreground mb-6">
              Remove <strong>{removeTarget.first_name} {removeTarget.last_name}</strong> from your organisation? They will become unaffiliated.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setRemoveTarget(null)}
                className="flex-1 py-2.5 rounded-xl bg-muted text-foreground text-sm font-bold hover:bg-muted/80 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleRemove}
                disabled={removing}
                className="flex-1 py-2.5 rounded-xl bg-destructive text-destructive-foreground text-sm font-bold hover:bg-destructive/90 transition-all disabled:opacity-50"
              >
                {removing ? 'Removing...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
