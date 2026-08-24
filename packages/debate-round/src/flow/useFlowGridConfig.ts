/**
 * @fileoverview Hook for AG Grid configuration in Flow spreadsheet
 */

import { useMemo, useCallback } from "react"
import type { ColDef } from "ag-grid-community"
import type { Flow } from "debate-core/src/types/flow"
import { AnnotationCellRenderer } from "./AnnotationCellRenderer"
import { FlowColumnHeader } from "./FlowColumnHeader"
import { FirstColumnCellRenderer } from "./FirstColumnCellRenderer"
import type { FlowAnnotation } from "./flow-annotations"
import type { EditReviewOpenParams, PrepNoteOpenParams } from "./types"

/**
 * Hook providing AG Grid column configuration for Flow spreadsheet
 */
export function useFlowGridConfig(
  flow: Flow,
  onOpenSpeechPanel?: (speechName: string) => void,
  collapsedHeadings?: Set<string>,
  toggleCollapse?: (rowId: string) => void,
  onJumpToAnnotation?: (annotation: FlowAnnotation) => void,
  onOpenEditReview?: (params: EditReviewOpenParams) => void,
  onOpenPrepNote?: (params: PrepNoteOpenParams) => void,
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

      // First column gets the tree cell renderer; every other column gets the
      // plain annotation-aware renderer. Both surface an `AnnotationBadge`
      // for a cell whose box has a persisted `FlowAnnotation`, an
      // `EditBadge` for logging or reviewing that box's `FlowEdit`s, and a
      // `PrepNoteBadge` for creating or reviewing that box's `PrepNote`s.
      if (
        idx === 0 &&
        collapsedHeadings &&
        toggleCollapse &&
        onJumpToAnnotation &&
        onOpenEditReview &&
        onOpenPrepNote
      ) {
        colDef.cellRenderer = FirstColumnCellRenderer
        colDef.cellRendererParams = {
          collapsedHeadings,
          onToggleCollapse: toggleCollapse,
          flowId: flow.id,
          onJumpToAnnotation,
          onOpenEditReview,
          onOpenPrepNote,
        }
      } else if (idx > 0 && onJumpToAnnotation && onOpenEditReview && onOpenPrepNote) {
        colDef.cellRenderer = AnnotationCellRenderer
        colDef.cellRendererParams = {
          flowId: flow.id,
          onJumpToAnnotation,
          onOpenEditReview,
          onOpenPrepNote,
        }
      }

      return colDef
    })
  }, [
    flow.columns,
    flow.id,
    onOpenSpeechPanel,
    collapsedHeadings,
    toggleCollapse,
    onJumpToAnnotation,
    onOpenEditReview,
    onOpenPrepNote,
  ])

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
