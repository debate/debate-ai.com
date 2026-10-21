"use client"

/**
 * @fileoverview State for the round sidebar's section toggles, read from and
 * saved to `localStorage` (see `utils/sidebar-sections`).
 *
 * @module hooks/useSidebarSections
 */

import { useCallback, useEffect, useState } from "react"
import {
  DEFAULT_SIDEBAR_SECTIONS,
  readSidebarSections,
  writeSidebarSections,
  type SidebarSectionId,
  type SidebarSectionVisibility,
} from "../utils/sidebar-sections"

export function useSidebarSections() {
  // Start from the defaults so the server render matches, then load the saved choice.
  const [sections, setSections] = useState<SidebarSectionVisibility>(DEFAULT_SIDEBAR_SECTIONS)

  useEffect(() => {
    setSections(readSidebarSections())
  }, [])

  const setSection = useCallback((id: SidebarSectionId, shown: boolean) => {
    setSections((prev) => {
      const next = { ...prev, [id]: shown }
      writeSidebarSections(next)
      return next
    })
  }, [])

  const resetSections = useCallback(() => {
    writeSidebarSections(DEFAULT_SIDEBAR_SECTIONS)
    setSections({ ...DEFAULT_SIDEBAR_SECTIONS })
  }, [])

  return { sections, setSection, resetSections }
}
