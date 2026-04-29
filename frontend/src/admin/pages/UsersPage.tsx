import { useCallback, useEffect, useState } from 'react'
import { ColumnDef } from '@tanstack/react-table'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/auth-context'
import { Eye, Trash2, UserX, ShieldCheck, GraduationCap, UserPlus, Building2, KeyRound } from 'lucide-react'
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
  role: 'student' | 'admin' | 'academic_manager'
}

type ViewType = 'all' | 'students' | 'managers' | 'admins'

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
  const [viewType, setViewType] = useState<ViewType>('students')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createForm, setCreateForm] = useState({ email: '', password: '', first_name: '', last_name: '', role: 'student' as 'student' | 'academic_manager' })
  const [creating, setCreating] = useState(false)
  const [passwordTarget, setPasswordTarget] = useState<UserAccount | null>(null)
  const [resetPassword, setResetPassword] = useState('')
  const [confirmResetPassword, setConfirmResetPassword] = useState('')
  const [resettingPassword, setResettingPassword] = useState(false)
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
        role: (rolesMap[u.auth_user_id] as 'student' | 'admin' | 'academic_manager') ?? 'student',
      }))

      const filtered = allMapped.filter(u => {
        if (viewType === 'students') return u.role === 'student'
        if (viewType === 'admins') return u.role === 'admin'
        if (viewType === 'managers') return u.role === 'academic_manager'
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
      const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const resp = await fetch(`${API_BASE}/api/admin/users/${account.auth_user_id}?token=${session.access_token}`, {
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

  const handleResetPassword = async () => {
    if (!passwordTarget) return
    if (resetPassword.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }
    if (resetPassword !== confirmResetPassword) {
      toast.error('Passwords do not match')
      return
    }
    setResettingPassword(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('No active session')
      const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'
      const resp = await fetch(`${API_BASE}/api/admin/users/${passwordTarget.auth_user_id}/password?token=${session.access_token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_password: resetPassword }),
      })
      if (!resp.ok) {
        const err = await resp.json()
        throw new Error(err.detail || 'Password reset failed')
      }
      toast.success(`Password reset for ${passwordTarget.name}. User has been signed out.`)
      setPasswordTarget(null)
      setResetPassword('')
      setConfirmResetPassword('')
    } catch (err: any) {
      toast.error(err.message || 'Failed to reset password')
    } finally {
      setResettingPassword(false)
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
        const label = r === 'academic_manager' ? 'manager' : r
        return (
          <span className={`text-[9px] uppercase tracking-widest px-2.5 py-1 rounded-full font-black shadow-sm ${
            r === 'admin' ? 'bg-primary/10 text-primary border border-primary/20'
            : r === 'academic_manager' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
            : 'bg-muted text-muted-foreground border border-border'
          }`}>
            {label}
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
            title="View details"
          >
            <Eye size={14} />
          </button>
          <button
            onClick={() => { setPasswordTarget(row.original); setResetPassword(''); setConfirmResetPassword(''); }}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-amber-500 hover:bg-amber-500/10 transition-all"
            title="Reset password"
          >
            <KeyRound size={14} />
          </button>
          <button
            onClick={() => setDeleteTarget(row.original)}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
            title="Delete user"
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
        action={
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-[10px] font-black uppercase tracking-widest transition-all shadow-sm"
          >
            <UserPlus size={14} />
            Create User
          </button>
        }
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
          onClick={() => { setViewType('managers'); setPage(0); }}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
            viewType === 'managers' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 scale-105' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Building2 size={15} />
          Managers
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

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowCreateModal(false)} />
          <div className="relative bg-card border border-border rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4 animate-in fade-in-0 zoom-in-95 duration-150">
            <h2 className="text-sm font-bold text-foreground mb-1">Create New User</h2>
            <p className="text-xs text-muted-foreground mb-6">Create a student or academic manager account.</p>
            <form onSubmit={async (e) => {
              e.preventDefault()
              setCreating(true)
              try {
                const { data: { session } } = await supabase.auth.getSession()
                if (!session) throw new Error('No session')
                const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'
                const resp = await fetch(`${API_BASE}/api/admin/users/create?token=${session.access_token}`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(createForm),
                })
                if (!resp.ok) {
                  const err = await resp.json()
                  throw new Error(err.detail || 'Creation failed')
                }
                toast.success(`${createForm.role === 'academic_manager' ? 'Academic Manager' : 'Student'} created successfully`)
                setShowCreateModal(false)
                setCreateForm({ email: '', password: '', first_name: '', last_name: '', role: 'student' })
                fetchUsers()
              } catch (err: any) {
                toast.error(err.message || 'Failed to create user')
              } finally {
                setCreating(false)
              }
            }} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1 block">First Name</label>
                  <input type="text" value={createForm.first_name} onChange={e => setCreateForm(f => ({...f, first_name: e.target.value}))} required className="w-full px-3 py-2.5 rounded-xl bg-muted/50 border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1 block">Last Name</label>
                  <input type="text" value={createForm.last_name} onChange={e => setCreateForm(f => ({...f, last_name: e.target.value}))} required className="w-full px-3 py-2.5 rounded-xl bg-muted/50 border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all" />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1 block">Email</label>
                <input type="email" value={createForm.email} onChange={e => setCreateForm(f => ({...f, email: e.target.value}))} required className="w-full px-3 py-2.5 rounded-xl bg-muted/50 border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all" />
              </div>
              <div>
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1 block">Password</label>
                <input type="password" value={createForm.password} onChange={e => setCreateForm(f => ({...f, password: e.target.value}))} required minLength={6} className="w-full px-3 py-2.5 rounded-xl bg-muted/50 border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all" />
              </div>
              <div>
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1 block">Role</label>
                <select value={createForm.role} onChange={e => setCreateForm(f => ({...f, role: e.target.value as any}))} className="w-full px-3 py-2.5 rounded-xl bg-muted/50 border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all">
                  <option value="student">Student</option>
                  <option value="academic_manager">Academic Manager</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreateModal(false)} className="flex-1 py-2.5 rounded-xl bg-muted text-foreground text-sm font-bold hover:bg-muted/80 transition-all">Cancel</button>
                <button type="submit" disabled={creating} className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-all disabled:opacity-50">
                  {creating ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Password Reset Modal */}
      {passwordTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setPasswordTarget(null)} />
          <div className="relative bg-card border border-border rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4 animate-in fade-in-0 zoom-in-95 duration-150">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
                <KeyRound size={14} className="text-amber-500" />
              </div>
              <h2 className="text-sm font-bold text-foreground">Reset Password</h2>
            </div>
            <p className="text-xs text-muted-foreground mb-6 ml-11">Set a new password for <span className="font-bold text-foreground">{passwordTarget.name}</span>. They will be signed out immediately.</p>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1 block">New Password</label>
                <input
                  type="password"
                  value={resetPassword}
                  onChange={e => setResetPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  minLength={6}
                  className="w-full px-3 py-2.5 rounded-xl bg-muted/50 border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition-all placeholder:text-muted-foreground/40"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1 block">Confirm Password</label>
                <input
                  type="password"
                  value={confirmResetPassword}
                  onChange={e => setConfirmResetPassword(e.target.value)}
                  placeholder="Re-enter password"
                  className={`w-full px-3 py-2.5 rounded-xl bg-muted/50 border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition-all placeholder:text-muted-foreground/40 ${
                    confirmResetPassword && confirmResetPassword !== resetPassword ? 'border-red-500/50' : 'border-border'
                  }`}
                />
                {confirmResetPassword && confirmResetPassword !== resetPassword && (
                  <p className="text-[10px] text-red-500 mt-1 font-bold">Passwords do not match</p>
                )}
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setPasswordTarget(null)}
                  className="flex-1 py-2.5 rounded-xl bg-muted text-foreground text-sm font-bold hover:bg-muted/80 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleResetPassword}
                  disabled={resettingPassword || resetPassword.length < 6 || resetPassword !== confirmResetPassword}
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-bold hover:bg-amber-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {resettingPassword ? 'Resetting…' : 'Reset Password'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
