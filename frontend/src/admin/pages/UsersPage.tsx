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
        <div className="w-7 h-7 rounded-full bg-indigo-500/20 flex items-center justify-center text-xs font-bold text-indigo-300">
          {row.original.name[0]?.toUpperCase() ?? '?'}
        </div>
      ),
    },
    { accessorKey: 'name', header: 'Name', cell: ({ getValue }) => <span className="text-white font-medium">{getValue() as string}</span> },
    { accessorKey: 'email', header: 'Email', cell: ({ getValue }) => <span className="text-zinc-400">{getValue() as string}</span> },
    {
      accessorKey: 'role',
      header: 'Role',
      cell: ({ getValue }) => {
        const r = getValue() as string
        return (
          <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-bold ${
            r === 'admin' ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/20' : 'bg-zinc-800 text-zinc-500'
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
          <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-zinc-400 font-mono">{row.original.skills_count}</span>
        ) : (
          <span className="text-xs text-zinc-700">—</span>
        )
      ),
    },
    {
      accessorKey: 'joined',
      header: 'Joined',
      cell: ({ getValue }) => (
        <span className="text-xs text-zinc-500">
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
            className="p-1.5 rounded text-zinc-500 hover:text-zinc-200 hover:bg-white/5 transition-colors"
          >
            <Eye size={13} />
          </button>
          <button
            onClick={() => setDeleteTarget(row.original)}
            className="p-1.5 rounded text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <Trash2 size={13} />
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
      <div className="flex gap-1 mb-6 p-1 bg-white/5 rounded-xl w-fit">
        <button
          onClick={() => { setViewType('students'); setPage(0); }}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
            viewType === 'students' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <GraduationCap size={14} />
          Students
        </button>
        <button
          onClick={() => { setViewType('admins'); setPage(0); }}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
            viewType === 'admins' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <ShieldCheck size={14} />
          Administrators
        </button>
        <button
          onClick={() => { setViewType('all'); setPage(0); }}
          className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
            viewType === 'all' ? 'bg-indigo-500 text-white' : 'text-zinc-500 hover:text-zinc-300'
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
            <div className="space-y-3">
              <div>
                <p className="text-xs text-zinc-500 mb-1">Email Address</p>
                <p className="text-sm text-zinc-300">{selected.email}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500 mb-1">Assigned Role</p>
                <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${
                  selected.role === 'admin' ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20' : 'bg-zinc-800 text-zinc-400 border-transparent'
                }`}>
                  {selected.role}
                </span>
              </div>
              <div>
                <p className="text-xs text-zinc-500 mb-1">Registration Date</p>
                <p className="text-sm text-zinc-300">
                  {formatDistanceToNow(new Date(selected.joined), { addSuffix: true })}
                </p>
              </div>
            </div>

            {selected.role === 'student' && (
              <div>
                <p className="text-xs text-zinc-500 mb-2">Academic Skills ({userSkills.length})</p>
                <div className="flex flex-wrap gap-1.5">
                  {userSkills.length === 0 ? (
                    <p className="text-xs text-zinc-600 italic">No skills added to profile yet.</p>
                  ) : (
                    userSkills.map(skill => (
                      <span key={skill} className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/10">
                        {skill}
                      </span>
                    ))
                  )}
                </div>
              </div>
            )}

            <div className="space-y-2 pt-3 border-t border-white/5">
              {selected.role !== 'admin' && (
                <button
                  onClick={() => promoteToAdmin(selected)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-500/10 text-indigo-300 text-sm font-medium hover:bg-indigo-500/20 transition-all"
                >
                  <ShieldCheck size={14} />
                  Promote to Administrator
                </button>
              )}
              <button
                onClick={() => setDeleteTarget(selected)}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-500/10 text-red-400 text-sm font-medium hover:bg-red-500/20 transition-all"
              >
                <UserX size={14} />
                Permanently Delete Account
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
