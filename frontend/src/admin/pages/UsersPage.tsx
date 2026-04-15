import { useCallback, useEffect, useState } from 'react'
import { ColumnDef } from '@tanstack/react-table'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/auth-context'
import { Eye, Trash2, UserX, ShieldCheck, GraduationCap } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'react-hot-toast'
import { PageHeader } from '../components/shared/PageHeader'
import { DataTable } from '../components/shared/DataTable'
import { SlideOverPanel } from '../components/shared/SlideOverPanel'
import { ConfirmModal } from '../components/shared/ConfirmModal'

interface UserAccount {
  id: string
  auth_user_id: string
  name: string
  email: string
  skills_count: number
  joined: string
  role: 'student' | 'admin'
}

type ViewType = 'all' | 'students' | 'admins'

/**
 * UsersPage — managed version of the former StudentsPage.
 * Now handles all system users with clear role separation via filtering.
 */
export function UsersPage() {
  const [users, setUsers] = useState<UserAccount[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<UserAccount | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<UserAccount | null>(null)
  const [userSkills, setUserSkills] = useState<string[]>([])
  const [isDeleting, setIsDeleting] = useState(false)
  const [viewType, setViewType] = useState<ViewType>('students') // Default to students as requested for separation
  const { user: currentUser, signOut: localSignOut } = useAuth()

  const PAGE_SIZE = 25

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      // 1. Fetch from the renamed 'users' table
      let query = supabase
        .from('users')
        .select('id, auth_user_id, first_name, last_name, email, created_at', { count: 'exact' })
        .order('created_at', { ascending: false })

      // Note: We'll filter the results locally based on role joins to ensure total counts match the view
      // In a high-scale app, we'd use a DB view or RPC for this filtration
      const { data, count, error } = await query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

      if (error) throw error

      // 2. Get roles for these users
      const authIds = (data ?? []).map((u: any) => u.auth_user_id)
      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', authIds)
      
      const rolesMap: Record<string, string> = {}
      for (const r of (rolesData ?? [])) {
        rolesMap[r.user_id] = r.role
      }

      // 3. Get skills counts from 'user_skills'
      const internalIds = (data ?? []).map((u: any) => u.id)
      const { data: skillsData } = await supabase
        .from('user_skills')
        .select('user_id')
        .in('user_id', internalIds)
      
      const skillsCnt: Record<string, number> = {}
      for (const s of (skillsData ?? [])) {
        skillsCnt[s.user_id] = (skillsCnt[s.user_id] ?? 0) + 1
      }

      // 4. Map and filter by viewType
      const allMapped: UserAccount[] = (data ?? []).map((u: any) => ({
        id: u.id,
        auth_user_id: u.auth_user_id,
        name: `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim() || 'Unknown',
        email: u.email ?? '—',
        skills_count: skillsCnt[u.id] ?? 0,
        joined: u.created_at,
        role: (rolesMap[u.auth_user_id] as 'student' | 'admin') ?? 'student',
      }))

      const filtered = allMapped.filter(u => {
        if (viewType === 'students') return u.role === 'student'
        if (viewType === 'admins') return u.role === 'admin'
        return true
      })

      setUsers(filtered)
      setTotal(viewType === 'all' ? (count ?? 0) : filtered.length) // Simplification for MVP
    } catch (err: any) {
      toast.error('Failed to load users')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [page, viewType])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  const openPanel = async (account: UserAccount) => {
    setSelected(account)
    const { data } = await supabase
      .from('user_skills')
      .select('skill')
      .eq('user_id', account.id)
    setUserSkills((data ?? []).map((s: { skill: string }) => s.skill))
  }

  const promoteToAdmin = async (account: UserAccount) => {
    const { error } = await supabase
      .from('user_roles')
      .upsert({ user_id: account.auth_user_id, role: 'admin' }, { onConflict: 'user_id' })
    
    if (error) {
      toast.error('Promotion failed')
    } else {
      toast.success(`${account.name} promoted to admin`)
      setSelected(null)
      fetchUsers()
    }
  }

  const handleDelete = async (account: UserAccount) => {
    setIsDeleting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('No active session')

      // API is updated to handle 'users' internally via the same target_id logic
      const resp = await fetch(`http://localhost:8000/api/admin/users/${account.auth_user_id}?token=${session.access_token}`, {
        method: 'DELETE'
      })

      if (!resp.ok) {
        const err = await resp.json()
        throw new Error(err.detail || 'Delete failed')
      }

      toast.success('Account and associated data deleted')
      
      if (account.auth_user_id === currentUser?.id) {
        await localSignOut()
        return
      }

      setDeleteTarget(null)
      setSelected(null)
      fetchUsers()
    } catch (err: any) {
      toast.error(err.message || 'Delete failed')
    } finally {
      setIsDeleting(false)
    }
  }

  const columns: ColumnDef<UserAccount, unknown>[] = [
    {
      id: 'avatar',
      header: '',
      cell: ({ row }) => (
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary border border-primary/20 shadow-sm">
          {row.original.name[0]?.toUpperCase() ?? '?'}
        </div>
      ),
    },
    { accessorKey: 'name', header: 'Name', cell: ({ getValue }) => <span className="text-foreground font-bold tracking-tight">{getValue() as string}</span> },
    { accessorKey: 'email', header: 'Email', cell: ({ getValue }) => <span className="text-muted-foreground font-medium">{getValue() as string}</span> },
    {
      accessorKey: 'role',
      header: 'Role',
      cell: ({ getValue }) => {
        const r = getValue() as string
        return (
          <span className={`text-[9px] uppercase tracking-widest px-2.5 py-1 rounded-full font-black shadow-sm ${
            r === 'admin' ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-muted text-muted-foreground border border-border'
          }`}>
            {r}
          </span>
        )
      },
    },
    {
      accessorKey: 'skills_count',
      header: 'Skills',
      cell: ({ row }) => (
        row.original.role === 'student' ? (
          <span className="text-[10px] px-2.5 py-1 rounded-lg bg-muted/50 text-muted-foreground font-bold font-mono border border-border/50">
            {row.original.skills_count}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground/30">—</span>
        )
      ),
    },
    {
      accessorKey: 'joined',
      header: 'Joined',
      cell: ({ getValue }) => (
        <span className="text-xs text-muted-foreground font-medium">
          {formatDistanceToNow(new Date(getValue() as string), { addSuffix: true })}
        </span>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => openPanel(row.original)}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
          >
            <Eye size={14} />
          </button>
          <button
            onClick={() => setDeleteTarget(row.original)}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="User Management"
        description={`${total.toLocaleString()} ${viewType === 'all' ? 'total users' : viewType} registered`}
      />

      {/* Role Tabs for Separation */}
      <div className="flex gap-1 mb-8 p-1 bg-muted/30 border border-border/50 rounded-2xl w-fit shadow-inner">
        <button
          onClick={() => { setViewType('students'); setPage(0); }}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
            viewType === 'students' ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-105' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <GraduationCap size={15} />
          Students
        </button>
        <button
          onClick={() => { setViewType('admins'); setPage(0); }}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
            viewType === 'admins' ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-105' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <ShieldCheck size={15} />
          Admins
        </button>
        <button
          onClick={() => { setViewType('all'); setPage(0); }}
          className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
            viewType === 'all' ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-105' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          All Accounts
        </button>
      </div>

      <DataTable
        columns={columns}
        data={users}
        loading={loading}
        onRowClick={openPanel}
        emptyMessage={`No ${viewType === 'all' ? 'users' : viewType} found.`}
        pageSize={PAGE_SIZE}
        totalCount={total}
        page={page}
        onPageChange={setPage}
      />

      {/* User detail panel */}
      <SlideOverPanel
        isOpen={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.name ?? 'Account Detail'}
        width="md"
      >
        {selected && (
          <div className="space-y-5">
            <div className="space-y-4">
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Email Address</p>
                <p className="text-sm text-foreground font-medium">{selected.email}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Assigned Role</p>
                <span className={`text-[10px] uppercase font-black tracking-widest px-3 py-1 rounded-full border shadow-sm ${
                  selected.role === 'admin' ? 'bg-primary/10 text-primary border-primary/20' : 'bg-muted text-muted-foreground border-border'
                }`}>
                  {selected.role}
                </span>
              </div>
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Registration Date</p>
                <p className="text-sm text-foreground">
                  {formatDistanceToNow(new Date(selected.joined), { addSuffix: true })}
                </p>
              </div>
            </div>

            {selected.role === 'student' && (
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2.5">Academic Skills ({userSkills.length})</p>
                <div className="flex flex-wrap gap-2">
                  {userSkills.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">No skills added to profile yet.</p>
                  ) : (
                    userSkills.map(skill => (
                      <span key={skill} className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-primary/5 text-primary border border-primary/10 tracking-tight">
                        {skill}
                      </span>
                    ))
                  )}
                </div>
              </div>
            )}

            <div className="space-y-3 pt-4 border-t border-border mt-auto">
              {selected.role !== 'admin' && (
                <button
                  onClick={() => promoteToAdmin(selected)}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary/10 text-primary text-sm font-bold uppercase tracking-widest hover:bg-primary hover:text-primary-foreground transition-all shadow-sm"
                >
                  <ShieldCheck size={16} />
                  Promote to Admin
                </button>
              )}
              <button
                onClick={() => setDeleteTarget(selected)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-destructive/10 text-destructive text-sm font-bold uppercase tracking-widest hover:bg-destructive hover:text-destructive-foreground transition-all shadow-sm"
              >
                <UserX size={16} />
                Delete Account
              </button>
            </div>
          </div>
        )}
      </SlideOverPanel>

      <ConfirmModal
        isOpen={!!deleteTarget}
        onConfirm={() => deleteTarget && handleDelete(deleteTarget)}
        onCancel={() => setDeleteTarget(null)}
        isLoading={isDeleting}
        title={`Delete ${deleteTarget?.role === 'admin' ? 'Administrator' : 'User'}`}
        message={`Warning: deleting "${deleteTarget?.name}" is permanent and will remove all associated profile data.`}
        confirmLabel="Confirm Deletion"
        variant="danger"
      />
    </div>
  )
}
