/**
 * @fileoverview Handlers for speech document operations
 * @module components/debate/flow/hooks/useSpeechHandlers
 */

import { useCallback } from "react"
import { shareSpeech } from "@/app/actions"

/**
 * Hook that provides memoized handlers for editing and sharing speech documents.
 *
 * @param flows - Current flows array
 * @param selected - Index of the currently selected flow within the flows array
 * @param selectedSpeech - Name of the currently selected speech document
 * @param updateFlow - Callback to apply partial updates to a flow at a given index
 * @returns Object containing `handleUpdateSpeechDoc` and `handleShareSpeech` handlers
 */
export function useSpeechHandlers(
  flows: Flow[],
  selected: number,
  selectedSpeech: string,
  updateFlow: (index: number, updates: Partial<Flow>) => void,
) {
  /**
   * Persist new markdown content for the currently selected speech document.
   *
   * @param content - Updated markdown string for the speech document
   */
  const handleUpdateSpeechDoc = useCallback(
    (content: string) => {
      if (flows[selected]) {
        const speechDocs = { ...flows[selected].speechDocs, [selectedSpeech]: content }
        updateFlow(selected, { speechDocs })
      }
    },
    [flows, selected, selectedSpeech, updateFlow],
  )

  /**
   * Toggle the shared state of the currently selected speech document.
   * If already shared, removes it from `sharedSpeeches`.
   * If not shared, calls the server action to distribute it and records the share metadata.
   */
  const handleShareSpeech = useCallback(async () => {
    if (!flows[selected]) return

    const currentFlow = flows[selected]
    const isCurrentlyShared = currentFlow.sharedSpeeches?.[selectedSpeech] || false

    if (isCurrentlyShared) {
      // Unshare
      const sharedSpeeches = { ...currentFlow.sharedSpeeches }
      delete sharedSpeeches[selectedSpeech]
      updateFlow(selected, { sharedSpeeches })
    } else {
      // Share
      const speechContent = currentFlow.speechDocs?.[selectedSpeech] || ""
      if (!speechContent.trim()) {
        alert("Cannot share empty speech document")
        return
      }

      try {
        // TODO: Get actual participant emails from round data
        const participantEmails: string[] = []
        await shareSpeech(participantEmails, selectedSpeech, speechContent)

        const sharedSpeeches = {
          ...currentFlow.sharedSpeeches,
          [selectedSpeech]: {
            timestamp: Date.now(),
            emails: participantEmails,
          },
        }
        updateFlow(selected, { sharedSpeeches })
      } catch (error) {
        console.error("Failed to share speech:", error)
        alert("Failed to share speech. Please try again.")
      }
    }
  }, [flows, selected, selectedSpeech, updateFlow])

  return {
    handleUpdateSpeechDoc,
    handleShareSpeech,
  }
}
