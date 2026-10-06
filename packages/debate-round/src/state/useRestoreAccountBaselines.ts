/**
 * @fileoverview Mount hook that restores the saved-to-account markers (see
 * `restoreAccountBaselinesOnce`). Safe to call from several components.
 */

"use client"

import { useEffect } from "react"
import { restoreAccountBaselinesOnce } from "./restoreAccountBaselines"

export function useRestoreAccountBaselines(): void {
  useEffect(() => {
    void restoreAccountBaselinesOnce()
  }, [])
}
