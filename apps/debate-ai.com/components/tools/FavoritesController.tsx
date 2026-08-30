"use client"

/**
 * @fileoverview Shows/hides the `/tools` favorites strip and its chips —
 * TODO.md idea #17, "integrate tools into user settings" follow-up.
 *
 * Renders nothing itself. `app/tools/page.tsx` pre-renders a chip for
 * every tool inside `[data-favorites-section]`, each `hidden` by default
 * and tagged `data-tool-href`, so the markup (icon, label, link) needs no
 * data passed across the server/client boundary — this component just
 * flips `hidden` on the chips that match the current favorites list and on
 * the section itself when there are none, mirroring `ToolsSearch`'s
 * DOM-attribute-driven filtering rather than rendering the strip from
 * React state.
 *
 * @module components/tools/FavoritesController
 */

import { useEffect } from "react"
import { useFavoriteTools } from "@/lib/hooks/useFavoriteTools"

export function FavoritesController() {
  const { favorites, loaded } = useFavoriteTools()

  useEffect(() => {
    if (!loaded) return
    const section = document.querySelector<HTMLElement>("[data-favorites-section]")
    if (!section) return

    let visible = 0
    for (const chip of section.querySelectorAll<HTMLElement>("[data-tool-href]")) {
      const match = favorites.includes(chip.dataset.toolHref ?? "")
      chip.hidden = !match
      if (match) visible++
    }
    section.hidden = visible === 0
  }, [favorites, loaded])

  return null
}
