"use client"

/**
 * Format / year / topic dropdowns above the Topic Starters tree. Picking one
 * goes to that resolution's address, `/docs/<topic code>` (`vcs27`, `ld27a`;
 * the scheme is in `lib/reason-docs/topic-doc-paths`), which opens its first
 * starter in CardMirror and keeps the code in every starter link after it.
 *
 * The topic dropdown lists every topic the format has had, grouped by year, so
 * any of them is one pick away; the year dropdown is a shortcut that jumps to
 * that year's first topic.
 */

import { useMemo } from "react"
import { usePathname, useRouter } from "next/navigation"
import {
  TOPIC_FORMATS,
  findTopicByCode,
  topicOptionLabel,
  topicOrDefault,
  topicsForFormat,
  yearsForFormat,
  type TopicFormat,
} from "../../lib/reason-docs/topic-codes"
import { parseTopicDocsPath, topicDocsHref } from "../../lib/reason-docs/topic-doc-paths"
import { cn } from "../../lib/ui/lib/utils"

const selectClass =
  "h-7 min-w-0 rounded border border-input bg-background px-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"

export function TopicDocsPicker({ className }: { className?: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const current = topicOrDefault(parseTopicDocsPath(pathname)?.code)

  const format = current?.format ?? "vcs"
  const years = useMemo(() => yearsForFormat(format), [format])
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

  const pickYear = (year: number) => go(topicsForFormat(format).find((item) => item.year === year)?.code)

  return (
    <div className={cn("flex flex-col gap-1 px-2 pb-2", className)}>
      <div className="flex gap-1">
        <select
          aria-label="Format"
          className={cn(selectClass, "flex-1")}
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
          aria-label="Year"
          className={selectClass}
          value={current.year}
          onChange={(event) => pickYear(Number(event.target.value))}
        >
          {years.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
      </div>
      <select
        aria-label="Topic"
        title={current.text}
        className={cn(selectClass, "w-full")}
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
