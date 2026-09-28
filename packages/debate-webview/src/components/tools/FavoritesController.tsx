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
 * catalog. It is the only surface that does: `/settings` used to carry a
 * "Favorite tools" list that pruned on every visit, and that page is the
 * card editor's settings now, so a stale entry would otherwise sit in the
 * saved list forever — invisible here, and never cleaned up anywhere else
 * (see `packages/debate-help-docs/content/docs/features/user-settings.mdx`'s
 * Known gaps).
 *
 * @module components/tools/FavoritesController
 */

import { useEffect } from "react"
import { useFavoriteTools } from "../../lib/hooks/useFavoriteTools"
import { ALL_TOOLS } from "../../routes/tools/tool-groups"

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
