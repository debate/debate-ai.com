/**
 * @fileoverview The round as a bar under the player: one segment per speech,
 * coloured by side, with a playhead.
 *
 * Once the video's length is known and the documents gave speeches their
 * start times, each segment is as wide as the speech ran — a long 1NC and a
 * short 1AR are visible at a glance, and the stretch before the first speech
 * is left as a blank gap. Until then (or for a round with no timecodes at
 * all) the segments are equal, and the bar is a row of speech buttons.
 *
 * Clicking a segment seeks to that speech when it is timed and asks the side
 * panel to show it either way.
 * @module components/watch/WatchSpeechTimeline
 */

"use client"

import { playingSpeechIndex, type RoundSpeech } from "../../lib/round-speeches"
import { formatTimecode } from "../../lib/video-documents"
import { SPEECH_SIDE_STYLES } from "./speech-side-styles"

interface WatchSpeechTimelineProps {
  speeches: RoundSpeech[]
  currentTime: number
  /** The video's length in seconds; 0 while unknown. */
  duration: number
  onSelect: (speech: RoundSpeech) => void
}

interface Segment {
  speech: RoundSpeech | null
  /** Relative width — seconds when proportional, 1 when even. */
  weight: number
}

/**
 * Builds the bar's segments; exported for the tests.
 *
 * @returns The segments, and whether their widths are real durations.
 */
export function speechTimelineSegments(
  speeches: RoundSpeech[],
  duration: number,
): { segments: Segment[]; proportional: boolean } {
  const timed = speeches
    .filter((speech) => speech.startSeconds !== null && speech.startSeconds < (duration || Infinity))
    .sort((a, b) => (a.startSeconds as number) - (b.startSeconds as number))

  if (duration <= 0 || timed.length === 0) {
    return { segments: speeches.map((speech) => ({ speech, weight: 1 })), proportional: false }
  }

  const segments: Segment[] = []
  const first = timed[0].startSeconds as number
  if (first > 0) segments.push({ speech: null, weight: first })
  timed.forEach((speech, index) => {
    const start = speech.startSeconds as number
    const end = index + 1 < timed.length ? (timed[index + 1].startSeconds as number) : duration
    // A floor keeps a speech that starts where the next does still clickable.
    segments.push({ speech, weight: Math.max(end - start, duration / 200) })
  })
  return { segments, proportional: true }
}

export function WatchSpeechTimeline({ speeches, currentTime, duration, onSelect }: WatchSpeechTimelineProps) {
  const { segments, proportional: isProportional } = speechTimelineSegments(speeches, duration)
  const playingIndex = playingSpeechIndex(speeches, currentTime)
  const playing = playingIndex >= 0 ? speeches[playingIndex] : null
  const untimed = speeches.filter((speech) => speech.startSeconds === null).length

  return (
    <div className="space-y-1">
      <div
        role="group"
        aria-label="Speech timeline"
        className="relative flex h-9 overflow-hidden rounded-md border border-border bg-muted"
      >
        {segments.map(({ speech, weight }, index) => {
          if (!speech) return <div key={`gap-${index}`} style={{ flex: `${weight} 1 0` }} />
          const styles = SPEECH_SIDE_STYLES[speech.side]
          return (
            <button
              key={speech.key}
              type="button"
              onClick={() => onSelect(speech)}
              title={speech.startSeconds !== null ? `${speech.heading} · ${formatTimecode(speech.startSeconds)}` : speech.heading}
              aria-current={speech === playing ? "true" : undefined}
              style={{ flex: `${weight} 1 0` }}
              className={`min-w-0 overflow-hidden border-r border-background px-1 text-[11px] font-semibold last:border-r-0 transition-colors ${
                speech === playing ? styles.solid : `${styles.soft} hover:brightness-95`
              }`}
            >
              <span className="block truncate">{speech.label}</span>
            </button>
          )
        })}
        {isProportional && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 w-0.5 bg-foreground"
            style={{ left: `${Math.min(100, (currentTime / duration) * 100)}%` }}
          />
        )}
      </div>
      {isProportional && untimed > 0 && (
        <p className="text-[11px] text-muted-foreground">
          {untimed} speech{untimed === 1 ? " has" : "es have"} no start time and {untimed === 1 ? "is" : "are"} left off the bar.
        </p>
      )}
    </div>
  )
}
