"use client"

/**
 * Surfaces the signed-in user's cloud-saved Documents, Flows, and Rounds at
 * the top of the Tools directory, so the SQL-backed save feature (see
 * /settings, packages/debate-help-docs/content/docs/features/flow-cloud-save.mdx, and
 * packages/debate-help-docs/content/docs/features/round-cloud-save.mdx) is actually discoverable from the one
 * page that already lists every tool. Renders nothing when signed out or
 * empty.
 *
 * Previously merged only documents and rounds inline, silently omitting
 * saved flows — the middle of the three data types "save flows docs and
 * debates" names. `buildRecentCloudItems`/`formatRelativeCloudTime`
 * (`debate-round`) now own the merge/sort/label/relative-time logic, unit
 * tested there since this file has no vitest project of its own (see
 * `vitest.config.ts`'s `projects` list). Account-synced word-count rounds
 * (`/word-count`) joined the merge alongside those three — the same
 * SQL-backed, per-user round history as `saved_rounds`, just never
 * surfaced here. Practice vs AI debates (`/versus-ai`) joined next — the
 * third and last of the "save flows docs and debates" idea's named data
 * types, already saved per-user in `practice_vs_ai_debates` but likewise
 * never listed anywhere a returning user could browse it.
 *
 * Previously also fetched all three endpoints itself via a bare
 * `Promise.all(...).then(r => r.json())` with no error handling. `/api/flows`
 * and `/api/rounds` both 401 with an `{ error }` body when the server can't
 * resolve a session even though the client still thinks it's signed in (a
 * stale session, or a transient auth-backend error) — that shape isn't an
 * array, so `buildRecentCloudItems` threw, the effect rejected with nobody
 * to catch it, and `items` stayed `null` forever, silently indistinguishable
 * from "no saved items". `fetchRecentCloudItems` (`debate-round`) now owns
 * that network orchestration and degrades any one failing source to "no
 * items of that kind" instead.
 */

import { useEffect, useState } from "react"
import Link from "next/link"
import { Bot, FileText, Flag, ListTree, Type } from "lucide-react"
import { Card, CardHeader, CardTitle, CardDescription } from "../../lib/ui/primitives/card"
import { useSession } from "../../lib/hooks/useSession"
import { fetchRecentCloudItems, formatRelativeCloudTime, type CloudLibraryItem, type CloudLibraryItemKind } from "debate-round"

const KIND_ICON: Record<CloudLibraryItemKind, typeof FileText> = {
  document: FileText,
  flow: ListTree,
  round: Flag,
  // Matches Word-Count Speeches' own icon in `app/tools/tool-groups.ts`.
  wordCountRound: Type,
  // Matches Practice vs AI's own icon in `app/tools/tool-groups.ts`.
  debate: Bot,
}

export function MySavedItems() {
  const { isAuthenticated } = useSession()
  const [items, setItems] = useState<CloudLibraryItem[] | null>(null)

  useEffect(() => {
    if (!isAuthenticated) return
    let cancelled = false
    void fetchRecentCloudItems().then((result) => {
      if (!cancelled) setItems(result)
    })
    return () => {
      cancelled = true
    }
  }, [isAuthenticated])

  if (!isAuthenticated || !items || items.length === 0) return null

  return (
    <section className="mb-10">
      <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">My Saved Items</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => {
          const Icon = KIND_ICON[item.kind]
          return (
            <Link key={item.key} href={item.href} className="block">
              <Card className="h-full py-4 transition-colors hover:bg-accent hover:border-accent-foreground/20">
                <CardHeader className="px-4">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 shrink-0 text-foreground" />
                    <CardTitle className="text-sm truncate">{item.label}</CardTitle>
                  </div>
                  <CardDescription>{formatRelativeCloudTime(item.updatedAtMs)}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
