"use client"

import * as React from "react"
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react"

import { cn } from "@/lib/utils"
import { SkeletonRows } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/ui/empty-state"
import { Checkbox } from "@/components/ui/checkbox"

// ── Types ─────────────────────────────────────────────────────────────────────

export type Column<T> = {
  id: string
  header: React.ReactNode
  cell: (row: T) => React.ReactNode
  align?: "left" | "right"
  sortable?: boolean
  sortValue?: (row: T) => string | number
  width?: string
  headerClassName?: string
  cellClassName?: string
}

export type DataTableProps<T> = {
  data: T[]
  columns: Column<T>[]
  getRowId: (row: T) => string
  density?: "comfortable" | "compact"
  initialSort?: { id: string; dir: "asc" | "desc" }
  onRowClick?: (row: T) => void
  selection?: { selectedIds: Set<string> | string[]; onChange: (ids: string[]) => void }
  bulkActions?: React.ReactNode
  toolbar?: React.ReactNode
  toolbarRight?: React.ReactNode
  loading?: boolean
  error?: React.ReactNode
  emptyState?: React.ReactNode
  rowClassName?: (row: T) => string
  stickyHeader?: boolean
  className?: string
}

// ── Internal sort state ───────────────────────────────────────────────────────

type SortState = { id: string; dir: "asc" | "desc" } | null

function nextDir(current: "asc" | "desc"): "asc" | "desc" {
  return current === "asc" ? "desc" : "asc"
}

function sortRows<T>(rows: T[], sort: SortState, columns: Column<T>[]): T[] {
  if (!sort) return rows
  const col = columns.find((c) => c.id === sort.id)
  if (!col) return rows

  return [...rows].sort((a, b) => {
    const av = col.sortValue ? col.sortValue(a) : String(col.cell(a) ?? "")
    const bv = col.sortValue ? col.sortValue(b) : String(col.cell(b) ?? "")
    let cmp = 0
    if (typeof av === "number" && typeof bv === "number") {
      cmp = av - bv
    } else {
      cmp = String(av).localeCompare(String(bv), undefined, { numeric: true })
    }
    return sort.dir === "asc" ? cmp : -cmp
  })
}

// ── Component ─────────────────────────────────────────────────────────────────

export function DataTable<T>({
  data,
  columns,
  getRowId,
  density = "comfortable",
  initialSort,
  onRowClick,
  selection,
  bulkActions,
  toolbar,
  toolbarRight,
  loading = false,
  error,
  emptyState,
  rowClassName,
  stickyHeader = false,
  className,
}: DataTableProps<T>) {
  // ── Sort state ──────────────────────────────────────────────────────────────
  const [sort, setSort] = React.useState<SortState>(initialSort ?? null)

  const handleSort = React.useCallback(
    (colId: string) => {
      setSort((prev) => {
        if (prev?.id === colId) {
          return { id: colId, dir: nextDir(prev.dir) }
        }
        return { id: colId, dir: "asc" }
      })
    },
    []
  )

  const sortedData = React.useMemo(
    () => sortRows(data, sort, columns),
    [data, sort, columns]
  )

  // ── Selection helpers ───────────────────────────────────────────────────────
  const selectedSet = React.useMemo<Set<string>>(() => {
    if (!selection) return new Set()
    if (selection.selectedIds instanceof Set) return selection.selectedIds
    return new Set(selection.selectedIds)
  }, [selection])

  const allVisibleIds = React.useMemo(
    () => sortedData.map(getRowId),
    [sortedData, getRowId]
  )

  const allSelected =
    allVisibleIds.length > 0 && allVisibleIds.every((id) => selectedSet.has(id))
  const someSelected =
    allVisibleIds.some((id) => selectedSet.has(id)) && !allSelected

  const handleSelectAll = React.useCallback(() => {
    if (!selection) return
    if (allSelected) {
      // Deselect all visible; keep any selected rows outside current view
      const removed = new Set(allVisibleIds)
      selection.onChange(
        [...selectedSet].filter((id) => !removed.has(id))
      )
    } else {
      const merged = new Set([...selectedSet, ...allVisibleIds])
      selection.onChange([...merged])
    }
  }, [selection, allSelected, allVisibleIds, selectedSet])

  const handleSelectRow = React.useCallback(
    (id: string, checked: boolean) => {
      if (!selection) return
      if (checked) {
        selection.onChange([...selectedSet, id])
      } else {
        selection.onChange([...selectedSet].filter((s) => s !== id))
      }
    },
    [selection, selectedSet]
  )

  // ── Toolbar / bulk bar visibility ───────────────────────────────────────────
  const hasToolbar = !!(toolbar || toolbarRight || selection)
  const hasBulkBar = !!(selection && selectedSet.size > 0)

  // ── thead sticky class ──────────────────────────────────────────────────────
  const thStickyClass = stickyHeader ? "sticky top-0 z-10" : ""

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div
      data-density={density}
      className={cn(
        "rounded-xl border border-hairline bg-card e1 overflow-hidden",
        className
      )}
    >
      {/* Toolbar */}
      {hasToolbar && (
        <div className="flex items-center justify-between gap-3 px-[var(--cell-px)] py-3 border-b border-hairline">
          <div className="flex items-center gap-3">{toolbar}</div>
          <div className="flex items-center gap-3">{toolbarRight}</div>
        </div>
      )}

      {/* Bulk selection bar */}
      {hasBulkBar && (
        <div className="flex items-center gap-3 px-[var(--cell-px)] py-2 bg-primary/[0.06] border-b border-hairline text-sm text-ink">
          <span>
            <span className="mono-data">{selectedSet.size}</span> selected
          </span>
          {bulkActions}
        </div>
      )}

      {/* Table scroll container */}
      <div className="overflow-auto">
        <table className="w-full caption-bottom text-sm border-collapse">
          {/* ── thead ── */}
          <thead>
            <tr>
              {/* Select-all checkbox column */}
              {selection && (
                <th
                  className={cn(
                    "px-[var(--cell-px)] py-[var(--cell-py)] bg-surface-2 text-ink-2 text-xs font-medium uppercase tracking-wide border-b border-hairline w-10",
                    thStickyClass
                  )}
                >
                  <Checkbox
                    checked={allSelected}
                    indeterminate={someSelected}
                    onCheckedChange={handleSelectAll}
                    aria-label="Select all rows"
                  />
                </th>
              )}

              {/* Data columns */}
              {columns.map((col) => {
                const isActive = sort?.id === col.id
                const ariaSortValue: React.AriaAttributes["aria-sort"] = isActive
                  ? sort?.dir === "asc"
                    ? "ascending"
                    : "descending"
                  : "none"

                const Icon = isActive
                  ? sort?.dir === "asc"
                    ? ChevronUp
                    : ChevronDown
                  : ChevronsUpDown

                return (
                  <th
                    key={col.id}
                    aria-sort={col.sortable ? ariaSortValue : undefined}
                    style={col.width ? { width: col.width } : undefined}
                    className={cn(
                      "px-[var(--cell-px)] py-[var(--cell-py)] bg-surface-2 text-ink-2 text-xs font-medium uppercase tracking-wide border-b border-hairline whitespace-nowrap align-middle",
                      col.align === "right" ? "text-right" : "text-left",
                      thStickyClass,
                      col.headerClassName
                    )}
                  >
                    {col.sortable ? (
                      <button
                        type="button"
                        onClick={() => handleSort(col.id)}
                        className={cn(
                          "inline-flex items-center gap-1 transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-sm",
                          isActive && "text-ink",
                          col.align === "right" ? "flex-row-reverse" : "flex-row"
                        )}
                      >
                        <span>{col.header}</span>
                        <Icon
                          className={cn(
                            "h-3 w-3 shrink-0",
                            isActive ? "text-primary" : "text-ink-3"
                          )}
                          strokeWidth={2}
                          aria-hidden="true"
                        />
                      </button>
                    ) : (
                      col.header
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>

          {/* ── tbody ── */}
          <tbody>
            {loading ? (
              <SkeletonRows rows={6} cols={columns.length + (selection ? 1 : 0)} />
            ) : error ? (
              <tr>
                <td
                  colSpan={columns.length + (selection ? 1 : 0)}
                  className="px-[var(--cell-px)] py-4 text-center text-sm text-neg"
                >
                  {error}
                </td>
              </tr>
            ) : sortedData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (selection ? 1 : 0)}
                  className="px-[var(--cell-px)] py-0"
                >
                  {emptyState ?? (
                    <EmptyState title="No data" description="Nothing to show here yet." />
                  )}
                </td>
              </tr>
            ) : (
              sortedData.map((row) => {
                const id = getRowId(row)
                const isSelected = selectedSet.has(id)
                const isClickable = !!onRowClick

                return (
                  <tr
                    key={id}
                    data-state={isSelected ? "selected" : undefined}
                    onClick={isClickable ? () => onRowClick(row) : undefined}
                    onKeyDown={
                      isClickable
                        ? (e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault()
                              onRowClick(row)
                            }
                          }
                        : undefined
                    }
                    role={isClickable ? "button" : undefined}
                    tabIndex={isClickable ? 0 : undefined}
                    className={cn(
                      "h-[var(--row-h)] border-b border-hairline last:border-0 transition-colors hover:bg-surface-2",
                      isClickable && "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40",
                      isSelected && "bg-primary/[0.06] shadow-[inset_2px_0_0_var(--primary)]",
                      rowClassName?.(row)
                    )}
                  >
                    {/* Row checkbox */}
                    {selection && (
                      <td className="px-[var(--cell-px)] align-middle w-10">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked) => handleSelectRow(id, checked)}
                          onClick={(e) => e.stopPropagation()}
                          aria-label={`Select row ${id}`}
                        />
                      </td>
                    )}

                    {/* Data cells */}
                    {columns.map((col) => (
                      <td
                        key={col.id}
                        className={cn(
                          "px-[var(--cell-px)] align-middle text-ink whitespace-nowrap",
                          col.align === "right" && "text-right mono-data",
                          col.cellClassName
                        )}
                      >
                        {col.cell(row)}
                      </td>
                    ))}
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
