/**
 * @fileoverview Type definitions for Flow spreadsheet components
 */

import type { IHeaderParams, ICellRendererParams } from "ag-grid-community"
import type { Flow } from "../types"

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
