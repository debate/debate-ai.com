/**
 * @fileoverview Side effects for flow page initialization and persistence
 * @module components/debate/flow/hooks/useFlowEffects
 */

import { useEffect } from "react"
import { settings } from "@/lib/state/settings"
import { cleanupOldSpeechDocs, getStorageInfo } from "@/lib/utils/storage-utils"

/**
 * Initialize settings and load saved data from localStorage
 *
 * @param setFlows - Function to set flows state
 * @param setRounds - Function to set rounds state
 */
export function useInitialLoad(setFlows: (flows: Flow[]) => void, setRounds: (rounds: Round[]) => void) {
  useEffect(() => {
    settings.init()

    // Load saved flows
    const savedFlows = localStorage.getItem("flows")
    if (savedFlows) {
      try {
        const parsed = JSON.parse(savedFlows)
        setFlows(parsed)

        const flowIds = parsed.map((f: Flow) => f.id)
        cleanupOldSpeechDocs(flowIds)

        if (process.env.NODE_ENV === "development") {
          const storageInfo = getStorageInfo()
          if (storageInfo.isNearLimit) {
            console.warn(`⚠️ Storage usage is ${storageInfo.percentUsed.toFixed(1)}% (${storageInfo.totalFormatted})`)
          }
        }
      } catch (e) {
        console.error("Failed to load flows:", e)
      }
    }

    // Load saved rounds
    const savedRounds = localStorage.getItem("rounds")
    if (savedRounds) {
      try {
        const parsed = JSON.parse(savedRounds)
        setRounds(parsed)
      } catch (e) {
        console.error("Failed to load rounds:", e)
      }
    }
  }, [setFlows, setRounds])
}

/**
 * Apply font size settings from user preferences
 */
export function useFontSizeSettings() {
  useEffect(() => {
    const applyFontSize = () => {
      const fontSizeSetting = settings.data.fontSize
      if (fontSizeSetting && fontSizeSetting.type === "radio") {
        const nav = fontSizeSetting as any
        const options = nav.detail.options
        const index = nav.value as number
        if (options && options[index]) {
          document.documentElement.style.setProperty("--font-size", options[index])
        }
      }
    }

    applyFontSize()
    const unsubscribe = settings.subscribe(["fontSize"], applyFontSize)
    return unsubscribe
  }, [])
}

/**
 * Persist flows to localStorage with quota management
 *
 * @param flows - Current flows array
 * @param setFlows - Function to update flows
 */
export function useFlowPersistence(flows: Flow[], setFlows: (flows: Flow[]) => void) {
  useEffect(() => {
    if (flows.length === 0) return

    // Proactive cleanup: limit archived flows
    const MAX_ARCHIVED_FLOWS = 10
    const activeFlows = flows.filter((f) => !f.archived)
    const archivedFlows = flows.filter((f) => f.archived)

    let flowsToSave = flows
    if (archivedFlows.length > MAX_ARCHIVED_FLOWS) {
      const sortedArchived = [...archivedFlows].sort((a, b) => b.id - a.id)
      const recentArchived = sortedArchived.slice(0, MAX_ARCHIVED_FLOWS)
      flowsToSave = [...activeFlows, ...recentArchived]

      flowsToSave.forEach((flow, idx) => {
        flow.index = idx
      })

      console.log(
        `Automatically removed ${archivedFlows.length - MAX_ARCHIVED_FLOWS} old archived flows (keeping ${MAX_ARCHIVED_FLOWS} most recent)`,
      )

      if (flowsToSave.length !== flows.length) {
        setFlows(flowsToSave)
        return
      }
    }

    try {
      localStorage.setItem("flows", JSON.stringify(flowsToSave))
    } catch (e) {
      if (e instanceof DOMException && e.name === "QuotaExceededError") {
        handleQuotaExceeded(flowsToSave, setFlows)
      } else {
        console.error("Failed to save flows:", e)
      }
    }
  }, [flows, setFlows])
}

/**
 * Handle localStorage quota exceeded error
 */
function handleQuotaExceeded(flows: Flow[], setFlows: (flows: Flow[]) => void) {
  console.error("localStorage quota exceeded. Attempting cleanup...")

  const storageInfo = getStorageInfo()
  console.error(`Storage usage: ${storageInfo.totalFormatted} (${storageInfo.percentUsed.toFixed(1)}%)`)

  const onlyActiveFlows = flows.filter((f) => !f.archived)

  if (onlyActiveFlows.length < flows.length) {
    console.log(`Removing ${flows.length - onlyActiveFlows.length} archived flows...`)
    setFlows(onlyActiveFlows)

    try {
      localStorage.setItem("flows", JSON.stringify(onlyActiveFlows))
      console.log("Successfully saved after removing archived flows")
    } catch (retryError) {
      alert(
        `Storage quota exceeded! (${storageInfo.totalFormatted} used)\n\n` +
          `Please delete some older flows or speech documents.\n` +
          `Currently storing ${onlyActiveFlows.length} active flows.`,
      )
    }
  } else {
    const flowIds = flows.map((f) => f.id)
    const cleaned = cleanupOldSpeechDocs(flowIds)

    if (cleaned > 0) {
      try {
        localStorage.setItem("flows", JSON.stringify(flows))
        console.log("Successfully saved after cleaning speech documents")
      } catch {
        alert(
          `Storage quota exceeded! (${storageInfo.totalFormatted} used)\n\n` +
            `Please delete some flows to free up space.\n` +
            `Currently storing ${flows.length} flows.`,
        )
      }
    } else {
      alert(
        `Storage quota exceeded! (${storageInfo.totalFormatted} used)\n\n` +
          `Please delete some flows to free up space.\n` +
          `Currently storing ${flows.length} flows.`,
      )
    }
  }
}
