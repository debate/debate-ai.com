/**
 * @fileoverview The topic season ("25-26") under the year badge in a round's
 * watch page header. Hovering it (or focusing it) shows the resolution the
 * round was debated on: the college NDT/CEDA topic for a college round, the
 * high school policy topic for a high school round, and every LD / PF topic
 * of that season for those formats.
 */

"use client"

import { getSeasonTopicItems } from "@debate-ai/rankings/src/topics/debate-topics"
import { formatSeasonLabel } from "../../../data/video-rows"
import type { TopicType } from "../../../types/videos"
import { Tooltip, TooltipContent, TooltipTrigger } from "../../../ui/primitives/tooltip"
import { DEBATE_STYLE_LABELS } from "../card/videoCardUtils"

export function WatchSeasonTopic({
  seasonYear,
  style,
  topics,
}: {
  /** The competition season, by the year it ends (2026 for "25-26"). 0 for legacy. */
  seasonYear: number
  /** The round's format (1 HS policy, 2 PF, 3 LD, 4 college policy). */
  style: number | undefined
  /** `debate-topics.json`, once loaded. */
  topics?: TopicType[]
}) {
  if (!seasonYear) return null
  const label = formatSeasonLabel(seasonYear)
  const items = getSeasonTopicItems(topics, seasonYear, style)
  const badge = (
    <span
      className="text-[11px] font-semibold leading-none text-orange-700 dark:text-orange-300 tabular-nums cursor-default"
      data-testid="watch-season-topic"
      tabIndex={items.length > 0 ? 0 : undefined}
      aria-label={items.length > 0 ? `${label} season topic` : `${label} season`}
    >
      {label}
    </span>
  )
  if (items.length === 0) return badge
  const formatLabel = style !== undefined ? DEBATE_STYLE_LABELS[style as keyof typeof DEBATE_STYLE_LABELS] : undefined
  return (
    <Tooltip>
      <TooltipTrigger asChild>{badge}</TooltipTrigger>
      <TooltipContent side="bottom" align="start" className="max-w-sm">
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide opacity-80">
          {label} {formatLabel ? `${formatLabel} ` : ""}{items.length > 1 ? "topics" : "topic"}
        </div>
        <ul className="space-y-1.5">
          {items.map((item, index) => (
            <li key={index}>
              {(item.title || item.month) && (
                <div className="font-semibold">
                  {item.emoji ? `${item.emoji} ` : ""}
                  {[item.month, item.title].filter(Boolean).join(": ")}
                </div>
              )}
              <div className="whitespace-pre-line">{item.text}</div>
            </li>
          ))}
        </ul>
      </TooltipContent>
    </Tooltip>
  )
}
