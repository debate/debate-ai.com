/**
 * @fileoverview Fallacy-hints button on a speech row in the round sidebar.
 * Hovering (or focusing) it lists the possible informal fallacies the offline
 * `detectFallacies` heuristic found in the speech doc. Hints are prompts to
 * look closer, never verdicts. Renders nothing when the doc has no matches.
 */

"use client"

import { AlertTriangle } from "lucide-react"
import type { FallacyFinding, FallacyKind } from "@debate-ai/speech-writer/src/analysis/detect-fallacies"
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/primitives/tooltip"

const KIND_LABELS: Record<FallacyKind, string> = {
  "ad-hominem": "Ad hominem",
  "straw-man": "Straw man",
  "false-dichotomy": "False dichotomy",
}

export function SpeechFallacyHintsButton({
  speechName,
  findings,
}: {
  speechName: string
  findings: readonly FallacyFinding[]
}) {
  if (findings.length === 0) return null
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={`${speechName} possible fallacies (${findings.length})`}
          className="flex shrink-0 items-center gap-0.5 rounded-[var(--border-radius)] px-1 py-0.5 text-amber-600 hover:bg-[var(--background-indent)] dark:text-amber-400"
        >
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="text-[10px] font-medium">{findings.length}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="right"
        align="start"
        collisionPadding={8}
        className="w-max max-w-[min(26rem,calc(100vw-2rem))] px-2.5 py-1.5 text-left text-[11px] text-wrap"
      >
        <p className="pb-1 font-bold">{speechName}: possible fallacies — worth a second look, not a verdict</p>
        <ul className="flex max-h-[min(60vh,28rem)] flex-col gap-1 overflow-y-auto overscroll-contain pr-1">
          {findings.map((f) => (
            <li key={`${f.kind}-${f.index}`} className="leading-tight break-words">
              <span className="font-semibold">{KIND_LABELS[f.kind]}:</span> “{f.excerpt}” — {f.explanation}
            </li>
          ))}
        </ul>
      </TooltipContent>
    </Tooltip>
  )
}
