"use client"

/**
 * @fileoverview The Research Workspace's "Favorite References" panel: the
 * sources a reader starred from the docs' References panel, listed on the
 * Library tab beside the shared Argument Library.
 *
 * The favorites live in `localStorage` (`@debate-ai/reading-mode/favorites`)
 * and, for a signed-in user, in their account (the `docsFavoriteReferences`
 * collection of the tool-record sync), so this panel only reads the store and
 * removes entries from it; it follows a write from the docs, another tab or an
 * account merge. A guest sees the same list, from this browser alone, and is
 * told so.
 *
 * @module components/research/FavoriteReferencesPanel
 */

import { useEffect } from "react"
import { ExternalLink, Star } from "lucide-react"
import {
  readFavoriteReferences,
  removeFavoriteReference,
  subscribeFavoriteReferences,
  type FavoriteReference,
} from "@debate-ai/reading-mode/favorites"
import { useSession } from "../../lib/hooks/useSession"
import { useStoreSnapshot } from "../../ui/panels/use-store-snapshot"
import { EmptyState, PanelShell } from "../../ui/panels/panel-shell"

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}

function FavoriteRow({ favorite, onRemove }: { favorite: FavoriteReference; onRemove: () => void }) {
  return (
    <li data-favorite-reference={favorite.id} className="border-border flex items-start gap-3 rounded-lg border px-3 py-2">
      <div className="min-w-0 flex-1 text-sm">
        <p className="leading-relaxed">{favorite.citation}</p>
        <p className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
          {favorite.url ? (
            <a
              href={favorite.url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="text-primary inline-flex items-center gap-1 underline underline-offset-2"
            >
              <ExternalLink className="size-3" aria-hidden /> {hostOf(favorite.url)}
            </a>
          ) : null}
          {favorite.page ? (
            <a href={favorite.page} className="underline underline-offset-2">
              Cited in the docs
            </a>
          ) : null}
        </p>
      </div>
      <button
        type="button"
        aria-label="Remove from favorites"
        title="Remove from favorites"
        className="text-muted-foreground hover:bg-accent hover:text-accent-foreground rounded-md p-1.5"
        onClick={onRemove}
      >
        <Star className="size-4 fill-current" aria-hidden />
      </button>
    </li>
  )
}

/** Lists the starred reference sources, newest first. */
export function FavoriteReferencesPanel() {
  const { isAuthenticated } = useSession()
  const { data: favorites, refresh } = useStoreSnapshot<FavoriteReference[]>(readFavoriteReferences, [])

  useEffect(() => subscribeFavoriteReferences(refresh), [refresh])

  return (
    <PanelShell
      title="Favorite References"
      icon={<Star className="size-4" aria-hidden />}
      description={
        isAuthenticated
          ? "Sources you starred in the docs' References panel, saved to your account."
          : "Sources you starred in the docs' References panel. Sign in to keep them on every device; for now they stay in this browser."
      }
      data-testid="favorite-references-panel"
    >
      {favorites.length === 0 ? (
        <EmptyState
          title="No favorite references yet"
          message="Open References on any docs page and star a source to keep it here."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {favorites.map((favorite) => (
            <FavoriteRow
              key={favorite.id}
              favorite={favorite}
              onRemove={() => {
                removeFavoriteReference(favorite.id)
                refresh()
              }}
            />
          ))}
        </ul>
      )}
    </PanelShell>
  )
}
