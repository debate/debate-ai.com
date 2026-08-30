"use client"

/**
 * @fileoverview "Favorite tools" section on `/settings` — TODO.md idea #17
 * ("User Settings — account-linked debate preferences"), "integrate tools
 * into user settings" follow-up. Surfaces the same account-linked
 * `favoriteTools` list `/tools`' star toggles manage
 * (`lib/hooks/useFavoriteTools.ts`), so a signed-in user's pinned tools are
 * reachable and manageable from Settings, not just from `/tools` itself.
 *
 * Resolves each favorited `href` back to its label/icon/description via
 * `app/tools/tool-groups.ts`'s `ALL_TOOLS` — the one place in the app that
 * knows the tool catalog; `useFavoriteTools`/`/api/settings` only ever
 * handle bare route paths, so a stale favorite (a tool since renamed or
 * removed) is silently skipped here rather than rendered broken.
 *
 * @module components/settings/FavoriteToolsSettings
 */

import Link from "next/link"
import { Star, X } from "lucide-react"
import { Button } from "debate-ui/src/primitives/button"
import { useFavoriteTools } from "@/lib/hooks/useFavoriteTools"
import { ALL_TOOLS } from "@/app/tools/tool-groups"

export function FavoriteToolsSettings() {
  const { favorites, loaded, removeFavorite } = useFavoriteTools()

  const favoriteTools = favorites
    .map((href) => ALL_TOOLS.find((tool) => tool.href === href))
    .filter((tool): tool is (typeof ALL_TOOLS)[number] => tool !== undefined)

  return (
    <div className="max-w-lg mx-auto px-4 sm:px-6 pb-6">
      <div className="flex items-center gap-1.5 mb-1">
        <Star className="h-4 w-4 text-amber-500 fill-current" />
        <h2 className="text-base font-semibold">Favorite tools</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Star a tool on the <Link href="/tools" className="underline underline-offset-2 hover:text-foreground">Tools page</Link> to pin it here for quick access.
      </p>

      {!loaded ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : favoriteTools.length === 0 ? (
        <p className="text-sm text-muted-foreground">You haven't pinned any tools yet.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {favoriteTools.map((tool) => (
            <li
              key={tool.href}
              className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2"
            >
              <tool.icon className="h-4 w-4 shrink-0 text-foreground" />
              <Link href={tool.href} className="flex-1 min-w-0 truncate text-sm font-medium text-foreground hover:underline">
                {tool.label}
              </Link>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${tool.label} from favorites`}
                onClick={() => removeFavorite(tool.href)}
              >
                <X className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
