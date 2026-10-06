/**
 * @fileoverview Side effects for flow page initialization and persistence
 * @module components/debate/flow/hooks/useFlowEffects
 */

import { useEffect, useState } from "react"
import { settings } from "../state/settings"
import { getBulkItem, hydrateBulkStorage, setBulkItem } from "@debate/data-sync/src/state/bulk-storage"
import { cleanupOldSpeechDocs } from "../utils/storage-utils"
import { buildAndSaveArgumentTreeIfChanged } from "../state/argumentTrees"
import type { Flow, Round } from "../types/flow"

/** How long a flow must sit unedited before its argument tree auto-syncs. */
const ARGUMENT_TREE_AUTO_SYNC_DEBOUNCE_MS = 1500

/**
 * Hook that initializes user settings and loads saved flows and rounds from
 * the on-device bulk store (`@debate/data-sync`'s `state/bulk-storage`:
 * IndexedDB, mirrored into the browser extension when it is installed).
 * Values an older build left in localStorage are migrated out on the way,
 * which frees the localStorage quota they held. Runs once on mount.
 *
 * @param setFlows - State setter for the flows array
 * @param setRounds - State setter for the rounds array
 * @returns Whether the stored flows and rounds have been loaded into the store yet.
 */
export function useInitialLoad(setFlows: (flows: Flow[]) => void, setRounds: (rounds: Round[]) => void): boolean {
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    settings.init()
    let cancelled = false

    void hydrateBulkStorage().then(() => {
      if (cancelled) return

      const savedFlows = getBulkItem("flows")
      if (savedFlows) {
        try {
          const parsed = JSON.parse(savedFlows)
          setFlows(parsed)

          // Orphaned speech documents from older builds still sit in
          // localStorage; clearing them frees that quota.
          cleanupOldSpeechDocs(parsed.map((f: Flow) => f.id))
        } catch (e) {
          console.error("Failed to load flows:", e)
        }
      }

      const savedRounds = getBulkItem("rounds")
      if (savedRounds) {
        try {
          setRounds(JSON.parse(savedRounds))
        } catch (e) {
          console.error("Failed to load rounds:", e)
        }
      }
      setLoaded(true)
    })

    return () => {
      cancelled = true
    }
  }, [setFlows, setRounds])
  return loaded
}

/**
 * Hook that reads the `fontSize` setting and applies it as a CSS custom property.
 * Subscribes to settings changes so the font size updates reactively.
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
 * Hook that persists the flows array to the on-device bulk store whenever it
 * changes. That store is IndexedDB-backed (unlimited inside the browser
 * extension), so there is no localStorage quota to trim flows for and no
 * "storage full" error to show — signed-in users' flows are also saved to
 * their account (`saved_flows`).
 *
 * @param flows - Current flows array to persist
 */
export function useFlowPersistence(flows: Flow[]) {
  useEffect(() => {
    if (flows.length === 0) return
    setBulkItem("flows", JSON.stringify(flows))
  }, [flows])
}

/**
 * Auto-syncs the currently selected flow's persisted argument tree
 * (`state/argumentTrees.ts`) as a round is flowed in the live round-flowing
 * page, debounced so it doesn't recompute on every keystroke. Closes the
 * "`ArgumentTreePanel.tsx`'s 'Generate outline for current round' action is
 * a manual trigger... the live round-flowing page still doesn't call
 * `buildAndSaveArgumentTree` automatically as a round is flowed" Known gap
 * in `packages/debate-help-docs/content/docs/internals/argument-tree-outline.mdx` — previously the tree only
 * updated via that panel's manual button.
 *
 * @param flows - Current flows array
 * @param selected - Index of the currently selected flow in `flows`
 */
export function useArgumentTreeAutoSync(flows: Flow[], selected: number) {
  const currentFlow = flows[selected]

  useEffect(() => {
    if (!currentFlow) return

    const timer = setTimeout(() => {
      buildAndSaveArgumentTreeIfChanged(currentFlow, String(currentFlow.id))
    }, ARGUMENT_TREE_AUTO_SYNC_DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [currentFlow])
}
