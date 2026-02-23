/**
 * @fileoverview Handlers for speech document operations
 * @module components/debate/flow/hooks/useSpeechHandlers
 */

import { useCallback } from "react"
import { shareSpeech } from "@/app/actions"

/**
 * Hook for speech document handlers
 *
 * @param flows - Current flows array
 * @param selected - Selected flow index
 * @param selectedSpeech - Selected speech name
 * @param updateFlow - Function to update a flow
 * @returns Speech handler functions
 */
export function useSpeechHandlers(
  flows: Flow[],
  selected: number,
  selectedSpeech: string,
  updateFlow: (index: number, updates: Partial<Flow>) => void,
) {
  /**
   * Update speech document content
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
   * Share or unshare speech with round participants
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
