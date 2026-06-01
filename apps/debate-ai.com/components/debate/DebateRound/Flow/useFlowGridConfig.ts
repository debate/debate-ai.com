/**
 * @fileoverview Hook for AG Grid configuration in Flow spreadsheet
 */

import { useMemo, useCallback } from "react"
import type { ColDef } from "ag-grid-community"
import type { Flow } from "../types"
import { FlowColumnHeader } from "./FlowColumnHeader"
import { FirstColumnCellRenderer } from "./FirstColumnCellRenderer"

/**
 * Hook providing AG Grid column configuration for Flow spreadsheet
 */
export function useFlowGridConfig(
  flow: Flow,
  onOpenSpeechPanel?: (speechName: string) => void,
  collapsedHeadings?: Set<string>,
  toggleCollapse?: (rowId: string) => void,
) {
  /**
   * Generate column definitions for AG Grid
   * Includes team color coding and custom headers with speech icons
   */
  const columnDefs = useMemo<ColDef[]>(() => {
    return flow.columns.map((colName: string, idx: number) => {
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
      if (idx === 0 && collapsedHeadings && toggleCollapse) {
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

  return {
    columnDefs,
    defaultColDef,
    getRowId,
  }
}
