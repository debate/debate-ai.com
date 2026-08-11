/**
 * @fileoverview Column navigation for spreadsheet view
 * @module components/debate/flow/hooks/useColumnNavigation
 */

import { useCallback } from "react"

/**
 * Hook that provides keyboard-style column navigation for an AG Grid instance.
 * Uses the grid API to move focus one column at a time, scrolling the column
 * into view if necessary.
 *
 * @param gridApiRef - React ref whose `.current` holds the AG Grid API instance
 * @returns Object containing `navigatePreviousColumn` and `navigateNextColumn` handlers
 */
export function useColumnNavigation(gridApiRef: React.RefObject<any>) {
  /**
   * Move grid focus to the column immediately to the left of the currently focused cell.
   * Does nothing if no cell is focused or the focused cell is already in the first column.
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
   * Move grid focus to the column immediately to the right of the currently focused cell.
   * Does nothing if no cell is focused or the focused cell is already in the last column.
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
