/**
 * @fileoverview Custom hooks for Flow spreadsheet row operations
 */

import { useCallback } from "react"
import { rowDataToBoxes } from "./dataTransform"
import type { Flow } from "../types"

/**
 * Hook providing row manipulation operations for the Flow spreadsheet
 */
export function useFlowRowOperations(
  flow: Flow,
  onUpdate: (updates: Partial<Flow>) => void,
  setRowData: React.Dispatch<React.SetStateAction<any[]>>,
  setCollapsedHeadings: React.Dispatch<React.SetStateAction<Set<string>>>,
) {
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
    [flow.columns, onUpdate, setCollapsedHeadings],
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
    [flow.columns, onUpdate, setCollapsedHeadings],
  )

  return {
    toggleHeading,
    indentRow,
    outdentRow,
    insertRow,
    deleteRow,
  }
}
