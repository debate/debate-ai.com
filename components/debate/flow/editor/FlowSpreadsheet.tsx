"use client"

/**
 * @fileoverview Flow Spreadsheet Component
 *
 * An AG Grid-powered spreadsheet interface for debate flowing.
 * Provides a familiar Excel-like experience for taking notes during debates.
 *
 * Features:
 * - Column-based layout matching speech structure
 * - Row dragging for reordering arguments
 * - Excel-style arrow key navigation while editing
 * - Auto-sizing columns
 * - Speech document quick access via column headers
 *
 * @module components/debate/flow/editor/FlowSpreadsheet
 */

import type React from "react"
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
} from "ag-grid-community"
import { FileText } from "lucide-react"

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
 * Custom header component with speech document icon
 * Displays column name with team color coding (Aff=blue, Neg=red)
 */
const CustomHeader = (props: IHeaderParams & { onOpenSpeechPanel?: (speechName: string) => void }) => {
  /**
   * Handle click on speech document icon
   */
  const handleSpeechClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (props.onOpenSpeechPanel && props.displayName) {
      props.onOpenSpeechPanel(props.displayName)
    }
  }

  // Determine team color based on column name
  const hasN = props.displayName?.toUpperCase().includes("N")
  const hasA = props.displayName?.toUpperCase().includes("A")
  const textColorClass = hasN ? "text-red-600 dark:text-red-400" : hasA ? "text-blue-600 dark:text-blue-400" : ""

  return (
    <div className="flex items-center justify-between w-full h-full">
      <span className={`flex-1 truncate ${textColorClass}`}>{props.displayName}</span>
      <button
        onClick={handleSpeechClick}
        className="ml-1 p-0.5 hover:bg-accent rounded transition-colors flex-shrink-0"
        title={`Open ${props.displayName} speech document`}
      >
        <FileText className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
      </button>
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
    }

    // Flatten box chain into column values
    let current: Box | undefined = box
    for (let i = 0; i < depth; i++) {
      row[`col_${i}`] = current?.content ?? ""
      current = current?.children?.[0]
    }

    rows.push(row)
  })

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

  // Initialize row data from flow
  const [rowData, setRowData] = useState<any[]>(() => buildRowData(flow.children, flow.columns))

  /**
   * Update row data when flow children change externally
   */
  useEffect(() => {
    setRowData(buildRowData(flow.children, flow.columns))
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
   * Generate column definitions for AG Grid
   * Includes team color coding and custom headers with speech icons
   */
  const columnDefs = useMemo<ColDef[]>(() => {
    return flow.columns.map((colName, idx) => {
      const hasN = colName.toUpperCase().includes("N")
      const hasA = colName.toUpperCase().includes("A")

      return {
        field: `col_${idx}`,
        headerName: colName,
        editable: true,
        rowDrag: idx === 0, // Only first column has row drag handle
        flex: 1,
        minWidth: 100,
        cellEditor: "agTextCellEditor",
        cellEditorParams: {
          maxLength: 1000,
        },
        wrapText: true,
        autoHeight: false,
        cellClass: hasN ? "text-red-500 dark:text-red-400" : hasA ? "text-blue-500 dark:text-blue-400" : "",
        headerComponent: CustomHeader,
        headerComponentParams: {
          onOpenSpeechPanel,
        },
      }
    })
  }, [flow.columns, onOpenSpeechPanel])

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
          rowHeight={40}
          headerHeight={40}
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
        />
      </div>
    </div>
  )
}
