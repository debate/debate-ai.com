/**
 * @fileoverview Column navigation for spreadsheet view
 * @module components/debate/core/hooks/useColumnNavigation
 */

import { useCallback } from "react"

/**
 * Hook for column navigation in AG Grid
 *
 * @param gridApiRef - Reference to AG Grid API
 * @returns Navigation handler functions
 */
export function useColumnNavigation(gridApiRef: React.RefObject<any>) {
  /**
   * Navigate to previous column
   */
  const navigatePreviousColumn = useCallback(() => {
    const gridApi = gridApiRef.current
    if (!gridApi) return

    const allCols = gridApi.getAllDisplayedColumns()
    const focusedCell = gridApi.getFocusedCell()

    if (focusedCell?.column) {
      const currentIdx = allCols.findIndex((c: any) => c.getColId() === focusedCell.column.getColId())
      if (currentIdx > 0) {
        const prevCol = allCols[currentIdx - 1]
        gridApi.ensureColumnVisible(prevCol.getColId())
        gridApi.setFocusedCell(focusedCell.rowIndex, prevCol.getColId())
      }
    }
  }, [gridApiRef])

  /**
   * Navigate to next column
   */
  const navigateNextColumn = useCallback(() => {
    const gridApi = gridApiRef.current
    if (!gridApi) return

    const allCols = gridApi.getAllDisplayedColumns()
    const focusedCell = gridApi.getFocusedCell()

    if (focusedCell?.column) {
      const currentIdx = allCols.findIndex((c: any) => c.getColId() === focusedCell.column.getColId())
      if (currentIdx < allCols.length - 1) {
        const nextCol = allCols[currentIdx + 1]
        gridApi.ensureColumnVisible(nextCol.getColId())
        gridApi.setFocusedCell(focusedCell.rowIndex, nextCol.getColId())
      }
    }
  }, [gridApiRef])

  return {
    navigatePreviousColumn,
    navigateNextColumn,
  }
}
