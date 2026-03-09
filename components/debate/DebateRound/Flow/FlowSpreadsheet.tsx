/**
 * @fileoverview AG Grid-powered spreadsheet interface for debate flowing.
 */

"use client"


import { useMemo, useCallback, useRef, useState, useEffect } from "react"
import { AgGridReact } from "ag-grid-react"
import { AllCommunityModule, ModuleRegistry, themeQuartz } from "ag-grid-community"
import type {
  ColDef,
  CellValueChangedEvent,
  GridReadyEvent,
  CellKeyDownEvent,
  RowDragEndEvent,
  IHeaderParams,
  CellContextMenuEvent,
  ICellRendererParams,
} from "ag-grid-community"
import { ChevronDown, ChevronRight, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { Flow, Box } from "@/components/debate/DebateRound/types"

// Register AG Grid community modules
ModuleRegistry.registerModules([AllCommunityModule])

/**
 * Props for the FlowSpreadsheet component
 */
interface FlowSpreadsheetProps {
  /** The flow data to display */
  flow: Flow
  /** Callback when flow data is updated */
  onUpdate: (updates: Partial<Flow>) => void
  /** Optional callback to open speech document panel */
  onOpenSpeechPanel?: (speechName: string) => void
  /** Optional callback when grid is ready */
  onGridReady?: (api: any) => void
}

/**
 * Simplified AG Grid column header — speech name + speech-doc icon only.
 */
const FlowColumnHeader = (props: IHeaderParams & { onOpenSpeechPanel?: (speechName: string) => void }) => {
  if (!props.displayName) return null
  const name = props.displayName
  const hasN = name.toUpperCase().includes("N")
  const hasA = name.toUpperCase().includes("A")
  const textColor = hasN
    ? "text-red-600 dark:text-red-400"
    : hasA
      ? "text-blue-600 dark:text-blue-400"
      : ""

  return (
    <div className="flex items-center justify-between w-full px-2">
      <span className={`text-sm font-semibold ${textColor}`}>{name}</span>
      {props.onOpenSpeechPanel && (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={(e) => {
            e.stopPropagation()
            props.onOpenSpeechPanel!(name)
          }}
          title={`Open ${name} speech document`}
        >
          <FileText className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      )}
    </div>
  )
}

/**
 * Custom cell renderer for first column cells that are section headings.
 * Shows a chevron toggle and bold text for heading rows.
 */
const FirstColumnCellRenderer = (props: ICellRendererParams & {
  collapsedHeadings: Set<string>
  onToggleCollapse: (rowId: string) => void
}) => {
  const { data, value, collapsedHeadings, onToggleCollapse } = props
  if (!data) return <span>{value}</span>

  if (data.isHeading) {
    const isCollapsed = collapsedHeadings.has(data.id)
    return (
      <div className="flex items-center gap-1 w-full h-full">
        <button
          className="flex items-center justify-center w-5 h-5 rounded hover:bg-muted shrink-0"
          onClick={(e) => {
            e.stopPropagation()
            onToggleCollapse(data.id)
          }}
        >
          {isCollapsed ? (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </button>
        <span className="font-bold">{value}</span>
      </div>
    )
  }

  // Indent child rows under headings
  if (data.parentHeadingId) {
    return (
      <div className="flex items-center w-full h-full" style={{ paddingLeft: 24 }}>
        <span>{value}</span>
      </div>
    )
  }

  return <span>{value}</span>
}

/**
 * A single item in the context menu
 */
interface ContextMenuItem {
  label: string
  onClick: () => void
  disabled?: boolean
  separator?: false
}

interface ContextMenuSeparator {
  separator: true
}

type ContextMenuEntry = ContextMenuItem | ContextMenuSeparator

/**
 * Custom right-click context menu for the grid
 */
const GridContextMenu = ({
  x,
  y,
  items,
  onClose,
}: {
  x: number
  y: number
  items: ContextMenuEntry[]
  onClose: () => void
}) => {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("mousedown", handleClickOutside)
    document.addEventListener("keydown", handleEsc)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("keydown", handleEsc)
    }
  }, [onClose])

  // Clamp menu position to viewport
  const style = useMemo(() => {
    const menuWidth = 220
    const menuHeight = items.length * 32
    return {
      left: Math.min(x, window.innerWidth - menuWidth - 8),
      top: Math.min(y, window.innerHeight - menuHeight - 8),
    }
  }, [x, y, items.length])

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[200px] rounded-md border bg-popover p-1 text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95"
      style={style}
    >
      {items.map((item, i) => {
        if (item.separator) {
          return <div key={i} className="my-1 h-px bg-border" />
        }
        return (
          <button
            key={i}
            disabled={item.disabled}
            className="relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
            onClick={() => {
              item.onClick()
              onClose()
            }}
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )
}

/**
 * Convert flow children (nested Box structure) to flat row data for AG Grid
 *
 * @param boxes - Array of root-level boxes
 * @param columns - Column names from the flow
 * @returns Array of row objects with column values
 */
function buildRowData(boxes: Box[], columns: string[]): any[] {
  const depth = columns.length
  const rows: any[] = []

  boxes.forEach((box, index) => {
    const row: any = {
      id: `row-${index}`,
      originalIndex: index,
      isHeading: box.isHeading ?? false,
    }

    // Flatten box chain into column values
    let current: Box | undefined = box
    for (let i = 0; i < depth; i++) {
      row[`col_${i}`] = current?.content ?? ""
      current = current?.children?.[0]
    }

    rows.push(row)
  })

  // Reconstruct parentHeadingId from heading flags
  let currentHeadingId: string | undefined
  for (const row of rows) {
    if (row.isHeading) {
      currentHeadingId = row.id
    } else if (currentHeadingId) {
      row.parentHeadingId = currentHeadingId
    }
  }

  return rows
}

/**
 * Convert flat row data back to nested Box structure
 *
 * @param rows - Array of row objects from AG Grid
 * @param columns - Column names from the flow
 * @returns Array of Box objects with nested children
 */
function rowDataToBoxes(rows: any[], columns: string[]): Box[] {
  const depth = columns.length
  const boxes: Box[] = []

  rows.forEach((row) => {
    const values: string[] = []
    for (let i = 0; i < depth; i++) {
      values.push(row[`col_${i}`] ?? "")
    }

    // Build box chain from deepest to shallowest
    let box: Box = {
      content: values[depth - 1] ?? "",
      children: [],
      index: depth,
      level: depth,
      focus: false,
      empty: !(values[depth - 1] ?? "").trim(),
    }

    for (let i = depth - 2; i >= 0; i--) {
      box = {
        content: values[i] ?? "",
        children: [box],
        index: i,
        level: i + 1,
        focus: false,
        empty: !(values[i] ?? "").trim(),
      }
    }

    // Persist heading state on the root box
    if (row.isHeading) {
      box.isHeading = true
    }

    boxes.push(box)
  })

  return boxes
}

/**
 * FlowSpreadsheet - AG Grid-based debate flow interface
 *
 * This component provides a spreadsheet-like interface for taking debate notes.
 * Each column represents a speech, and rows represent individual arguments
 * that can be tracked across the debate.
 *
 * @param props - Component props
 * @returns The flow spreadsheet component
 *
 * @example
 * ```tsx
 * <FlowSpreadsheet
 *   flow={currentFlow}
 *   onUpdate={(updates) => updateFlow(flowIndex, updates)}
 *   onOpenSpeechPanel={(speech) => setSpeechPanel(speech)}
 * />
 * ```
 */
export function FlowSpreadsheet({
  flow,
  onUpdate,
  onOpenSpeechPanel,
  onGridReady: onGridReadyProp,
}: FlowSpreadsheetProps) {
  // Refs and state
  const gridRef = useRef<AgGridReact>(null)
  const [isMobile, setIsMobile] = useState(false)
  const [currentColumnIndex, setCurrentColumnIndex] = useState(0)

  // Section heading & collapse state
  const [collapsedHeadings, setCollapsedHeadings] = useState<Set<string>>(new Set())
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; rowId: string } | null>(null)

  // Initialize row data from flow
  const [rowData, setRowData] = useState<any[]>(() => buildRowData(flow.children, flow.columns))

  /**
   * Update row data when flow children change externally.
   * Rebuilds rows from boxes (which now carry isHeading), preserving tree structure.
   */
  useEffect(() => {
    const newRows = buildRowData(flow.children, flow.columns)
    setRowData(newRows)
    // Trigger filter re-eval in case collapsed state applies to new rows
    setTimeout(() => gridRef.current?.api?.onFilterChanged(), 0)
  }, [flow.children, flow.columns])

  /**
   * Check for mobile viewport on mount and resize
   */
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  /**
   * Toggle a row as a section heading.
   * When toggling ON, all subsequent non-heading rows get parentHeadingId set.
   * When toggling OFF, children lose their parentHeadingId.
   */
  const toggleHeading = useCallback(
    (rowId: string) => {
      setRowData((prev) => {
        const rows = prev.map((r) => ({ ...r }))
        const idx = rows.findIndex((r) => r.id === rowId)
        if (idx === -1) return prev

        const row = rows[idx]
        const wasHeading = row.isHeading

        if (wasHeading) {
          // Remove heading status and unparent children
          row.isHeading = false
          for (let i = idx + 1; i < rows.length; i++) {
            if (rows[i].parentHeadingId === rowId) {
              rows[i].parentHeadingId = undefined
            } else {
              break
            }
          }
          // Remove from collapsed set
          setCollapsedHeadings((s) => {
            const next = new Set(s)
            next.delete(rowId)
            return next
          })
        } else {
          // Make it a heading and assign children until next heading
          row.isHeading = true
          row.parentHeadingId = undefined
          for (let i = idx + 1; i < rows.length; i++) {
            if (rows[i].isHeading) break
            rows[i].parentHeadingId = rowId
          }
        }

        // Sync to flow
        const newChildren = rowDataToBoxes(rows, flow.columns)
        onUpdate({ children: newChildren })

        return rows
      })
    },
    [flow.columns, onUpdate],
  )

  /**
   * Toggle collapse/expand for a heading row
   */
  const toggleCollapse = useCallback(
    (rowId: string) => {
      setCollapsedHeadings((prev) => {
        const next = new Set(prev)
        if (next.has(rowId)) {
          next.delete(rowId)
        } else {
          next.add(rowId)
        }
        return next
      })
      // Trigger external filter re-evaluation
      setTimeout(() => {
        gridRef.current?.api?.onFilterChanged()
      }, 0)
    },
    [],
  )

  /**
   * Indent a row — make it a child of the nearest heading above it
   */
  const indentRow = useCallback(
    (rowId: string) => {
      setRowData((prev) => {
        const rows = prev.map((r) => ({ ...r }))
        const idx = rows.findIndex((r) => r.id === rowId)
        if (idx <= 0 || rows[idx].isHeading) return prev

        // Find the nearest heading above
        let headingId: string | undefined
        for (let i = idx - 1; i >= 0; i--) {
          if (rows[i].isHeading) {
            headingId = rows[i].id
            break
          }
        }
        if (!headingId || rows[idx].parentHeadingId === headingId) return prev

        rows[idx].parentHeadingId = headingId
        const newChildren = rowDataToBoxes(rows, flow.columns)
        onUpdate({ children: newChildren })
        return rows
      })
    },
    [flow.columns, onUpdate],
  )

  /**
   * Outdent a row — remove it from its parent heading
   */
  const outdentRow = useCallback(
    (rowId: string) => {
      setRowData((prev) => {
        const rows = prev.map((r) => ({ ...r }))
        const idx = rows.findIndex((r) => r.id === rowId)
        if (idx === -1 || !rows[idx].parentHeadingId) return prev

        rows[idx].parentHeadingId = undefined
        const newChildren = rowDataToBoxes(rows, flow.columns)
        onUpdate({ children: newChildren })
        return rows
      })
    },
    [flow.columns, onUpdate],
  )

  /**
   * Insert a new empty row above or below the target row
   */
  const insertRow = useCallback(
    (rowId: string, position: "above" | "below") => {
      setRowData((prev) => {
        const rows = prev.map((r) => ({ ...r }))
        const idx = rows.findIndex((r) => r.id === rowId)
        if (idx === -1) return prev

        const newRow: any = {
          id: `row-${Date.now()}`,
          originalIndex: 0,
        }
        for (let i = 0; i < flow.columns.length; i++) {
          newRow[`col_${i}`] = ""
        }

        // Inherit parent heading if inserting among children
        const targetRow = rows[idx]
        if (targetRow.parentHeadingId) {
          newRow.parentHeadingId = targetRow.parentHeadingId
        }

        const insertIdx = position === "above" ? idx : idx + 1
        rows.splice(insertIdx, 0, newRow)

        // Re-index
        rows.forEach((r, i) => (r.originalIndex = i))

        const newChildren = rowDataToBoxes(rows, flow.columns)
        onUpdate({ children: newChildren })
        return rows
      })
    },
    [flow.columns, onUpdate],
  )

  /**
   * Delete a row (and unparent its children if it's a heading)
   */
  const deleteRow = useCallback(
    (rowId: string) => {
      setRowData((prev) => {
        const rows = prev.map((r) => ({ ...r }))
        const idx = rows.findIndex((r) => r.id === rowId)
        if (idx === -1) return prev

        // If deleting a heading, unparent its children
        if (rows[idx].isHeading) {
          for (let i = idx + 1; i < rows.length; i++) {
            if (rows[i].parentHeadingId === rowId) {
              rows[i].parentHeadingId = undefined
            } else if (rows[i].isHeading) {
              break
            }
          }
          setCollapsedHeadings((s) => {
            const next = new Set(s)
            next.delete(rowId)
            return next
          })
        }

        rows.splice(idx, 1)
        rows.forEach((r, i) => (r.originalIndex = i))

        const newChildren = rowDataToBoxes(rows, flow.columns)
        onUpdate({ children: newChildren })
        return rows
      })
    },
    [flow.columns, onUpdate],
  )

  /**
   * Collapse or expand all headings at once
   */
  const collapseAll = useCallback(() => {
    const headingIds = new Set(rowData.filter((r) => r.isHeading).map((r) => r.id))
    setCollapsedHeadings(headingIds)
    setTimeout(() => gridRef.current?.api?.onFilterChanged(), 0)
  }, [rowData])

  const expandAll = useCallback(() => {
    setCollapsedHeadings(new Set())
    setTimeout(() => gridRef.current?.api?.onFilterChanged(), 0)
  }, [])

  /**
   * Handle right-click context menu on cells
   */
  const onCellContextMenu = useCallback(
    (event: CellContextMenuEvent) => {
      const browserEvent = event.event as MouseEvent
      if (!browserEvent || !event.data) return
      browserEvent.preventDefault()
      setContextMenu({
        x: browserEvent.clientX,
        y: browserEvent.clientY,
        rowId: event.data.id,
      })
    },
    [],
  )

  /**
   * Build context menu items for a given row
   */
  const getContextMenuItems = useCallback(
    (rowId: string): ContextMenuEntry[] => {
      const row = rowData.find((r) => r.id === rowId)
      if (!row) return []

      const isHeading = row.isHeading
      const hasParent = !!row.parentHeadingId
      const hasAnyHeadings = rowData.some((r) => r.isHeading)

      // Can indent if not already a heading and there's a heading above
      const rowIdx = rowData.findIndex((r) => r.id === rowId)
      let canIndent = !isHeading && rowIdx > 0
      if (canIndent) {
        let foundHeading = false
        for (let i = rowIdx - 1; i >= 0; i--) {
          if (rowData[i].isHeading) { foundHeading = true; break }
        }
        canIndent = foundHeading && !hasParent
      }

      return [
        // Tree structure
        {
          label: isHeading ? "Remove Section Heading" : "Make Section Heading",
          onClick: () => toggleHeading(rowId),
        },
        {
          label: "Indent (Make Child)",
          onClick: () => indentRow(rowId),
          disabled: !canIndent,
        },
        {
          label: "Outdent (Make Top-Level)",
          onClick: () => outdentRow(rowId),
          disabled: !hasParent,
        },
        { separator: true as const },
        // Collapse/Expand
        {
          label: isHeading
            ? (collapsedHeadings.has(rowId) ? "Expand Section" : "Collapse Section")
            : "Collapse Section",
          onClick: () => isHeading && toggleCollapse(rowId),
          disabled: !isHeading,
        },
        {
          label: "Collapse All Sections",
          onClick: collapseAll,
          disabled: !hasAnyHeadings,
        },
        {
          label: "Expand All Sections",
          onClick: expandAll,
          disabled: !hasAnyHeadings || collapsedHeadings.size === 0,
        },
        { separator: true as const },
        // Row operations
        {
          label: "Insert Row Above",
          onClick: () => insertRow(rowId, "above"),
        },
        {
          label: "Insert Row Below",
          onClick: () => insertRow(rowId, "below"),
        },
        {
          label: "Delete Row",
          onClick: () => deleteRow(rowId),
          disabled: rowData.length <= 1,
        },
      ]
    },
    [rowData, collapsedHeadings, toggleHeading, indentRow, outdentRow, toggleCollapse, collapseAll, expandAll, insertRow, deleteRow],
  )

  /**
   * External filter: hide children of collapsed headings
   */
  const isExternalFilterPresent = useCallback(() => collapsedHeadings.size > 0, [collapsedHeadings])

  const doesExternalFilterPass = useCallback(
    (node: any) => {
      const data = node.data
      if (!data?.parentHeadingId) return true
      return !collapsedHeadings.has(data.parentHeadingId)
    },
    [collapsedHeadings],
  )

  /**
   * Generate column definitions for AG Grid
   * Includes team color coding and custom headers with speech icons
   */
  const columnDefs = useMemo<ColDef[]>(() => {
    return flow.columns.map((colName, idx) => {
      const hasN = colName.toUpperCase().includes("N")
      const hasA = colName.toUpperCase().includes("A")

      const colDef: ColDef = {
        field: `col_${idx}`,
        headerName: colName,
        editable: true,
        rowDrag: idx === 0,
        flex: 1,
        minWidth: 150,
        cellEditor: "agTextCellEditor",
        cellEditorParams: {
          maxLength: 1000,
        },
        wrapText: true,
        autoHeight: false,
        cellClass: hasN ? "text-red-500 dark:text-red-400" : hasA ? "text-blue-500 dark:text-blue-400" : "",
        headerComponent: FlowColumnHeader,
        headerComponentParams: {
          onOpenSpeechPanel,
        },
      }

      // First column gets the tree cell renderer
      if (idx === 0) {
        colDef.cellRenderer = FirstColumnCellRenderer
        colDef.cellRendererParams = {
          collapsedHeadings,
          onToggleCollapse: toggleCollapse,
        }
      }

      return colDef
    })
  }, [flow.columns, onOpenSpeechPanel, collapsedHeadings, toggleCollapse])

  /**
   * Default column settings
   */
  const defaultColDef = useMemo<ColDef>(
    () => ({
      editable: true,
      sortable: false,
      filter: false,
      resizable: true,
    }),
    [],
  )

  /**
   * Get unique row ID for AG Grid
   */
  const getRowId = useCallback((params: any) => params.data.id, [])

  /**
   * Handle cell value changes
   * Updates local state and syncs back to flow
   */
  const onCellValueChanged = useCallback(
    (event: CellValueChangedEvent) => {
      const { api } = event
      const allRows: any[] = []

      // Collect all rows from the grid
      api.forEachNode((node) => {
        if (node.data) {
          allRows.push(node.data)
        }
      })

      // Update local row data
      setRowData([...allRows])

      // Convert rows back to Box array and update flow
      const newChildren = rowDataToBoxes(allRows, flow.columns)
      onUpdate({ children: newChildren })
    },
    [flow.columns, onUpdate],
  )

  /**
   * Handle row drag end
   * Reorders rows and updates flow
   */
  const onRowDragEnd = useCallback(
    (event: RowDragEndEvent) => {
      const { api } = event
      const allRows: any[] = []
      let rowIndex = 0

      // Collect all rows in their new order
      api.forEachNode((node) => {
        if (node.data) {
          const updatedRow = {
            ...node.data,
            originalIndex: rowIndex++,
          }
          allRows.push(updatedRow)
        }
      })

      // Update row data
      setRowData([...allRows])

      // Convert rows back to Box array and update flow
      const newChildren = rowDataToBoxes(allRows, flow.columns)
      onUpdate({ children: newChildren })
    },
    [flow.columns, onUpdate],
  )

  /**
   * Handle grid ready event
   * Auto-sizes columns to fit container
   */
  const onGridReady = useCallback(
    (params: GridReadyEvent) => {
      params.api.sizeColumnsToFit()

      if (onGridReadyProp) {
        onGridReadyProp(params.api)
      }
    },
    [onGridReadyProp],
  )

  /**
   * Navigate to previous column (for mobile navigation)
   */
  const scrollToPreviousColumn = useCallback(() => {
    if (!gridRef.current || currentColumnIndex === 0) return

    const newIndex = currentColumnIndex - 1
    setCurrentColumnIndex(newIndex)

    const columnId = newIndex === 0 ? "ag-Grid-AutoColumn" : `col_${newIndex}`
    gridRef.current.api.ensureColumnVisible(columnId)
  }, [currentColumnIndex])

  /**
   * Navigate to next column (for mobile navigation)
   */
  const scrollToNextColumn = useCallback(() => {
    if (!gridRef.current || currentColumnIndex >= flow.columns.length - 1) return

    const newIndex = currentColumnIndex + 1
    setCurrentColumnIndex(newIndex)

    const columnId = `col_${newIndex}`
    gridRef.current.api.ensureColumnVisible(columnId)
  }, [currentColumnIndex, flow.columns.length])

  /**
   * Handle keyboard navigation for Excel-like editing experience
   * Arrow keys move between cells while editing
   */
  const onCellKeyDown = useCallback(
    (event: CellKeyDownEvent) => {
      const { event: keyEvent, node, api, column } = event

      if (!(keyEvent instanceof KeyboardEvent)) return

      const key = keyEvent.key
      const isArrow = key === "ArrowUp" || key === "ArrowDown" || key === "ArrowLeft" || key === "ArrowRight"

      // Handle Excel-style arrow key navigation while editing
      if (isArrow && node && column) {
        const editingCells = api.getEditingCells()
        const isEditing = editingCells.length > 0

        if (isEditing) {
          keyEvent.preventDefault()
          keyEvent.stopPropagation()

          const rowIndex = node.rowIndex
          const colId = column.getColId()

          // Commit current edit
          api.stopEditing()

          // Compute next cell position
          let nextRow = rowIndex
          let nextCol = colId

          if (key === "ArrowDown") {
            const nextNode = api.getDisplayedRowAtIndex(rowIndex! + 1)
            if (nextNode) nextRow = rowIndex! + 1
          }
          if (key === "ArrowUp") {
            if (rowIndex! > 0) nextRow = rowIndex! - 1
          }
          if (key === "ArrowRight") {
            const allCols = api.getAllDisplayedColumns()
            const currentIdx = allCols.findIndex((c) => c.getColId() === colId)
            if (currentIdx >= 0 && currentIdx < allCols.length - 1) {
              nextCol = allCols[currentIdx + 1].getColId()
            }
          }
          if (key === "ArrowLeft") {
            const allCols = api.getAllDisplayedColumns()
            const currentIdx = allCols.findIndex((c) => c.getColId() === colId)
            if (currentIdx > 0) {
              nextCol = allCols[currentIdx - 1].getColId()
            }
          }

          // Move focus to next cell
          api.setFocusedCell(nextRow!, nextCol)

          // Auto-start editing the next cell
          api.startEditingCell({
            rowIndex: nextRow!,
            colKey: nextCol,
          })

          return
        }
      }
    },
    [flow.columns, onUpdate],
  )

  return (
    <div className="w-full h-full flex flex-col">
      {/* AG Grid spreadsheet */}
      <div className="flex-1">
        <AgGridReact
          theme={themeQuartz}
          ref={gridRef}
          rowData={rowData}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          getRowId={getRowId}
          onCellValueChanged={onCellValueChanged}
          onRowDragEnd={onRowDragEnd}
          onGridReady={onGridReady}
          onCellKeyDown={onCellKeyDown}
          onCellContextMenu={onCellContextMenu}
          isExternalFilterPresent={isExternalFilterPresent}
          doesExternalFilterPass={doesExternalFilterPass}
          rowHeight={40}
          headerHeight={36}
          rowDragManaged={true}
          suppressMoveWhenRowDragging={true}
          enterNavigatesVertically={true}
          enterNavigatesVerticallyAfterEdit={true}
          suppressMovableColumns={true}
          suppressCellFocus={false}
          singleClickEdit={true}
          stopEditingWhenCellsLoseFocus={true}
          suppressHorizontalScroll={false}
          domLayout="normal"
          rowSelection="single"
          undoRedoCellEditing={true}
          undoRedoCellEditingLimit={50}
          preventDefaultOnContextMenu={true}
        />
      </div>

      {/* Custom right-click context menu */}
      {contextMenu && (
        <GridContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={getContextMenuItems(contextMenu.rowId)}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  )
}
