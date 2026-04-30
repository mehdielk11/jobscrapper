import { useCallback, useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'react-hot-toast'
import { PageHeader } from '../components/shared/PageHeader'
import { ConfirmModal } from '../components/shared/ConfirmModal'
import { Building2, Users, Trash2, Calendar, Search, ChevronLeft, ChevronRight } from 'lucide-react'
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

  const [search, setSearch] = useState('')
  const [filterState, setFilterState] = useState('all')
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 10

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

  // Reset page when search or filter changes
  useEffect(() => { setPage(0) }, [search, filterState])

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

  const filteredOrgs = useMemo(() => {
    return orgs.filter(o => {
      const s = search.toLowerCase()
      const matchesSearch = o.name.toLowerCase().includes(s) || 
        o.manager_name?.toLowerCase().includes(s) ||
        o.manager_email?.toLowerCase().includes(s)
      
      let matchesFilter = true
      if (filterState === 'with_members') matchesFilter = o.member_count > 0
      if (filterState === 'empty') matchesFilter = o.member_count === 0

      return matchesSearch && matchesFilter
    })
  }, [orgs, search, filterState])

  const totalPages = Math.ceil(filteredOrgs.length / PAGE_SIZE)
  const paginatedOrgs = filteredOrgs.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const getPageNumbers = (current: number, total: number) => {
    if (total <= 6) return Array.from({ length: total }, (_, i) => i + 1);
    if (current <= 3) return [1, 2, 3, 4, '...', total];
    if (current >= total - 2) return [1, '...', total - 3, total - 2, total - 1, total];
    return [1, '...', current - 1, current, current + 1, '...', total];
  };

  return (
    <div>
      <PageHeader
        title="Organisations"
        description={`${orgs.length} organisation${orgs.length !== 1 ? 's' : ''} registered`}
      />

      {/* Toolbar */}
      <div className="flex flex-wrap gap-4 mt-8 mb-6">
        <div className="relative flex-1 min-w-[280px]">
          <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search organisations by name, manager, email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-card border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-sm"
          />
        </div>
        <select
          value={filterState}
          onChange={e => setFilterState(e.target.value)}
          className="px-4 py-2.5 bg-card border border-border rounded-xl text-sm text-foreground font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-sm"
        >
          <option value="all">All organisations</option>
          <option value="with_members">With members</option>
          <option value="empty">Empty (no members)</option>
        </select>
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredOrgs.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-12 text-center">
            <Building2 size={32} className="mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-sm text-muted-foreground">
              {orgs.length === 0 ? "No organisations created yet." : "No organisations match your search/filter."}
            </p>
            {orgs.length === 0 && (
              <p className="text-xs text-muted-foreground/60 mt-1">Create an Academic Manager account and they'll set up their organisation on first login.</p>
            )}
          </div>
        ) : (
          <div className="grid gap-4">
            {paginatedOrgs.map(org => (
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 p-4 border border-border rounded-2xl bg-card shadow-sm">
          <p className="text-xs text-muted-foreground font-medium hidden sm:block">
            Showing <span className="font-mono">{filteredOrgs.length}</span> items
          </p>
          <div className="flex items-center justify-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => setPage(page - 1)}
              disabled={page === 0}
              className="flex items-center rounded-xl text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:hover:text-muted-foreground px-2 py-1.5 transition-all"
            >
              <ChevronLeft className="w-4 h-4 sm:mr-1" /> <span className="hidden sm:inline text-xs font-bold uppercase tracking-widest">Prev</span>
            </button>
            <div className="flex items-center gap-1 sm:gap-2">
              {getPageNumbers(page + 1, totalPages).map((p, i) => (
                p === '...' ? (
                  <span key={`ellipsis-${i}`} className="text-muted-foreground px-1 font-bold">...</span>
                ) : (
                  <button
                    key={`page-${p}`}
                    onClick={() => setPage((p as number) - 1)}
                    className={`w-8 h-8 rounded-xl font-black text-xs transition-all flex items-center justify-center ${
                      page + 1 === p
                        ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/20 scale-105'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                  >
                    {p}
                  </button>
                )
              ))}
            </div>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page >= totalPages - 1}
              className="flex items-center rounded-xl text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:hover:text-muted-foreground px-2 py-1.5 transition-all"
            >
              <span className="hidden sm:inline text-xs font-bold uppercase tracking-widest">Next</span> <ChevronRight className="w-4 h-4 sm:ml-1" />
            </button>
          </div>
        </div>
      )}

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
