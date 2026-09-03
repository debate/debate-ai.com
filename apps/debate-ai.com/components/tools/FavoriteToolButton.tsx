"use client"

/**
 * @fileoverview Star toggle for pinning/unpinning a tool as a favorite —
 * TODO.md idea #17, "integrate tools into user settings" follow-up. Used
 * on every `/tools` card and on each chip in the favorites strip
 * (`FavoritesController`'s markup in `app/tools/page.tsx`), and reused by
 * `components/settings/FavoriteToolsSettings.tsx` on `/settings`.
 *
 * Rendered as a sibling of the card's `<Link>`, not nested inside it — a
 * `<button>` inside an `<a>` is invalid HTML and confuses screen readers,
 * so `app/tools/page.tsx` wraps each card in a `position: relative`
 * container and absolutely positions this button on top instead.
 *
 * @module components/tools/FavoriteToolButton
 */

import { Star } from "lucide-react"
import { cn } from "../../lib/ui/lib/utils"
import { useFavoriteTools } from "@/lib/hooks/useFavoriteTools"

export function FavoriteToolButton({
  href,
  label,
  className,
}: {
  href: string
  label: string
  className?: string
}) {
  const { isFavorite, toggleFavorite, loaded } = useFavoriteTools()
  const active = isFavorite(href)

  return (
    <button
      type="button"
      aria-label={active ? `Remove ${label} from favorites` : `Add ${label} to favorites`}
      aria-pressed={active}
      onClick={() => toggleFavorite(href)}
      className={cn(
        "z-10 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
        active && "text-amber-500 hover:text-amber-500",
        !loaded && "invisible",
        className,
      )}
    >
      <Star className={cn("h-4 w-4", active && "fill-current")} />
    </button>
  )
}
