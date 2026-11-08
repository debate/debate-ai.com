/**
 * @fileoverview Two display switches from Settings → Preferences, both on by
 * default:
 *
 * - **mascots**: school mascots (watch-page team cards, school pages).
 * - **logos**: school logos shown with, or in place of, school names (team
 *   labels, profile headers, the schools table). Off = plain-text names.
 *
 * Like the sidebar-animation switch, the choice is local to this browser,
 * applies the moment it's made (every open tab follows via `storage`) and is
 * never synced to the account. The server render and first client render
 * always show both on, then the stored choice takes over.
 * @module leaderboard/lib/school-art-settings
 */

import { useSyncExternalStore } from "react"
import { getSchoolLogo } from "./schoolLogos"

/** Which piece of school art a switch controls. */
export type SchoolArtKind = "mascots" | "logos"

/** localStorage keys; "0" = hidden. Anything else (or nothing) = shown. */
export const SCHOOL_ART_KEYS: Record<SchoolArtKind, string> = {
  mascots: "show-school-mascots",
  logos: "show-school-logos",
}

const CHANGE_EVENT = "school-art-settings-change"

/** Whether this kind of school art is shown. On by default and when storage is unavailable. */
export function readSchoolArtSetting(kind: SchoolArtKind): boolean {
  try {
    return localStorage.getItem(SCHOOL_ART_KEYS[kind]) !== "0"
  } catch {
    return true
  }
}

/** Saves the choice and tells every listener in this tab. */
export function setSchoolArtSetting(kind: SchoolArtKind, on: boolean): void {
  try {
    localStorage.setItem(SCHOOL_ART_KEYS[kind], on ? "1" : "0")
  } catch {
    // Storage blocked: the switch still flips for this page view below.
  }
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CHANGE_EVENT))
}

/** Calls `onChange` when either switch changes, in this tab or another. */
export function subscribeSchoolArtSettings(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {}
  const keys = Object.values(SCHOOL_ART_KEYS)
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || keys.includes(event.key)) onChange()
  }
  window.addEventListener(CHANGE_EVENT, onChange)
  window.addEventListener("storage", onStorage)
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange)
    window.removeEventListener("storage", onStorage)
  }
}

/** React view of one switch; `true` during server render and hydration. */
export function useSchoolArtSetting(kind: SchoolArtKind): boolean {
  return useSyncExternalStore(
    subscribeSchoolArtSettings,
    () => readSchoolArtSetting(kind),
    () => true,
  )
}

/** Whether school mascots are shown (Settings → Preferences). */
export const useShowSchoolMascots = () => useSchoolArtSetting("mascots")

/** Whether school logos are shown with team and school names (Settings → Preferences). */
export const useShowSchoolLogos = () => useSchoolArtSetting("logos")

/** {@link getSchoolLogo}, or `undefined` while the logos switch is off. */
export function useSchoolLogo(school: string | null | undefined): ReturnType<typeof getSchoolLogo> | undefined {
  const on = useShowSchoolLogos()
  return on && school ? getSchoolLogo(school) : undefined
}
