/**
 * @fileoverview Type definitions for Flow spreadsheet components
 */

import type { IHeaderParams, ICellRendererParams } from "ag-grid-community"
import type { EvidenceLibraryEntry } from "debate-card-search/src/lib/shared-evidence-library"
import type { Flow } from "debate-core/src/types/flow"
import type { FlowAnnotation } from "./flow-annotations"

/**
 * Where and for which box an `EditBadge` click should open the
 * `EditReviewPopover` overlay — `x`/`y` mirror `GridContextMenu`'s
 * click-position overlay pattern, since an AG Grid cell clips normal
 * in-flow content.
 */
export interface EditReviewOpenParams {
  x: number
  y: number
  boxPath: number[]
  currentContent: string
}

/**
 * Props for the FlowSpreadsheet component
 */
export interface FlowSpreadsheetProps {
  /** The flow data to display */
  flow: Flow
  /** Callback when flow data is updated */
  onUpdate: (updates: Partial<Flow>) => void
  /** Optional callback to open speech document panel */
  onOpenSpeechPanel?: (speechName: string) => void
  /** Optional callback when grid is ready */
  onGridReady?: (api: any) => void
  /** Shared Evidence Library entries to rank/suggest in the edit-review popover; defaults to none. */
  evidenceEntries?: EvidenceLibraryEntry[]
}

/**
 * Props for the FlowColumnHeader component
 */
export interface FlowColumnHeaderProps extends IHeaderParams {
  onOpenSpeechPanel?: (speechName: string) => void
}

/**
 * Props for the FirstColumnCellRenderer component
 */
export interface FirstColumnCellRendererProps extends ICellRendererParams {
  collapsedHeadings: Set<string>
  onToggleCollapse: (rowId: string) => void
  flowId: number
  onJumpToAnnotation: (annotation: FlowAnnotation) => void
  onOpenEditReview: (params: EditReviewOpenParams) => void
}

/**
 * Props for the `AnnotationCellRenderer` component, used on every
 * `FlowSpreadsheet` column after the first to show an `AnnotationBadge`
 * and `EditBadge` alongside the cell's plain text value.
 */
export interface AnnotationCellRendererProps extends ICellRendererParams {
  flowId: number
  onJumpToAnnotation: (annotation: FlowAnnotation) => void
  onOpenEditReview: (params: EditReviewOpenParams) => void
}

/**
 * A single item in the context menu
 */
export interface ContextMenuItem {
  label: string
  onClick: () => void
  disabled?: boolean
  separator?: false
}

export interface ContextMenuSeparator {
  separator: true
}

export type ContextMenuEntry = ContextMenuItem | ContextMenuSeparator

/**
 * Props for the GridContextMenu component
 */
export interface GridContextMenuProps {
  x: number
  y: number
  items: ContextMenuEntry[]
  onClose: () => void
}
