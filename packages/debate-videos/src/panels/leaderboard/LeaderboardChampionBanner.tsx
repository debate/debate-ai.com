/**
 * @fileoverview Champion banner card with 3-D mouse-follow tilt effect for the leaderboard panel.
 * @module components/debate/DebateVideos/panels/LeaderboardChampionBanner
 */

import Image from "next/image"
import { Trophy } from "lucide-react"
import { topicDisplayLines, type SeasonalTopic } from "../../lib/debate-topics"
import { DIVISION_CONFIG } from "./leaderboardUtils"
import type { Division } from "./leaderboardUtils"

/** Props for the {@link LeaderboardChampionBanner} component. */
interface ChampionBannerProps {
  /** Active debate division; used to resolve the logo image and label text. */
  division: Division
  /** Selected season year string (e.g. `"2026"`). */
  year: string
  /**
   * Resolution topic for the season: a yearly string, a list of monthly
   * LD/PF topics, or a legacy HTML string with `<br>` separators.
   */
  topic?: string | SeasonalTopic[]
  /** Short yearly label (Policy / NDT) shown above the resolution. */
  topicName?: string
  /** Winning team name for the season. */
  champion?: string
}

function TopicCopy({
  topic,
  topicName,
}: {
  topic: string | SeasonalTopic[]
  topicName?: string
}) {
  if (Array.isArray(topic)) {
    return (
      <div className="space-y-1.5">
        {topic.map((item, index) => (
          <p
            key={`${item.start_month ?? "topic"}-${index}`}
            className="text-xs sm:text-sm text-muted-foreground leading-relaxed"
          >
            {item.start_month ? (
              <span className="font-medium text-foreground">{item.start_month}: </span>
            ) : null}
            {item.topic}
          </p>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {topicName ? (
        <p className="font-semibold text-sm text-foreground">{topicName}</p>
      ) : null}
      <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
        {topicDisplayLines(topic)}
      </p>
    </div>
  )
}

/**
 * Renders a card showing the current division logo, season label, champion team name,
 * and resolution topic.
 *
 * The logo card uses a mouse-follow 3-D perspective tilt so it visually "pops" as
 * the cursor moves over it, implemented with inline style transforms.
 * Returns `null` when neither `topic` nor `champion` is available.
 *
 * @param props - See {@link ChampionBannerProps}.
 */
export function LeaderboardChampionBanner({
  division,
  year,
  topic,
  topicName,
  champion,
}: ChampionBannerProps) {
  const divConfig = DIVISION_CONFIG.find((d) => d.value === division)!
  const hasTopic = Array.isArray(topic) ? topic.length > 0 : Boolean(topic)
  if (!hasTopic && !champion) return null

  return (
    <div className="flex items-center gap-4 rounded-lg border bg-card mb-4">
      {/* Logo card with mouse-follow perspective tilt */}
      <article
        className="p-6 w-[120px] h-[120px] sm:w-[250px] sm:h-[250px] shrink-0 rounded-lg overflow-hidden will-change-transform"
        onMouseMove={(e) => {
          const el = e.currentTarget
          el.style.transition = "transform 0.1s ease-out"
          const rect = el.getBoundingClientRect()
          const x = (e.clientX - rect.left) / rect.width
          const y = (e.clientY - rect.top) / rect.height
          el.style.transform = `perspective(600px) rotateX(${(y - 0.5) * -22}deg) rotateY(${(x - 0.5) * 22}deg) scale(1.06)`
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget
          el.style.transition = "transform 0.45s ease-out"
          el.style.transform = "perspective(600px) rotateX(0deg) rotateY(0deg) scale(1)"
        }}
      >
        <Image
          src={divConfig.logoSrc}
          alt={divConfig.label}
          width={100}
          height={100}
          className="w-[108px] h-[108px] sm:w-[238px] sm:h-[238px] object-contain"
        />
      </article>

      {/* Season info: label, champion, topic */}
      <div className="min-w-0 flex-1 py-4 pr-4">
        <div className="text-xs text-muted-foreground mb-1">
          {divConfig.label} {Number(year) - 1}-{year}
        </div>
        {champion && (
          <div className="flex items-center gap-2 mb-2">
            <Trophy className="h-4 w-4 text-yellow-500 shrink-0" />
            <span className="font-bold text-sm sm:text-base">{champion}</span>
          </div>
        )}
        {hasTopic && topic ? <TopicCopy topic={topic} topicName={topicName} /> : null}
      </div>
    </div>
  )
}
