import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getSortedRowModel,
  SortingState,
} from '@tanstack/react-table'
import { useState } from 'react'
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'

interface DataTableProps<TData> {
  columns: ColumnDef<TData, any>[]
  data: TData[]
  loading?: boolean
  onRowClick?: (row: TData) => void
  emptyMessage?: string
  pageSize?: number
  totalCount?: number
  page?: number
  onPageChange?: (page: number) => void
}

/**
 * Generic sortable data table built on TanStack Table v8.
 * Supports server-side pagination, row click, loading skeleton, and empty states.
 */
export function DataTable<TData>({
  columns,
  data,
  loading = false,
  onRowClick,
  emptyMessage = 'No data found.',
  pageSize = 25,
  totalCount = 0,
  page = 0,
  onPageChange,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([])
  const totalPages = Math.ceil(totalCount / pageSize)

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    state: { sorting },
    manualPagination: true,
    pageCount: totalPages,
  })

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden transition-all duration-500 shadow-sm">
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full">
          <thead>
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id} className="border-b border-border">
                {headerGroup.headers.map(header => (
                  <th
                    key={header.id}
                    className="px-4 py-4 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider cursor-pointer select-none hover:text-foreground transition-colors"
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <div className="flex items-center gap-1.5">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getCanSort() && (
                        <span className="text-muted-foreground/60">
                          {header.column.getIsSorted() === 'asc' ? (
                            <ChevronUp size={10} />
                          ) : header.column.getIsSorted() === 'desc' ? (
                            <ChevronDown size={10} />
                          ) : (
                            <ChevronsUpDown size={10} />
                          )}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-border animate-pulse">
                  {columns.map((_, j) => (
                    <td key={j} className="px-4 py-4">
                      <div className="h-4 bg-muted rounded w-3/4" />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-16 text-center text-sm text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-2">
                      <span className="text-xl">📭</span>
                    </div>
                    {emptyMessage}
                  </div>
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map(row => (
                <tr
                  key={row.id}
                  onClick={() => onRowClick?.(row.original)}
                  className={`border-b border-border transition-colors ${onRowClick ? 'cursor-pointer hover:bg-muted/50' : ''}`}
                >
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id} className="px-4 py-4 text-sm text-foreground/80">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && onPageChange && (
        <div className="flex items-center justify-between px-4 py-4 border-t border-border bg-muted/20">
          <p className="text-xs text-muted-foreground font-medium">
            Page <span className="text-foreground">{page + 1}</span> of <span className="text-foreground">{totalPages}</span> · <span className="font-mono">{totalCount}</span> total
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page === 0}
              className="px-4 py-1.5 text-xs font-medium rounded-lg bg-background border border-border text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95"
            >
              Previous
            </button>
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages - 1}
              className="px-4 py-1.5 text-xs font-medium rounded-lg bg-background border border-border text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
