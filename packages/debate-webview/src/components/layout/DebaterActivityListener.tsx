"use client"

/**
 * @fileoverview Turns every `DEBATER_ACTIVITY_EVENT` dispatched in this
 * document (a quick card saved, a practice round judged, a drill marked
 * practiced) into Debater Level XP, and renders nothing. Mounted once per
 * document by `AppShell`, so tools can award XP without depending on
 * `debate-community` themselves.
 */

import { useEffect } from "react"
import { installDebaterActivityListener } from "debate-community"

export function DebaterActivityListener() {
  useEffect(() => installDebaterActivityListener(), [])
  return null
}
