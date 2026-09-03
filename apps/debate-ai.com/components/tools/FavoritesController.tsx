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
 * Also prunes any favorite whose tool was since renamed/removed from the
 * catalog, the same way `components/settings/FavoriteToolsSettings.tsx`
 * already does — previously this was the one favorites surface that knew
 * the real `/tools` catalog (`ALL_TOOLS`) but never called
 * `useFavoriteTools().pruneUnknown`, so a stale chip here just silently
 * never matched any pre-rendered chip and stayed invisible until a
 * `/settings` visit happened to prune the underlying list (see
 * `docs/features/user-settings.md`'s Known gaps).
 *
 * @module components/tools/FavoritesController
 */

import { useEffect } from "react"
import { useFavoriteTools } from "@/lib/hooks/useFavoriteTools"
import { ALL_TOOLS } from "@/app/tools/tool-groups"

const ALL_TOOL_HREFS = ALL_TOOLS.map((tool) => tool.href)

export function FavoritesController() {
  const { favorites, loaded, pruneUnknown } = useFavoriteTools()

  useEffect(() => {
    if (loaded) pruneUnknown(ALL_TOOL_HREFS)
  }, [loaded, pruneUnknown])

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
