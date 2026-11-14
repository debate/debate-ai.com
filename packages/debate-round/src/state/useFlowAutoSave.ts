/**
 * @fileoverview Mount hook that auto-saves account flows after they change
 * (see `createFlowAutoSaver`). Does nothing while the Settings → General
 * **Flow auto-save** mode is `"off"` (`flowAutoSaveSettings`); the saver reads
 * `"saved"` vs `"all"` itself at each run.
 */

"use client"

import { useEffect, useRef, useSyncExternalStore } from "react"
import type { Flow } from "../types/flow"
import { createFlowAutoSaver, type FlowAutoSaver } from "./flowAutoSave"
import { readFlowAutoSaveMode, subscribeFlowAutoSaveMode } from "./flowAutoSaveSettings"

const isEnabled = () => readFlowAutoSaveMode() !== "off"

export function useFlowAutoSave(flows: readonly Flow[]): void {
  const enabled = useSyncExternalStore(subscribeFlowAutoSaveMode, isEnabled, () => true)
  const saver = useRef<FlowAutoSaver | null>(null)
  useEffect(() => {
    if (!enabled) return
    const current = createFlowAutoSaver()
    saver.current = current
    return () => {
      saver.current = null
      // Turning auto-save off must not upload what was still pending.
      if (isEnabled()) void current.flush()
      else current.dispose()
    }
  }, [enabled])
  useEffect(() => {
    saver.current?.schedule(flows)
  }, [flows, enabled])
}
