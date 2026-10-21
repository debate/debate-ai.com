/**
 * @fileoverview Which sections of the live round sidebar are shown. The
 * sidebar's "Sidebar sections" menu toggles each one; the choice is kept in
 * `localStorage` so it sticks across rounds and reloads on this device.
 *
 * @module utils/sidebar-sections
 */

/** A section of the round sidebar the user can hide. */
export type SidebarSectionId = "speeches" | "timer" | "cameras" | "shared" | "tabs"

export interface SidebarSectionInfo {
  id: SidebarSectionId
  label: string
  description: string
}

/** Every toggleable section, in the order the sidebar draws them. */
export const SIDEBAR_SECTIONS: readonly SidebarSectionInfo[] = [
  { id: "speeches", label: "Speeches & prep", description: "The round's speeches, prep clocks and speech bar" },
  { id: "timer", label: "Circular timer", description: "The round's circular progress timer" },
  { id: "cameras", label: "Cameras", description: "The round room's webcams" },
  { id: "shared", label: "Shared headings & timers", description: "What others in the room are sharing" },
  { id: "tabs", label: "Open tabs", description: "Your open flows" },
]

export type SidebarSectionVisibility = Record<SidebarSectionId, boolean>

/** Every section starts shown. */
export const DEFAULT_SIDEBAR_SECTIONS: SidebarSectionVisibility = {
  speeches: true,
  timer: true,
  cameras: true,
  shared: true,
  tabs: true,
}

export const SIDEBAR_SECTIONS_STORAGE_KEY = "round-sidebar-sections"

/** Reads a stored visibility map, keeping the default for anything missing or malformed. */
export function parseSidebarSections(raw: string | null | undefined): SidebarSectionVisibility {
  if (!raw) return { ...DEFAULT_SIDEBAR_SECTIONS }
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const out = { ...DEFAULT_SIDEBAR_SECTIONS }
    if (parsed && typeof parsed === "object") {
      for (const { id } of SIDEBAR_SECTIONS) {
        if (typeof parsed[id] === "boolean") out[id] = parsed[id] as boolean
      }
    }
    return out
  } catch {
    return { ...DEFAULT_SIDEBAR_SECTIONS }
  }
}

/** The stored visibility map for this device. */
export function readSidebarSections(): SidebarSectionVisibility {
  try {
    return parseSidebarSections(localStorage.getItem(SIDEBAR_SECTIONS_STORAGE_KEY))
  } catch {
    return { ...DEFAULT_SIDEBAR_SECTIONS }
  }
}

/** Saves the visibility map; storage being unavailable just means it won't stick. */
export function writeSidebarSections(value: SidebarSectionVisibility): void {
  try {
    localStorage.setItem(SIDEBAR_SECTIONS_STORAGE_KEY, JSON.stringify(value))
  } catch {
    // Private mode or blocked storage.
  }
}
