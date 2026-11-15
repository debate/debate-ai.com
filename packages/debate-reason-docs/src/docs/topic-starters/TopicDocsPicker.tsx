"use client"

/**
 * Format / topic dropdowns, side by side above the Topic Starters tree. Picking one
 * goes to that resolution's address, `/docs/<topic code>` (`vcx27`, `lda27`;
 * the scheme is in `lib/reason-docs/topic-doc-paths`), which opens its first
 * starter in Debate Editor and keeps the code in every starter link after it.
 *
 * The topic dropdown lists the format's topics from the 2015 season on
 * (`PICKER_MIN_YEAR`), grouped by year. Older resolutions, the pre-2000 legacy
 * ones included, are browsed on the Topics & Statistics page, which the last
 * option ("Older topics…") opens. A direct link to an older topic still works:
 * that topic stays listed, in an "Older" group, while it is open.
 */

import { useMemo } from "react"
import { usePathname, useRouter } from "next/navigation"
import {
  TOPIC_FORMATS,
  PICKER_MIN_YEAR,
  findTopicByCode,
  pickerTopicsForFormat,
  topicOptionLabel,
  topicOrDefault,
  type TopicFormat,
} from "../../lib/reason-docs/topic-codes"
import { parseTopicDocsPath, topicDocsHref } from "../../lib/reason-docs/topic-doc-paths"
import { cn } from "../../ui/lib/utils"

/** The topic dropdown's group for an open topic older than the cutoff. */
const OLDER_GROUP_LABEL = "Older"

/** Where the dropdown sends readers for topics before the cutoff. */
export const OLDER_TOPICS_HREF = "/practice/statistics"

/** The dropdown option value that opens {@link OLDER_TOPICS_HREF}. */
const OLDER_TOPICS_VALUE = "__older-topics__"

const selectClass =
  "h-7 min-w-0 rounded border border-input bg-background px-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"

export function TopicDocsPicker({ className }: { className?: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const current = topicOrDefault(parseTopicDocsPath(pathname)?.code)

  const format = current?.format ?? "vcx"
  const currentCode = current?.code
  const topicsByYear = useMemo(() => {
    const groups = new Map<string, ReturnType<typeof pickerTopicsForFormat>>()
    for (const item of pickerTopicsForFormat(format, currentCode)) {
      const label = item.legacy || item.year < PICKER_MIN_YEAR ? OLDER_GROUP_LABEL : String(item.year)
      groups.set(label, [...(groups.get(label) ?? []), item])
    }
    return [...groups.entries()]
  }, [format, currentCode])

  if (!current) return null

  const go = (code: string | undefined) => {
    if (!code || code === current.code) return
    router.push(topicDocsHref(code))
  }

  const pickFormat = (next: TopicFormat) => {
    // Same year in the new format when it has one, else its newest topic.
    const candidates = pickerTopicsForFormat(next)
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
        onChange={(event) => {
          if (event.target.value === OLDER_TOPICS_VALUE) router.push(OLDER_TOPICS_HREF)
          else go(findTopicByCode(event.target.value)?.code)
        }}
      >
        {topicsByYear.map(([label, items]) => (
          <optgroup key={label} label={label}>
            {items.map((item) => (
              <option key={item.code} value={item.code} title={item.text}>
                {topicOptionLabel(item)} ({item.code})
              </option>
            ))}
          </optgroup>
        ))}
        <option value={OLDER_TOPICS_VALUE}>Older topics…</option>
      </select>
    </div>
  )
}
