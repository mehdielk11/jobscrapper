import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getSortedRowModel,
  SortingState,
} from '@tanstack/react-table'
import { useState } from 'react'
import { ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight } from 'lucide-react'

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

  const getPageNumbers = (current: number, total: number) => {
    if (total <= 6) return Array.from({ length: total }, (_, i) => i + 1);
    if (current <= 3) return [1, 2, 3, 4, '...', total];
    if (current >= total - 2) return [1, '...', total - 3, total - 2, total - 1, total];
    return [1, '...', current - 1, current, current + 1, '...', total];
  };

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
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-4 border-t border-border bg-muted/20">
          <p className="text-xs text-muted-foreground font-medium hidden sm:block">
            Showing <span className="font-mono">{totalCount}</span> items
          </p>
          <div className="flex items-center justify-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => onPageChange(page - 1)}
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
                    onClick={() => onPageChange((p as number) - 1)}
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
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages - 1}
              className="flex items-center rounded-xl text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:hover:text-muted-foreground px-2 py-1.5 transition-all"
            >
              <span className="hidden sm:inline text-xs font-bold uppercase tracking-widest">Next</span> <ChevronRight className="w-4 h-4 sm:ml-1" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
