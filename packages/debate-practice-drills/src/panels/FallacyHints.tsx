/**
 * @fileoverview Inline "possible fallacies" hints for a block of speech text.
 *
 * Wraps the offline heuristic in `@debate-ai/speech-writer`'s
 * `detectFallacies`. Hints are prompts to look closer, never verdicts, and
 * they critique the argument, not the speaker. Renders nothing when the text
 * has no matches, so it adds no noise to a clean speech.
 *
 * @module debate-practice-drills/panels/FallacyHints
 */

import { useMemo } from "react"
import { detectFallacies, type FallacyKind } from "@debate-ai/speech-writer/src/analysis/detect-fallacies"

const KIND_LABELS: Record<FallacyKind, string> = {
  "ad-hominem": "Ad hominem",
  "straw-man": "Straw man",
  "false-dichotomy": "False dichotomy",
}

export interface FallacyHintsProps {
  /** The speech or argument text to scan. */
  text: string
}

export function FallacyHints({ text }: FallacyHintsProps) {
  const findings = useMemo(() => detectFallacies(text), [text])
  if (findings.length === 0) return null
  return (
    <div className="space-y-1 rounded-md bg-muted/50 p-2" data-testid="fallacy-hints">
      <p className="text-xs font-medium">
        Possible fallacies ({findings.length}) — worth a second look, not a verdict
      </p>
      <ul className="space-y-1 text-xs text-muted-foreground">
        {findings.map((f) => (
          <li key={`${f.kind}-${f.index}`}>
            <span className="font-medium text-foreground">{KIND_LABELS[f.kind]}:</span> “{f.excerpt}” —{" "}
            {f.explanation}
          </li>
        ))}
      </ul>
    </div>
  )
}
