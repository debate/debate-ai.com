"use client"

/**
 * Surfaces the signed-in user's cloud-saved Documents and Rounds at the top
 * of the Tools directory, so the SQL-backed save feature (see /settings and
 * docs/features/round-cloud-save.md) is actually discoverable from the one
 * page that already lists every tool. Renders nothing when signed out or
 * empty.
 */

import { useEffect, useState } from "react"
import Link from "next/link"
import { FileText, Flag } from "lucide-react"
import { Card, CardHeader, CardTitle, CardDescription } from "debate-ui/src/primitives/card"
import { useSession } from "@/lib/hooks/useSession"

interface Item {
  href: string
  label: string
  updatedAt: string | number
  icon: typeof FileText
}

function formatRelative(value: string | number) {
  const ms = typeof value === "number" ? value * (value < 1e12 ? 1000 : 1) : Date.parse(value)
  if (!Number.isFinite(ms)) return ""
  const days = Math.floor((Date.now() - ms) / 86_400_000)
  if (days <= 0) return "Today"
  if (days === 1) return "Yesterday"
  return `${days}d ago`
}

export function MySavedItems() {
  const { isAuthenticated } = useSession()
  const [items, setItems] = useState<Item[] | null>(null)

  useEffect(() => {
    if (!isAuthenticated) return
    void (async () => {
      const [docs, rounds] = await Promise.all([
        fetch("/api/doc/documents").then((r) => r.json()),
        fetch("/api/rounds").then((r) => r.json()),
      ])
      const docItems: Item[] = docs
        .slice(0, 5)
        .map((d: any) => ({ href: "/reason-editor", label: d.title || "Untitled", updatedAt: d.updatedAt, icon: FileText }))
      const roundItems: Item[] = rounds
        .slice(0, 5)
        .map((r: any) => ({ href: "/debate", label: r.label || "Untitled Round", updatedAt: r.updatedAt, icon: Flag }))
      const merged = [...docItems, ...roundItems]
        .sort((a, b) => {
          const am = typeof a.updatedAt === "number" ? a.updatedAt : Date.parse(a.updatedAt)
          const bm = typeof b.updatedAt === "number" ? b.updatedAt : Date.parse(b.updatedAt)
          return bm - am
        })
        .slice(0, 6)
      setItems(merged)
    })()
  }, [isAuthenticated])

  if (!isAuthenticated || !items || items.length === 0) return null

  return (
    <section className="mb-10">
      <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">My Saved Items</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item, i) => (
          <Link key={`${item.href}-${item.label}-${i}`} href={item.href} className="block">
            <Card className="h-full py-4 transition-colors hover:bg-accent hover:border-accent-foreground/20">
              <CardHeader className="px-4">
                <div className="flex items-center gap-2">
                  <item.icon className="h-4 w-4 shrink-0 text-foreground" />
                  <CardTitle className="text-sm truncate">{item.label}</CardTitle>
                </div>
                <CardDescription>{formatRelative(item.updatedAt)}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  )
}
