import { useCallback, useEffect, useMemo, useState } from 'react'
import { ColumnDef } from '@tanstack/react-table'
import { supabase } from '@/lib/supabase'
import { Search, Download, Trash2, Cpu, Eye } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'react-hot-toast'
import { PageHeader } from '../components/shared/PageHeader'
import { DataTable } from '../components/shared/DataTable'
import { SlideOverPanel } from '../components/shared/SlideOverPanel'
import { ConfirmModal } from '../components/shared/ConfirmModal'

interface Job {
  id: string
  title: string
  company: string
  location: string | null
  source: string
  skills_count: number
  scraped_at: string | null
  url: string
  description: string | null
}

const SOURCE_COLORS: Record<string, string> = {
  rekrute: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20',
  emploidiali: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20',
  indeed: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20',
  linkedin: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20',
  'emploi-public': 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20',
  marocannonces: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20',
}

/**
 * JobsPage — browse, search, filter, and moderate all job offers in the DB.
 */
export function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sourceFilter, setSourceFilter] = useState('')
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Job | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const PAGE_SIZE = 25

  const fetchJobs = useCallback(async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('jobs')
        .select('id, title, company, location, source, scraped_at, url, description', { count: 'exact' })
        .order('scraped_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

      if (search) query = query.ilike('title', `%${search}%`)
      if (sourceFilter) query = query.eq('source', sourceFilter)

      const { data, count, error } = await query
      if (error) throw error

      // Fetch skills counts
      const jobIds = (data ?? []).map((j: { id: string }) => j.id)
      const skillsCount: Record<string, number> = {}

      if (jobIds.length > 0) {
        const { data: skillsData } = await supabase
          .from('job_skills')
          .select('job_id')
          .in('job_id', jobIds)

        for (const s of (skillsData ?? [])) {
          skillsCount[s.job_id] = (skillsCount[s.job_id] ?? 0) + 1
        }
      }

      setJobs((data ?? []).map((j: Omit<Job, 'skills_count'>) => ({
        ...j,
        skills_count: skillsCount[j.id] ?? 0,
      })))
      setTotal(count ?? 0)
    } catch {
      toast.error('Failed to load jobs')
    } finally {
      setLoading(false)
    }
  }, [page, search, sourceFilter])

  useEffect(() => { fetchJobs() }, [fetchJobs])

  const handleDelete = async (job: Job) => {
    const { error } = await supabase.from('jobs').delete().eq('id', job.id)
    if (error) {
      toast.error('Delete failed')
    } else {
      toast.success('Job deleted')
      setDeleteTarget(null)
      fetchJobs()
    }
  }

  const columns = useMemo<ColumnDef<Job, any>[]>(() => [
    {
      id: 'select',
      header: '',
      cell: ({ row }) => (
        <input
          type="checkbox"
          checked={selectedIds.has(row.original.id)}
          onChange={e => {
            const next = new Set(selectedIds)
            if (e.target.checked) {
              next.add(row.original.id)
            } else {
              next.delete(row.original.id)
            }
            setSelectedIds(next)
          }}
          onClick={e => e.stopPropagation()}
          className="accent-primary w-4 h-4 rounded border-border"
        />
      ),
    },
    {
      accessorKey: 'title',
      header: 'Title',
      cell: ({ getValue }) => {
        const title = getValue() as string ?? 'Untitled Job'
        return (
          <span className="text-foreground font-semibold truncate max-w-[220px] block" title={title}>
            {title.slice(0, 40)}{title.length > 40 ? '…' : ''}
          </span>
        )
      },
    },
    { accessorKey: 'company', header: 'Company' },
    { accessorKey: 'location', header: 'Location' },
    {
      accessorKey: 'source',
      header: 'Source',
      cell: ({ getValue }) => {
        const s = getValue() as string
        return (
          <span className={`text-xs px-2 py-0.5 rounded-full font-mono ${SOURCE_COLORS[s] ?? 'bg-muted text-muted-foreground border border-border'}`}>
            {s}
          </span>
        )
      },
    },
    {
      accessorKey: 'skills_count',
      header: 'Skills',
      cell: ({ getValue }) => (
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-bold font-mono">
          {getValue() as number}
        </span>
      ),
    },
    {
      accessorKey: 'scraped_at',
      header: 'Scraped',
      cell: ({ getValue }) => {
        const dateStr = getValue() as string
        if (!dateStr) return <span className="text-xs text-muted-foreground">Never</span>
        try {
          return (
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(dateStr), { addSuffix: true })}
            </span>
          )
        } catch {
          return <span className="text-xs text-muted-foreground">Invalid</span>
        }
      },
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => setSelectedJob(row.original)}
            className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <Eye size={13} />
          </button>
          <button
            onClick={() => setDeleteTarget(row.original)}
            className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          >
            <Trash2 size={13} />
          </button>
        </div>
      ),
    },
  ], [selectedIds])

  return (
    <div>
      <PageHeader
        title="Job Offers"
        description={`${total.toLocaleString()} jobs in database`}
        action={
          <a
            href="/api/jobs/export-csv"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-sm transition-colors"
          >
            <Download size={14} />
            Export CSV
          </a>
        }
      />

      {/* Toolbar */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="relative flex-1 min-w-[280px]">
          <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search job title, company..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0) }}
            className="w-full pl-10 pr-4 py-2.5 bg-card border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-sm"
          />
        </div>
        <select
          value={sourceFilter}
          onChange={e => { setSourceFilter(e.target.value); setPage(0) }}
          className="px-4 py-2.5 bg-card border border-border rounded-xl text-sm text-foreground font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-sm"
        >
          <option value="">All job sources</option>
          {['rekrute', 'emploidiali', 'indeed', 'linkedin', 'emploi-public', 'marocannonces'].map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 mb-4 px-4 py-2.5 bg-primary/10 border border-primary/20 rounded-xl">
          <span className="text-sm font-bold text-primary">{selectedIds.size} selected</span>
          <button
            onClick={async () => {
              await supabase.from('jobs').delete().in('id', [...selectedIds])
              setSelectedIds(new Set())
              fetchJobs()
              toast.success('Deleted selected jobs')
            }}
            className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition-colors"
          >
            <Trash2 size={12} /> Delete selected
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="ml-auto text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-foreground transition-all"
          >
            Clear selection
          </button>
        </div>
      )}

      <DataTable
        columns={columns}
        data={jobs}
        loading={loading}
        onRowClick={job => setSelectedJob(job)}
        emptyMessage="No jobs found. Run a scraper to populate the database."
        pageSize={PAGE_SIZE}
        totalCount={total}
        page={page}
        onPageChange={p => setPage(p)}
      />

      {/* Job detail side panel */}
      <SlideOverPanel
        isOpen={!!selectedJob}
        onClose={() => setSelectedJob(null)}
        title={selectedJob?.title ?? 'Job Detail'}
        width="lg"
      >
        {selectedJob && (
          <div className="space-y-4">
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Company</p>
              <p className="text-sm font-bold text-foreground">{selectedJob.company}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Location</p>
              <p className="text-sm font-medium text-foreground">{selectedJob.location ?? 'Not specified'}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Source</p>
              <span className={`text-xs px-2 py-0.5 rounded-full font-mono ${SOURCE_COLORS[selectedJob.source] ?? 'bg-muted text-muted-foreground border border-border'}`}>
                {selectedJob.source}
              </span>
            </div>
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Description</p>
              <div className="text-sm text-foreground/80 leading-relaxed max-h-64 overflow-y-auto pr-2 bg-muted/30 border border-border/50 rounded-xl p-4">
                {selectedJob.description ?? 'No description available.'}
              </div>
            </div>
            <div className="flex gap-2 pt-2 border-t border-white/5">
              <a
                href={selectedJob.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 text-center py-2.5 rounded-xl bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest hover:bg-primary hover:text-primary-foreground transition-all shadow-sm"
              >
                View Original
              </a>
              <button
                onClick={() => { setDeleteTarget(selectedJob); setSelectedJob(null) }}
                className="py-2.5 px-5 rounded-xl bg-destructive/10 text-destructive text-[10px] font-black uppercase tracking-widest border border-destructive/20 hover:bg-destructive hover:text-white transition-all shadow-sm"
              >
                Delete
              </button>
            </div>
            <button
              onClick={() => {
                toast.success('NLP re-extraction queued')
              }}
              className="w-full py-2.5 rounded-xl bg-muted/50 text-muted-foreground hover:text-foreground text-[10px] font-black uppercase tracking-widest hover:bg-muted border border-border transition-all flex items-center justify-center gap-2"
            >
              <Cpu size={14} />
              Re-extract Skills
            </button>
          </div>
        )}
      </SlideOverPanel>

      {/* Delete confirm modal */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        onConfirm={() => deleteTarget && handleDelete(deleteTarget)}
        onCancel={() => setDeleteTarget(null)}
        title="Delete Job"
        message={`Are you sure you want to delete "${deleteTarget?.title}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  )
}
