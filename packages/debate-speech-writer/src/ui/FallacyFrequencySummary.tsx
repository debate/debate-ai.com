/**
 * @fileoverview "How often do my speeches trip the fallacy hints?" — a
 * summary over many saved speeches, built by `buildFallacyFrequency`.
 *
 * The companion of `FallacyHints` (one speech, while typing). Same framing:
 * the counts are phrasing worth a second look, never a verdict. Nothing is
 * stored; the numbers are recomputed from the speeches passed in.
 *
 * @module debate-speech-writer/ui/FallacyFrequencySummary
 */

import { useMemo } from "react"
import type { FallacyKind } from "../analysis/detect-fallacies"
import { buildFallacyFrequency, type FallacyFrequencySpeech } from "../analysis/fallacy-frequency"

const KIND_LABELS: Record<FallacyKind, string> = {
  "ad-hominem": "Ad hominem",
  "straw-man": "Straw man",
  "false-dichotomy": "False dichotomy",
}

/** How many speeches the "Most hints" list names before it stops. */
export const FALLACY_SUMMARY_TOP_SPEECHES = 3

export interface FallacyFrequencySummaryProps {
  speeches: readonly FallacyFrequencySpeech[]
  /** Shown when no speech has any text yet. */
  emptyMessage?: string
}

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`

export function FallacyFrequencySummary({
  speeches,
  emptyMessage = "No saved speeches to scan yet.",
}: FallacyFrequencySummaryProps) {
  const stats = useMemo(() => buildFallacyFrequency(speeches), [speeches])

  if (stats.speechesScanned === 0) {
    return (
      <p className="text-sm text-muted-foreground" data-testid="fallacy-frequency-summary">
        {emptyMessage}
      </p>
    )
  }

  const scanned = `${plural(stats.speechesScanned, "speech", "speeches")}, ${plural(stats.wordsScanned, "word")}`

  if (stats.totalHints === 0) {
    return (
      <p className="text-sm text-muted-foreground" data-testid="fallacy-frequency-summary">
        No fallacy hints across {scanned}.
      </p>
    )
  }

  const top = stats.speechesWithHints.slice(0, FALLACY_SUMMARY_TOP_SPEECHES)

  return (
    <div className="space-y-2 text-sm" data-testid="fallacy-frequency-summary">
      <p>
        <span className="font-medium">{plural(stats.totalHints, "hint")}</span> across {scanned} —{" "}
        {stats.per1000Words.toLocaleString(undefined, { maximumFractionDigits: 1 })} per 1,000 words.
        {stats.mostCommon && <> Most common: {KIND_LABELS[stats.mostCommon]}.</>}
      </p>
      <ul className="flex flex-wrap gap-2 text-xs" aria-label="Hints by kind">
        {(Object.keys(KIND_LABELS) as FallacyKind[]).map((kind) => (
          <li key={kind} className="rounded-md border border-border px-2 py-1">
            {KIND_LABELS[kind]}: <span className="font-medium">{stats.byKind[kind]}</span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        Most hints: {top.map((s) => `${s.label} (${s.hints})`).join(", ")}
        {stats.speechesWithHints.length > top.length ? ", …" : ""}
      </p>
      <p className="text-xs text-muted-foreground">
        Hints flag phrasing worth a second look, not a verdict.
      </p>
    </div>
  )
}
