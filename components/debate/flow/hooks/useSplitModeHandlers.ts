/**
 * @fileoverview Handlers for split view mode
 * @module components/debate/core/hooks/useSplitModeHandlers
 */

import { useCallback, useState } from "react"

/**
 * Hook for split mode handlers and state
 *
 * @param flows - Current flows array
 * @param selected - Selected flow index
 * @param updateFlow - Function to update a flow
 * @returns Split mode handlers and state
 */
export function useSplitModeHandlers(
  flows: Flow[],
  selected: number,
  updateFlow: (index: number, updates: Partial<Flow>) => void,
) {
  const [leftSpeechIndex, setLeftSpeechIndex] = useState(0)
  const [rightSpeechIndex, setRightSpeechIndex] = useState(1)

  /**
   * Initialize speech indices when entering split mode
   */
  const initializeSplitMode = useCallback(() => {
    if (flows[selected]?.columns) {
      setLeftSpeechIndex(0)
      setRightSpeechIndex(Math.min(1, flows[selected].columns.length - 1))
    }
  }, [flows, selected])

  /**
   * Navigate to previous speech pair
   */
  const handlePreviousSpeeches = useCallback(() => {
    if (leftSpeechIndex > 0) {
      setLeftSpeechIndex((prev) => prev - 1)
      setRightSpeechIndex((prev) => prev - 1)
    }
  }, [leftSpeechIndex])

  /**
   * Navigate to next speech pair
   */
  const handleNextSpeeches = useCallback(() => {
    if (flows[selected] && rightSpeechIndex < flows[selected].columns.length - 1) {
      setLeftSpeechIndex((prev) => prev + 1)
      setRightSpeechIndex((prev) => prev + 1)
    }
  }, [flows, selected, rightSpeechIndex])

  /**
   * Update left panel speech content
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
   * Update right panel speech content
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
   * Get speech names for current indices
   */
  const getLeftSpeech = useCallback(() => {
    return flows[selected]?.columns[leftSpeechIndex] || ""
  }, [flows, selected, leftSpeechIndex])

  const getRightSpeech = useCallback(() => {
    return flows[selected]?.columns[rightSpeechIndex] || ""
  }, [flows, selected, rightSpeechIndex])

  /**
   * Check if navigation is possible
   */
  const canNavigatePrev = leftSpeechIndex > 0
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
