"use client"

/**
 * @fileoverview What the watch page shows once "Reveal decision" is clicked:
 * the overall decision (winner and ballot count) and, underneath, the judges
 * listed under the team they voted for (blue Aff, red Neg). A round whose result can't be found shows a
 * "?" — unknown, not an error.
 *
 * Rendered only after the click; nothing in it exists in the initial markup.
 * @module components/videos/watch/WatchDecision
 */

import { Loader2 } from "lucide-react"
import { cn } from "../../../ui/lib/utils"
import { decisionSummary } from "../../../lib/decision-summary"
import { DECISION_SOURCE_LABELS, type RoundDecision } from "../../../lib/round-decision"
import { SIDE_TEXT } from "./JudgeVotes"

interface WatchDecisionProps {
  affTeam?: string | null
  negTeam?: string | null
  /** The winner the video already records; wins over a looked-up one. */
  storedAffWin?: boolean | null
  /** The decision text the video already records. */
  storedDecision?: string | null
  /** The server's answer, once it arrives. */
  decision: RoundDecision
  /** True until the server has answered. */
  loading: boolean
  className?: string
}

/** The side a team plays, as "Harker LL (Aff)" — or just "Aff" when the team is unnamed. */
function sideLabel(side: "aff" | "neg", team?: string | null): string {
  const name = side === "aff" ? "Aff" : "Neg"
  return team ? `${team} (${name})` : name
}

export function WatchDecision({
  affTeam,
  negTeam,
  storedAffWin,
  storedDecision,
  decision,
  loading,
  className,
}: WatchDecisionProps) {
  const affWin = typeof storedAffWin === "boolean" ? storedAffWin : decision.affWin
  const text = storedDecision?.trim() ? storedDecision : decision.decision
  const summary = decisionSummary(affWin, text, {
    aff: sideLabel("aff", affTeam),
    neg: sideLabel("neg", negTeam),
  })
  const known = summary !== null
  const waiting = loading && !known
  const judgesBySide = {
    aff: decision.judges.filter((judge) => judge.side === "aff"),
    neg: decision.judges.filter((judge) => judge.side === "neg"),
    unknown: decision.judges.filter((judge) => judge.side === null),
  }
  const sidesWithVotes = [...judgesBySide.aff, ...judgesBySide.neg]

  return (
    <div className={cn("flex flex-col gap-1 text-xs", className)} data-testid="watch-decision">
      {waiting ? (
        <span className="flex items-center gap-1.5 text-muted-foreground" role="status">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          Looking up the decision…
        </span>
      ) : known ? (
        <span className="font-medium text-amber-500" data-testid="decision-summary">
          {summary}
        </span>
      ) : (
        <span
          className="flex items-center gap-1.5 text-muted-foreground"
          title="No result for this round could be found on Tabroom or College Debate Results"
          data-testid="decision-unknown"
        >
          <span className="rounded border border-border px-1.5 py-0.5 font-bold text-foreground" aria-hidden="true">
            ?
          </span>
          <span>Decision unknown</span>
        </span>
      )}

      {decision.judges.length > 0 && (
        <div className="flex flex-col gap-1" aria-label="Judges and their votes" data-testid="decision-judges">
          {sidesWithVotes.length > 0 && (
            <div className="grid grid-cols-2 gap-x-4">
              {(["aff", "neg"] as const).map((side) => (
                <div key={side} className="flex flex-col gap-0.5" data-testid={`decision-judges-${side}`}>
                  <span className={cn("font-medium", SIDE_TEXT[side])}>
                    {sideLabel(side, side === "aff" ? affTeam : negTeam)}
                  </span>
                  <ul className="flex flex-col gap-0.5" aria-label={`Judges who voted ${side === "aff" ? "Aff" : "Neg"}`}>
                    {judgesBySide[side].map((judge, index) => (
                      <li key={`${judge.name}-${index}`} className="font-medium text-foreground">
                        {judge.name}
                        {judge.squirreled ? "*" : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
          {judgesBySide.unknown.length > 0 && (
            <ul
              className="flex flex-wrap gap-x-1.5 text-muted-foreground"
              aria-label="Judges whose vote is unknown"
              data-testid="decision-judges-unknown"
            >
              {judgesBySide.unknown.map((judge, index) => (
                <li key={`${judge.name}-${index}`}>
                  <span className="font-medium text-foreground">{judge.name}</span> (side unknown)
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {decision.url && decision.source && (
        <a
          href={decision.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          Results on {DECISION_SOURCE_LABELS[decision.source]}
        </a>
      )}
    </div>
  )
}
