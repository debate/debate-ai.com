/**
 * @fileoverview Mount hook that auto-saves already-account-saved flows after
 * they change (see `createFlowAutoSaver`). Does nothing while the user has
 * turned auto-save off (`flowAutoSavePreference`).
 */

"use client"

import { useEffect, useRef, useSyncExternalStore } from "react"
import type { Flow } from "../types/flow"
import { createFlowAutoSaver, type FlowAutoSaver } from "./flowAutoSave"
import { isFlowAutoSaveEnabled, subscribeFlowAutoSavePreference } from "./flowAutoSavePreference"

export function useFlowAutoSave(flows: readonly Flow[]): void {
  const enabled = useSyncExternalStore(subscribeFlowAutoSavePreference, isFlowAutoSaveEnabled, () => true)
  const saver = useRef<FlowAutoSaver | null>(null)
  useEffect(() => {
    if (!enabled) return
    const current = createFlowAutoSaver()
    saver.current = current
    return () => {
      saver.current = null
      // Turning auto-save off must not upload what was still pending.
      if (isFlowAutoSaveEnabled()) void current.flush()
      else current.dispose()
    }
  }, [enabled])
  useEffect(() => {
    saver.current?.schedule(flows)
  }, [flows, enabled])
}
