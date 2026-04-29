import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import {
  FileText, CheckCircle2, XCircle, Clock, ChevronLeft, ChevronRight,
  Building2, Mail, Users, Globe, Calendar,
} from 'lucide-react'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

type AppStatus = 'pending' | 'approved' | 'rejected' | 'all'

interface Application {
  id: string
  first_name: string
  last_name: string
  email: string
  org_name: string
  org_type: string
  org_description: string
  org_website?: string
  expected_students?: number
  submitted_at: string
  reviewed_at?: string
  status: string
  review_note?: string
}

const STATUS_TABS: { label: string; value: AppStatus; icon: any }[] = [
  { label: 'Pending', value: 'pending', icon: Clock },
  { label: 'Approved', value: 'approved', icon: CheckCircle2 },
  { label: 'Rejected', value: 'rejected', icon: XCircle },
]

const statusBadge = (status: string) => {
  switch (status) {
    case 'pending':
      return 'bg-amber-500/10 text-amber-600 border-amber-500/20'
    case 'approved':
      return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
    case 'rejected':
      return 'bg-red-500/10 text-red-600 border-red-500/20'
    default:
      return 'bg-slate-500/10 text-slate-600 border-slate-500/20'
  }
}

export function ApplicationsPage() {
  const [tab, setTab] = useState<AppStatus>('pending')
  const [apps, setApps] = useState<Application[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)
  const [selected, setSelected] = useState<Application | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [showReject, setShowReject] = useState(false)

  const pageSize = 15

  const getToken = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || ''
  }

  const fetchApps = useCallback(async () => {
    setLoading(true)
    const token = await getToken()
    try {
      const resp = await fetch(
        `${API_BASE}/api/admin/applications?token=${token}&status=${tab}&page=${page}&page_size=${pageSize}`
      )
      if (resp.ok) {
        const data = await resp.json()
        setApps(data.items || [])
        setTotal(data.total || 0)
      }
    } catch { /* noop */ }
    setLoading(false)
  }, [tab, page])

  const fetchCount = useCallback(async () => {
    const token = await getToken()
    try {
      const resp = await fetch(`${API_BASE}/api/admin/applications/count?token=${token}`)
      if (resp.ok) {
        const data = await resp.json()
        setPendingCount(data.count || 0)
      }
    } catch { /* noop */ }
  }, [])

  useEffect(() => {
    setPage(1)
  }, [tab])

  useEffect(() => {
    fetchApps()
    fetchCount()
  }, [fetchApps, fetchCount])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const handleApprove = async (appId: string) => {
    setActionLoading(true)
    const token = await getToken()
    try {
      const resp = await fetch(
        `${API_BASE}/api/admin/applications/${appId}/approve?token=${token}`,
        { method: 'POST' }
      )
      if (resp.ok) {
        setSelected(null)
        fetchApps()
        fetchCount()
      } else {
        const data = await resp.json()
        alert(data.detail || 'Failed to approve')
      }
    } catch {
      alert('Network error')
    }
    setActionLoading(false)
  }

  const handleReject = async (appId: string) => {
    setActionLoading(true)
    const token = await getToken()
    try {
      const resp = await fetch(
        `${API_BASE}/api/admin/applications/${appId}/reject?token=${token}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: rejectReason || null }),
        }
      )
      if (resp.ok) {
        setSelected(null)
        setShowReject(false)
        setRejectReason('')
        fetchApps()
        fetchCount()
      } else {
        const data = await resp.json()
        alert(data.detail || 'Failed to reject')
      }
    } catch {
      alert('Network error')
    }
    setActionLoading(false)
  }

  const fmtDate = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Applications</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Review and manage Academic Manager applications
          </p>
        </div>
        {pendingCount > 0 && (
          <div className="px-4 py-2 rounded-2xl bg-amber-500/10 text-amber-600 text-sm font-bold border border-amber-500/20">
            {pendingCount} pending
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-2xl border border-border w-fit">
        {STATUS_TABS.map(({ label, value, icon: Icon }) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
              tab === value
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon size={14} />
            {label}
            {value === 'pending' && pendingCount > 0 && (
              <span className="ml-1 px-2 py-0.5 rounded-full bg-amber-500 text-white text-xs font-bold">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : apps.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <FileText className="mx-auto mb-3 w-8 h-8 opacity-40" />
            <p className="text-sm font-medium">No {tab} applications</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-5 py-3 font-semibold text-muted-foreground">Applicant</th>
                <th className="px-5 py-3 font-semibold text-muted-foreground">Organisation</th>
                <th className="px-5 py-3 font-semibold text-muted-foreground">Type</th>
                <th className="px-5 py-3 font-semibold text-muted-foreground">Date</th>
                <th className="px-5 py-3 font-semibold text-muted-foreground">Status</th>
                <th className="px-5 py-3 font-semibold text-muted-foreground text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {apps.map(app => (
                <tr
                  key={app.id}
                  className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => { setSelected(app); setShowReject(false); setRejectReason('') }}
                >
                  <td className="px-5 py-3.5">
                    <p className="font-medium text-foreground">{app.first_name} {app.last_name}</p>
                    <p className="text-xs text-muted-foreground">{app.email}</p>
                  </td>
                  <td className="px-5 py-3.5 text-foreground">{app.org_name}</td>
                  <td className="px-5 py-3.5">
                    <span className="px-2 py-1 rounded-lg bg-muted text-xs font-medium capitalize">{app.org_type}</span>
                  </td>
                  <td className="px-5 py-3.5 text-muted-foreground">{fmtDate(app.submitted_at)}</td>
                  <td className="px-5 py-3.5">
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border capitalize ${statusBadge(app.status)}`}>
                      {app.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                      onClick={e => { e.stopPropagation(); setSelected(app); setShowReject(false) }}
                    >
                      View →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-border">
            <span className="text-xs text-muted-foreground">
              Page {page} of {totalPages} ({total} total)
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-30"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-30"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Sheet Modal */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={() => setSelected(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-card border border-border rounded-3xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto"
            >
              {/* Modal header */}
              <div className="p-6 border-b border-border">
                <div className="flex items-center justify-between mb-4">
                  <span className={`px-3 py-1 rounded-lg text-xs font-bold border capitalize ${statusBadge(selected.status)}`}>
                    {selected.status}
                  </span>
                  <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground transition-colors">✕</button>
                </div>
                <h2 className="text-xl font-bold text-foreground">{selected.first_name} {selected.last_name}</h2>
                <p className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                  <Mail size={13} /> {selected.email}
                </p>
              </div>

              {/* Modal body */}
              <div className="p-6 space-y-5">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Building2 size={14} className="text-muted-foreground" />
                    <span className="font-medium text-foreground">{selected.org_name}</span>
                    <span className="px-2 py-0.5 rounded bg-muted text-xs capitalize">{selected.org_type}</span>
                  </div>

                  {selected.org_website && (
                    <div className="flex items-center gap-2 text-sm">
                      <Globe size={14} className="text-muted-foreground" />
                      <a href={selected.org_website} target="_blank" rel="noreferrer" className="text-primary hover:underline truncate">
                        {selected.org_website}
                      </a>
                    </div>
                  )}

                  {selected.expected_students && (
                    <div className="flex items-center gap-2 text-sm">
                      <Users size={14} className="text-muted-foreground" />
                      <span className="text-foreground">{selected.expected_students} expected students</span>
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-sm">
                    <Calendar size={14} className="text-muted-foreground" />
                    <span className="text-muted-foreground">Submitted {fmtDate(selected.submitted_at)}</span>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Description</p>
                  <p className="text-sm text-foreground leading-relaxed bg-muted/50 rounded-xl p-4 border border-border">
                    {selected.org_description}
                  </p>
                </div>

                {selected.review_note && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Review Note</p>
                    <p className="text-sm text-foreground bg-muted/50 rounded-xl p-4 border border-border">
                      {selected.review_note}
                    </p>
                  </div>
                )}

                {/* Reject reason input */}
                {showReject && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Rejection Reason (optional)</p>
                    <textarea
                      value={rejectReason}
                      onChange={e => setRejectReason(e.target.value)}
                      rows={3}
                      placeholder="Provide a reason for rejection..."
                      className="w-full rounded-xl border border-border bg-background p-3 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:ring-2 focus:ring-primary/30 focus:outline-none"
                    />
                  </div>
                )}
              </div>

              {/* Modal actions */}
              {selected.status === 'pending' && (
                <div className="p-6 border-t border-border flex items-center gap-3">
                  {showReject ? (
                    <>
                      <button
                        onClick={() => setShowReject(false)}
                        className="flex-1 py-3 rounded-xl text-sm font-medium border border-border text-foreground hover:bg-muted transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleReject(selected.id)}
                        disabled={actionLoading}
                        className="flex-1 py-3 rounded-xl text-sm font-bold bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50"
                      >
                        {actionLoading ? 'Rejecting...' : 'Confirm Reject'}
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => setShowReject(true)}
                        disabled={actionLoading}
                        className="flex-1 py-3 rounded-xl text-sm font-bold border border-red-500/30 text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => handleApprove(selected.id)}
                        disabled={actionLoading}
                        className="flex-1 py-3 rounded-xl text-sm font-bold bg-emerald-500 text-white hover:bg-emerald-600 transition-colors disabled:opacity-50"
                      >
                        {actionLoading ? 'Approving...' : 'Approve & Send Link'}
                      </button>
                    </>
                  )}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
