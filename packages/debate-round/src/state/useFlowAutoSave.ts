/**
 * @fileoverview Mount hook that auto-saves already-account-saved flows after
 * they change (see `createFlowAutoSaver`).
 */

"use client"

import { useEffect, useRef } from "react"
import type { Flow } from "../types/flow"
import { createFlowAutoSaver, type FlowAutoSaver } from "./flowAutoSave"

export function useFlowAutoSave(flows: readonly Flow[]): void {
  const saver = useRef<FlowAutoSaver | null>(null)
  useEffect(() => {
    saver.current = createFlowAutoSaver()
    return () => void saver.current?.flush()
  }, [])
  useEffect(() => {
    saver.current?.schedule(flows)
  }, [flows])
}
