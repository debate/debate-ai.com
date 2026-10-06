/**
 * @fileoverview Handlers for split view mode
 * @module components/debate/flow/hooks/useSplitModeHandlers
 */

import { useCallback, useState } from "react"
import type { Flow } from "../types/flow"

/**
 * Hook that manages split-view state and provides handlers for navigating
 * and editing two speech documents side-by-side.
 *
 * @param flows - Current flows array
 * @param selected - Index of the currently selected flow within the flows array
 * @param updateFlow - Callback to apply partial updates to a flow at a given index
 * @returns Split mode indices, navigation handlers, content updaters, name getters, and boundary flags
 */
export function useSplitModeHandlers(
  flows: Flow[],
  selected: number,
  updateFlow: (index: number, updates: Partial<Flow>) => void,
) {
  /** Zero-based column index displayed in the left panel. */
  const [leftSpeechIndex, setLeftSpeechIndex] = useState(0)
  /** Zero-based column index displayed in the right panel. */
  const [rightSpeechIndex, setRightSpeechIndex] = useState(1)

  /**
   * Shift both panels one column to the left, if the left panel is not already at index 0.
   */
  const handlePreviousSpeeches = useCallback(() => {
    if (leftSpeechIndex > 0) {
      setLeftSpeechIndex((prev) => prev - 1)
      setRightSpeechIndex((prev) => prev - 1)
    }
  }, [leftSpeechIndex])

  /**
   * Shift both panels one column to the right, if the right panel has not reached the last column.
   */
  const handleNextSpeeches = useCallback(() => {
    if (flows[selected] && rightSpeechIndex < flows[selected].columns.length - 1) {
      setLeftSpeechIndex((prev) => prev + 1)
      setRightSpeechIndex((prev) => prev + 1)
    }
  }, [flows, selected, rightSpeechIndex])

  /**
   * Move the left panel one column back (mobile single-speech navigation).
   */
  const handlePreviousSingle = useCallback(() => {
    if (leftSpeechIndex > 0) {
      setLeftSpeechIndex((prev) => prev - 1)
    }
  }, [leftSpeechIndex])

  /**
   * Move the left panel one column forward (mobile single-speech navigation).
   */
  const handleNextSingle = useCallback(() => {
    if (flows[selected] && leftSpeechIndex < flows[selected].columns.length - 1) {
      setLeftSpeechIndex((prev) => prev + 1)
    }
  }, [flows, selected, leftSpeechIndex])

  /**
   * Bring a speech into view by name (matched case-insensitively against the
   * flow's columns) — the sidebar's round group calls this when a speech
   * that isn't the active one is clicked.
   *
   * With one pane, the left panel jumps to it. With both panes shown, a
   * speech already in a pane just becomes the active side; otherwise the
   * pair shifts so it lands on the left (or the right, for the last column).
   *
   * @param speechName - Column name to show, e.g. "1NC"
   * @param bothPanes - Whether both split panes are shown side-by-side
   * @returns The pane the speech is now in, or null if no column matches
   */
  const showSpeech = useCallback(
    (speechName: string, bothPanes: boolean): "left" | "right" | null => {
      const columns = flows[selected]?.columns ?? []
      const index = columns.findIndex((c) => c.toUpperCase() === speechName.toUpperCase())
      if (index < 0) return null
      if (!bothPanes) {
        setLeftSpeechIndex(index)
        return "left"
      }
      if (index === leftSpeechIndex) return "left"
      if (index === rightSpeechIndex) return "right"
      if (index < columns.length - 1) {
        setLeftSpeechIndex(index)
        setRightSpeechIndex(index + 1)
        return "left"
      }
      setLeftSpeechIndex(Math.max(0, index - 1))
      setRightSpeechIndex(index)
      return index > 0 ? "right" : "left"
    },
    [flows, selected, leftSpeechIndex, rightSpeechIndex],
  )

  /**
   * Persist updated markdown content for the speech shown in the left panel.
   *
   * @param content - Updated markdown string for the left panel speech document
   */
  const handleUpdateLeftSpeech = useCallback(
    (content: string) => {
      if (flows[selected]) {
        const speechName = flows[selected].columns[leftSpeechIndex]
        const speechDocs = { ...flows[selected].speechDocs, [speechName]: content }
        updateFlow(selected, { speechDocs })
      }
    },
    [flows, selected, leftSpeechIndex, updateFlow],
  )

  /**
   * Persist updated markdown content for the speech shown in the right panel.
   *
   * @param content - Updated markdown string for the right panel speech document
   */
  const handleUpdateRightSpeech = useCallback(
    (content: string) => {
      if (flows[selected]) {
        const speechName = flows[selected].columns[rightSpeechIndex]
        const speechDocs = { ...flows[selected].speechDocs, [speechName]: content }
        updateFlow(selected, { speechDocs })
      }
    },
    [flows, selected, rightSpeechIndex, updateFlow],
  )

  /**
   * Return the column name for the speech currently shown in the left panel.
   *
   * @returns The column name string, or an empty string if no flow is selected
   */
  const getLeftSpeech = useCallback(() => {
    return flows[selected]?.columns[leftSpeechIndex] || ""
  }, [flows, selected, leftSpeechIndex])

  /**
   * Return the column name for the speech currently shown in the right panel.
   *
   * @returns The column name string, or an empty string if no flow is selected
   */
  const getRightSpeech = useCallback(() => {
    return flows[selected]?.columns[rightSpeechIndex] || ""
  }, [flows, selected, rightSpeechIndex])

  /** Whether the left panel can move further left (i.e. is not at the first column). */
  const canNavigatePrev = leftSpeechIndex > 0
  /** Whether the right panel can move further right (i.e. is not at the last column). */
  const canNavigateNext = flows[selected] ? rightSpeechIndex < flows[selected].columns.length - 1 : false
  /** Whether single-speech navigation can go forward (mobile). */
  const canNavigateNextSingle = flows[selected] ? leftSpeechIndex < flows[selected].columns.length - 1 : false

  return {
    leftSpeechIndex,
    rightSpeechIndex,
    handlePreviousSpeeches,
    handleNextSpeeches,
    handlePreviousSingle,
    handleNextSingle,
    showSpeech,
    handleUpdateLeftSpeech,
    handleUpdateRightSpeech,
    getLeftSpeech,
    getRightSpeech,
    canNavigatePrev,
    canNavigateNext,
    canNavigateNextSingle,
  }
}
