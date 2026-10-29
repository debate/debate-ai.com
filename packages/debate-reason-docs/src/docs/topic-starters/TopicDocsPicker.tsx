"use client"

/**
 * Format / topic dropdowns, side by side above the Topic Starters tree. Picking one
 * goes to that resolution's address, `/docs/<topic code>` (`vcx27`, `ld27a`;
 * the scheme is in `lib/reason-docs/topic-doc-paths`), which opens its first
 * starter in Debate Editor and keeps the code in every starter link after it.
 *
 * The topic dropdown lists every topic the format has had, grouped by year, so
 * any of them is one pick away.
 */

import { useMemo } from "react"
import { usePathname, useRouter } from "next/navigation"
import {
  TOPIC_FORMATS,
  findTopicByCode,
  topicOptionLabel,
  topicOrDefault,
  topicsForFormat,
  type TopicFormat,
} from "../../lib/reason-docs/topic-codes"
import { parseTopicDocsPath, topicDocsHref } from "../../lib/reason-docs/topic-doc-paths"
import { cn } from "@debate-ai/ui/lib/utils"

const selectClass =
  "h-7 min-w-0 rounded border border-input bg-background px-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"

export function TopicDocsPicker({ className }: { className?: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const current = topicOrDefault(parseTopicDocsPath(pathname)?.code)

  const format = current?.format ?? "vcx"
  const topicsByYear = useMemo(() => {
    const groups = new Map<number, ReturnType<typeof topicsForFormat>>()
    for (const item of topicsForFormat(format)) {
      groups.set(item.year, [...(groups.get(item.year) ?? []), item])
    }
    return [...groups.entries()]
  }, [format])

  if (!current) return null

  const go = (code: string | undefined) => {
    if (!code || code === current.code) return
    router.push(topicDocsHref(code))
  }

  const pickFormat = (next: TopicFormat) => {
    // Same year in the new format when it has one, else its newest topic.
    const candidates = topicsForFormat(next)
    go((candidates.find((item) => item.year === current.year) ?? candidates[0])?.code)
  }

  return (
    <div className={cn("flex gap-1 px-2 pb-2", className)}>
      <select
        aria-label="Format"
        className={cn(selectClass, "w-20 shrink-0")}
        value={format}
        onChange={(event) => pickFormat(event.target.value as TopicFormat)}
      >
        {TOPIC_FORMATS.map((item) => (
          <option key={item.id} value={item.id}>
            {item.label}
          </option>
        ))}
      </select>
      <select
        aria-label="Topic"
        title={current.text}
        className={cn(selectClass, "flex-1")}
        value={current.code}
        onChange={(event) => go(findTopicByCode(event.target.value)?.code)}
      >
        {topicsByYear.map(([year, items]) => (
          <optgroup key={year} label={String(year)}>
            {items.map((item) => (
              <option key={item.code} value={item.code} title={item.text}>
                {topicOptionLabel(item)} ({item.code})
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  )
}
