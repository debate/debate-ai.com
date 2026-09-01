"use client"

/**
 * Surfaces the signed-in user's cloud-saved Documents, Flows, and Rounds at
 * the top of the Tools directory, so the SQL-backed save feature (see
 * /settings, docs/features/flow-cloud-save.md, and
 * docs/features/round-cloud-save.md) is actually discoverable from the one
 * page that already lists every tool. Renders nothing when signed out or
 * empty.
 *
 * Previously merged only documents and rounds inline, silently omitting
 * saved flows — the middle of the three data types "save flows docs and
 * debates" names. `buildRecentCloudItems`/`formatRelativeCloudTime`
 * (`debate-round`) now own the merge/sort/label/relative-time logic so all
 * three kinds are covered, unit-tested there since this file has no vitest
 * project of its own (see `vitest.config.ts`'s `projects` list).
 */

import { useEffect, useState } from "react"
import Link from "next/link"
import { FileText, Flag, ListTree } from "lucide-react"
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/debate-ui/primitives/card"
import { useSession } from "@/lib/hooks/useSession"
import {
  buildRecentCloudItems,
  formatRelativeCloudTime,
  type CloudLibraryItem,
  type CloudLibraryItemKind,
} from "debate-round"

const KIND_ICON: Record<CloudLibraryItemKind, typeof FileText> = {
  document: FileText,
  flow: ListTree,
  round: Flag,
}

export function MySavedItems() {
  const { isAuthenticated } = useSession()
  const [items, setItems] = useState<CloudLibraryItem[] | null>(null)

  useEffect(() => {
    if (!isAuthenticated) return
    void (async () => {
      const [documents, flows, rounds] = await Promise.all([
        fetch("/api/doc/documents").then((r) => r.json()),
        fetch("/api/flows").then((r) => r.json()),
        fetch("/api/rounds").then((r) => r.json()),
      ])
      setItems(buildRecentCloudItems({ documents, flows, rounds }))
    })()
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
