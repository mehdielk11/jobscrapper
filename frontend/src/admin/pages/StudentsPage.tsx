import { useCallback, useEffect, useState } from 'react'
import { ColumnDef } from '@tanstack/react-table'
import { supabase } from '@/lib/supabase'
import { Eye, Trash2, UserX } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'react-hot-toast'
import { PageHeader } from '../components/shared/PageHeader'
import { DataTable } from '../components/shared/DataTable'
import { SlideOverPanel } from '../components/shared/SlideOverPanel'
import { ConfirmModal } from '../components/shared/ConfirmModal'

interface Student {
  id: string
  auth_user_id: string
  name: string
  email: string
  skills_count: number
  joined: string
  role: string
}

/**
 * StudentsPage — manage all student accounts, view profiles, promote to admin, delete.
 */
export function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Student | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Student | null>(null)
  const [studentSkills, setStudentSkills] = useState<string[]>([])

  const PAGE_SIZE = 25

  const fetchStudents = useCallback(async () => {
    setLoading(true)
    try {
      const { data, count, error } = await supabase
        .from('students')
        .select('id, auth_user_id, first_name, last_name, email, created_at', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

      if (error) throw error

      // Get skills counts
      const ids = (data ?? []).map((s: { id: string }) => s.id)
      const { data: skillsData } = await supabase
        .from('student_skills')
        .select('student_id')
        .in('student_id', ids)
      const skillsCnt: Record<string, number> = {}
      for (const s of (skillsData ?? [])) {
        skillsCnt[s.student_id] = (skillsCnt[s.student_id] ?? 0) + 1
      }

      // Get roles
      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', ids)
      const rolesMap: Record<string, string> = {}
      for (const r of (rolesData ?? [])) {
        rolesMap[r.user_id] = r.role
      }

      setStudents((data ?? []).map((s: any) => ({
        id: s.id,
        auth_user_id: s.auth_user_id,
        name: `${s.first_name ?? ''} ${s.last_name ?? ''}`.trim() || 'Unknown',
        email: s.email ?? '—',
        skills_count: skillsCnt[s.id] ?? 0,
        joined: s.created_at,
        role: rolesMap[s.auth_user_id] ?? 'student',
      })))
      setTotal(count ?? 0)
    } catch {
      toast.error('Failed to load students')
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => { fetchStudents() }, [fetchStudents])

  const openPanel = async (student: Student) => {
    setSelected(student)
    const { data } = await supabase
      .from('student_skills')
      .select('skill')
      .eq('student_id', student.id)
    setStudentSkills((data ?? []).map((s: { skill: string }) => s.skill))
  }

  const promoteToAdmin = async (student: Student) => {
    const { error } = await supabase
      .from('user_roles')
      .upsert({ user_id: student.auth_user_id, role: 'admin' }, { onConflict: 'user_id' })
    if (error) {
      toast.error('Promotion failed')
    } else {
      toast.success(`${student.name} promoted to admin`)
      setSelected(null)
      fetchStudents()
    }
  }

  const handleDelete = async (student: Student) => {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('No active session')

      const resp = await fetch(`http://localhost:8000/api/admin/users/${student.auth_user_id}?token=${session.access_token}`, {
        method: 'DELETE'
      })

      if (!resp.ok) {
        const err = await resp.json()
        throw new Error(err.detail || 'Delete failed')
      }

      toast.success('Student account and data deleted')
      setDeleteTarget(null)
      setSelected(null)
      fetchStudents()
    } catch (err: any) {
      toast.error(err.message || 'Delete failed')
    } finally {
      setLoading(false)
    }
  }

  const columns: ColumnDef<Student, unknown>[] = [
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
      accessorKey: 'skills_count',
      header: 'Skills',
      cell: ({ getValue }) => (
        <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-zinc-400 font-mono">{getValue() as number}</span>
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
      accessorKey: 'role',
      header: 'Role',
      cell: ({ getValue }) => {
        const r = getValue() as string
        return (
          <span className={`text-xs px-2 py-0.5 rounded-full font-mono ${r === 'admin' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-zinc-800 text-zinc-500'}`}>
            {r}
          </span>
        )
      },
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
        title="Students"
        description={`${total.toLocaleString()} registered accounts`}
      />

      <DataTable
        columns={columns}
        data={students}
        loading={loading}
        onRowClick={openPanel}
        emptyMessage="No students registered yet."
        pageSize={PAGE_SIZE}
        totalCount={total}
        page={page}
        onPageChange={setPage}
      />

      {/* Student detail panel */}
      <SlideOverPanel
        isOpen={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.name ?? 'Student Detail'}
        width="md"
      >
        {selected && (
          <div className="space-y-5">
            {/* Info */}
            <div className="space-y-3">
              <div>
                <p className="text-xs text-zinc-500 mb-1">Email</p>
                <p className="text-sm text-zinc-300">{selected.email}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500 mb-1">Role</p>
                <span className={`text-xs px-2 py-0.5 rounded-full font-mono ${selected.role === 'admin' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-zinc-800 text-zinc-400'}`}>
                  {selected.role}
                </span>
              </div>
              <div>
                <p className="text-xs text-zinc-500 mb-1">Joined</p>
                <p className="text-sm text-zinc-300">
                  {formatDistanceToNow(new Date(selected.joined), { addSuffix: true })}
                </p>
              </div>
            </div>

            {/* Skills */}
            <div>
              <p className="text-xs text-zinc-500 mb-2">Skills ({studentSkills.length})</p>
              <div className="flex flex-wrap gap-1.5">
                {studentSkills.length === 0 ? (
                  <p className="text-xs text-zinc-600">No skills in profile yet.</p>
                ) : (
                  studentSkills.map(skill => (
                    <span key={skill} className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/10">
                      {skill}
                    </span>
                  ))
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-2 pt-3 border-t border-white/5">
              {selected.role !== 'admin' && (
                <button
                  onClick={() => promoteToAdmin(selected)}
                  className="w-full py-2 rounded-lg bg-indigo-500/10 text-indigo-300 text-sm hover:bg-indigo-500/20 transition-colors"
                >
                  Promote to Admin
                </button>
              )}
              <button
                onClick={() => setDeleteTarget(selected)}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-red-500/10 text-red-400 text-sm hover:bg-red-500/20 transition-colors"
              >
                <UserX size={13} />
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
        title="Delete Student"
        message={`Delete "${deleteTarget?.name}"? This will remove all their data.`}
        confirmLabel="Delete Account"
        variant="danger"
      />
    </div>
  )
}
