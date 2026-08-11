/**
 * @fileoverview AG Grid-powered spreadsheet interface for debate flowing.
 */

"use client"

import { useMemo, useCallback, useRef, useState, useEffect } from "react"
import { AgGridReact } from "ag-grid-react"
import { AllCommunityModule, ModuleRegistry, themeQuartz } from "ag-grid-community"
import type {
  CellValueChangedEvent,
  GridReadyEvent,
  CellKeyDownEvent,
  RowDragEndEvent,
  CellContextMenuEvent,
} from "ag-grid-community"
import type { FlowSpreadsheetProps, ContextMenuEntry } from "./types"
import { buildRowData, rowDataToBoxes } from "./dataTransform"
import { GridContextMenu } from "./GridContextMenu"
import { useFlowGridConfig } from "./useFlowGridConfig"
import { useFlowRowOperations } from "./useFlowRowOperations"

// Register AG Grid community modules
ModuleRegistry.registerModules([AllCommunityModule])

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

  // Row operations hook
  const { toggleHeading, indentRow, outdentRow, insertRow, deleteRow } = useFlowRowOperations(
    flow,
    onUpdate,
    setRowData,
    setCollapsedHeadings,
  )

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

  // Grid configuration hook
  const { columnDefs, defaultColDef, getRowId } = useFlowGridConfig(
    flow,
    onOpenSpeechPanel,
    collapsedHeadings,
    toggleCollapse,
  )

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
   * Enter key on mobile moves to cell below and inserts a space
   */
  const onCellKeyDown = useCallback(
    (event: CellKeyDownEvent) => {
      const { event: keyEvent, node, api, column } = event

      if (!(keyEvent instanceof KeyboardEvent)) return

      const key = keyEvent.key
      const isArrow = key === "ArrowUp" || key === "ArrowDown" || key === "ArrowLeft" || key === "ArrowRight"

      // Handle Enter key on mobile - move to cell below and insert space
      if (key === "Enter" && isMobile && node && column) {
        const editingCells = api.getEditingCells()
        const isEditing = editingCells.length > 0

        if (isEditing) {
          keyEvent.preventDefault()
          keyEvent.stopPropagation()

          const rowIndex = node.rowIndex
          const colId = column.getColId()

          // Commit current edit
          api.stopEditing()

          // Check if there's a next row
          const nextNode = api.getDisplayedRowAtIndex(rowIndex! + 1)
          if (nextNode) {
            const nextRow = rowIndex! + 1

            // Move focus to next cell
            api.setFocusedCell(nextRow, colId)

            // Get current value of the cell below
            const currentValue = nextNode.data?.[colId] || ""

            // Set the cell value to start with a space if it's empty or doesn't start with one
            if (!currentValue.startsWith(" ")) {
              nextNode.setDataValue(colId, " " + currentValue)
            }

            // Start editing the next cell with the space already inserted
            setTimeout(() => {
              api.startEditingCell({
                rowIndex: nextRow,
                colKey: colId,
              })

              // Explicitly show the virtual keyboard on mobile
              setTimeout(() => {
                // Try using VirtualKeyboard API if available
                if ("virtualKeyboard" in navigator) {
                  try {
                    ;(navigator as any).virtualKeyboard.show()
                  } catch (e) {
                    // Fallback: focus will trigger keyboard automatically
                    console.debug("VirtualKeyboard API not supported or failed")
                  }
                }
              }, 50)
            }, 0)
          }

          return
        }
      }

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
    [flow.columns, onUpdate, isMobile],
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
