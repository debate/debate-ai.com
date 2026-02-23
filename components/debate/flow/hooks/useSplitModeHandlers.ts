/**
 * @fileoverview Handlers for split view mode
 * @module components/debate/flow/hooks/useSplitModeHandlers
 */

import { useCallback, useState } from "react"

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
   * Reset panel indices to the first two columns of the selected flow.
   * Should be called when the user first enters split mode.
   */
  const initializeSplitMode = useCallback(() => {
    if (flows[selected]?.columns) {
      setLeftSpeechIndex(0)
      setRightSpeechIndex(Math.min(1, flows[selected].columns.length - 1))
    }
  }, [flows, selected])

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

  return {
    leftSpeechIndex,
    rightSpeechIndex,
    initializeSplitMode,
    handlePreviousSpeeches,
    handleNextSpeeches,
    handleUpdateLeftSpeech,
    handleUpdateRightSpeech,
    getLeftSpeech,
    getRightSpeech,
    canNavigatePrev,
    canNavigateNext,
  }
}
