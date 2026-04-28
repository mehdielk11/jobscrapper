import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'react-hot-toast'
import { PageHeader } from '../components/shared/PageHeader'
import { ConfirmModal } from '../components/shared/ConfirmModal'
import { Building2, Users, Trash2, Calendar } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface OrgRow {
  id: string
  name: string
  slug: string
  description: string
  manager_auth_id: string
  invite_code: string
  member_count: number
  created_at: string
  manager_name?: string
  manager_email?: string
}

export function OrganisationsPage() {
  const [orgs, setOrgs] = useState<OrgRow[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<OrgRow | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const fetchOrgs = useCallback(async () => {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'
      const resp = await fetch(`${API_BASE}/api/admin/orgs?token=${session.access_token}`)
      if (!resp.ok) throw new Error('Failed to load')
      const data = await resp.json()
      const rawOrgs = data.organisations || []

      // Enrich with manager profile
      if (rawOrgs.length > 0) {
        const managerIds = rawOrgs.map((o: any) => o.manager_auth_id)
        const { data: managerProfiles } = await supabase
          .from('users')
          .select('auth_user_id, first_name, last_name, email')
          .in('auth_user_id', managerIds)

        const profileMap: Record<string, { name: string; email: string }> = {}
        for (const p of (managerProfiles || [])) {
          profileMap[p.auth_user_id] = {
            name: `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || 'Unknown',
            email: p.email ?? '—',
          }
        }

        for (const org of rawOrgs) {
          org.manager_name = profileMap[org.manager_auth_id]?.name || 'Unknown'
          org.manager_email = profileMap[org.manager_auth_id]?.email || '—'
        }
      }

      setOrgs(rawOrgs)
    } catch (err: any) {
      toast.error(err.message || 'Failed to load organisations')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchOrgs() }, [fetchOrgs])

  const handleDelete = async () => {
    if (!deleteTarget) return
    setIsDeleting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('No session')

      const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'
      const resp = await fetch(`${API_BASE}/api/admin/orgs/${deleteTarget.id}?token=${session.access_token}`, {
        method: 'DELETE',
      })
      if (!resp.ok) {
        const err = await resp.json()
        throw new Error(err.detail || 'Delete failed')
      }
      toast.success('Organisation deleted')
      setDeleteTarget(null)
      fetchOrgs()
    } catch (err: any) {
      toast.error(err.message || 'Delete failed')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Organisations"
        description={`${orgs.length} organisation${orgs.length !== 1 ? 's' : ''} registered`}
      />

      <div className="space-y-4 mt-8">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : orgs.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-12 text-center">
            <Building2 size={32} className="mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-sm text-muted-foreground">No organisations created yet.</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Create an Academic Manager account and they'll set up their organisation on first login.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {orgs.map(org => (
              <div key={org.id} className="bg-card border border-border rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                      <Building2 size={20} className="text-emerald-500" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-foreground">{org.name}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">{org.description || 'No description'}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setDeleteTarget(org)}
                    className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-6 mt-6 pt-4 border-t border-border/50">
                  <div>
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Manager</p>
                    <p className="text-xs font-bold text-foreground">{org.manager_name}</p>
                    <p className="text-[10px] text-muted-foreground">{org.manager_email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users size={14} className="text-muted-foreground" />
                    <div>
                      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-0.5">Members</p>
                      <p className="text-sm font-bold text-foreground">{org.member_count}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar size={14} className="text-muted-foreground" />
                    <div>
                      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-0.5">Created</p>
                      <p className="text-xs text-foreground">
                        {formatDistanceToNow(new Date(org.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={!!deleteTarget}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        isLoading={isDeleting}
        title="Delete Organisation"
        message={`Delete "${deleteTarget?.name}"? Students will become unaffiliated but their accounts will remain intact.`}
        confirmLabel="Delete Organisation"
        variant="danger"
      />
    </div>
  )
}
