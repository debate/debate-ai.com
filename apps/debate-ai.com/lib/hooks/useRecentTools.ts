"use client"

/**
 * @fileoverview Tracks the last few tools opened via the app-wide command
 * palette (`GlobalCommandPalette.tsx`), most-recent-first, purely as a
 * per-browser localStorage convenience — see `lib/recentTools.ts`'s header
 * for why this doesn't sync to the account like `useFavoriteTools` does.
 *
 * Mirrors `useFavoriteTools.ts`'s cross-instance sync trick: a change writes
 * `localStorage` and dispatches a same-tab `recent-tools-changed` window
 * event so every other mounted instance re-reads it, in case the palette is
 * ever mounted more than once per document (it already is, per
 * `GlobalCommandPalette.tsx`'s header — once per framed dock destination).
 *
 * @module lib/hooks/useRecentTools
 */

import { useCallback, useEffect, useState } from "react"
import { parseRecentTools, pushRecentTool } from "@/lib/recentTools"

const STORAGE_KEY = "recent-tools"
const CHANGE_EVENT = "recent-tools-changed"

function readLocal(): string[] {
  if (typeof localStorage === "undefined") return []
  try {
    return parseRecentTools(localStorage.getItem(STORAGE_KEY))
  } catch {
    return []
  }
}

function writeLocal(list: string[]) {
  if (typeof localStorage === "undefined") return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
}

export function useRecentTools() {
  const [recent, setRecent] = useState<string[]>([])

  useEffect(() => {
    setRecent(readLocal())
    const onExternalChange = () => setRecent(readLocal())
    window.addEventListener(CHANGE_EVENT, onExternalChange)
    return () => window.removeEventListener(CHANGE_EVENT, onExternalChange)
  }, [])

  /** Records that `href` was just opened, promoting it to the front of the list. */
  const recordVisit = useCallback((href: string) => {
    setRecent((current) => {
      const next = pushRecentTool(current, href)
      if (next !== current) {
        writeLocal(next)
        window.dispatchEvent(new Event(CHANGE_EVENT))
      }
      return next
    })
  }, [])

  return { recent, recordVisit }
}
