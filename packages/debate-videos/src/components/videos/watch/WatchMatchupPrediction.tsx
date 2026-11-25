/**
 * @fileoverview The watch page's "Simulated matchup" card: which team the
 * rankings expect to win this round, on the sides they debated and at its
 * stage (one judge in prelims, a 3- or 5-judge panel in elims), with a
 * seeded 1,000-round simulation and, when the decision is recorded, whether
 * the favorite won (hidden until the viewer clicks "Reveal decision", like
 * every other place that names the winner). A team no ranking names plays as a stand-in, said under
 * the bar. Math in `lib/watch-matchup-prediction`.
 * @module components/watch/WatchMatchupPrediction
 */

"use client"

import type { ReactNode } from "react"
import { cn } from "../../../ui/lib/utils"
import { useDecisionReveal } from "../../../hooks/useDecisionReveal"
import type { WatchMatchupPrediction as Prediction } from "../../../lib/watch-matchup-prediction"
import { seasonLabel } from "../../../lib/watch-team-history"

const pct = (p: number) => `${(p * 100).toFixed(1)}%`

/** How the round was decided, in words: "a 3-judge Quarters panel". */
function stageText(p: Prediction): string {
  if (!p.stageKnown) return "a prelim (round not recorded)"
  if (p.panel === 1) return `${p.roundLabel} (prelim, one judge)`
  return `a ${p.panel}-judge ${p.roundLabel} panel`
}

/** What the numbers come from, under the card. */
function basisText(p: Prediction): string {
  if (p.basis === "debatedata") {
    const season = p.season ? `${seasonLabel(p.season)} ` : ""
    return `A simulation from debatedata's ${season}college ratings (each team's skill and its uncertainty; that table has no side records), not a judge's decision.`
  }
  const season = p.season ? `the ${seasonLabel(p.season)} season's` : "this season's"
  return `A simulation from ${season} ratings, each team's aff and neg record and the division's side split, not a judge's decision.`
}

/** How a team no ranking named was played. */
function standInText(p: Prediction): string {
  if (p.basis === "debatedata") return "is not in debatedata's top 100 that season, so it plays as a team just outside it."
  if (p.standInSchool) return `has no ranking of its own, so it plays as an average ${p.standInSchool} team.`
  return "has no ranking of its own, so it plays as a typical team in the field."
}

/**
 * @param props.prediction - Output of `predictWatchMatchup`.
 * @param props.affLabel - The aff team: its label pill, or its name as the video gives it.
 * @param props.negLabel - The neg team: its label pill, or its name as the video gives it.
 * @param props.decision - The recorded ballot count, e.g. `"2-1"`, if any.
 * @param props.videoId - The round's video id; the actual decision waits for its Reveal decision.
 */
export function WatchMatchupPrediction({
  prediction: p,
  affLabel,
  negLabel,
  decision,
  videoId,
}: {
  prediction: Prediction
  affLabel: ReactNode
  negLabel: ReactNode
  decision?: string | null
  videoId: string
}) {
  const [revealed, reveal] = useDecisionReveal(videoId)
  const favoriteLabel = p.favorite === "aff" ? affLabel : p.favorite === "neg" ? negLabel : null
  const favoriteWin = p.favorite === "neg" ? p.negWin : p.affWin
  return (
    <div className="rounded-lg border bg-card p-3 space-y-2.5" aria-label="Simulated matchup">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">
          Simulated matchup
          <span className="ml-2 rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Simulation
          </span>
        </h3>
        <span className="text-xs text-muted-foreground">{stageText(p)}</span>
      </header>

      <p className="text-sm">
        {favoriteLabel ? (
          <>
            Predicted winner:{" "}
            <span className={cn("font-semibold", p.favorite === "aff" ? "text-blue-400" : "text-red-400")}>
              {favoriteLabel} ({p.favorite})
            </span>{" "}
            at {pct(favoriteWin)}.
          </>
        ) : (
          <>Too close to call: each side wins about half the time.</>
        )}
      </p>

      <div>
        <div
          className="flex h-2.5 overflow-hidden rounded-full bg-muted"
          role="img"
          aria-label={`Aff ${pct(p.affWin)}, neg ${pct(p.negWin)}`}
        >
          <div className="bg-blue-500" style={{ width: `${p.affWin * 100}%` }} />
          <div className="bg-red-500" style={{ width: `${p.negWin * 100}%` }} />
        </div>
        <div className="mt-1 flex justify-between gap-2 text-xs tabular-nums">
          <span className="min-w-0 truncate">
            <span className="font-semibold text-blue-400">Aff</span> {affLabel} {pct(p.affWin)}
          </span>
          <span className="min-w-0 truncate text-right">
            {pct(p.negWin)} {negLabel} <span className="font-semibold text-red-400">Neg</span>
          </span>
        </div>
      </div>

      <p className="text-xs text-muted-foreground tabular-nums">
        Simulated {p.simulated.rounds.toLocaleString()} rounds: aff won {p.simulated.aWins.toLocaleString()}, neg
        won {p.simulated.bWins.toLocaleString()}.
      </p>

      {p.actual && !revealed && (
        <button
          type="button"
          onClick={reveal}
          className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          Actual decision hidden. Reveal decision
        </button>
      )}

      {p.actual && revealed && (
        <p className="text-xs">
          Actual decision:{" "}
          <span className={cn("font-semibold", p.actual === "aff" ? "text-blue-400" : "text-red-400")}>
            {p.actual === "aff" ? affLabel : negLabel} ({p.actual})
          </span>
          {decision ? ` ${decision}` : ""}
          {p.upset === true && " — an upset."}
          {p.upset === false && " — the favorite won."}
        </p>
      )}

      {p.standIn && (
        <p className="text-xs text-muted-foreground">
          {p.standIn === "aff" ? affLabel : negLabel} {standInText(p)}
        </p>
      )}

      <p className="text-[11px] text-muted-foreground">{basisText(p)}</p>
    </div>
  )
}
