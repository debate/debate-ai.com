"use client"

import { useMemo } from "react"
import { cn } from "../../ui/lib/utils"
import { useAllRankingDatasets } from "../../hooks/useAllRankingDatasets"
import { isRankedSeasonRound } from "../../hooks/useVideoTeamRankings"
import { findVideoTeamRanking, videoStyleDatasetId } from "../../panels/leaderboard/profile/rankingProfileHelpers"
import {
  modelMatchup,
  recommendSide,
  type MatchupModelResult,
  type MatchupWeights,
  type RankingDataset,
  type RankingEntry,
} from "@debate/rankings-adapter"
import type { VideoType } from "../../types/videos"

const DEFAULT_WEIGHTS: MatchupWeights = { school: 0.2, individual: 0.2 }
const pct = (p: number) => `${(p * 100).toFixed(1)}%`
const sideLabel = (side: "aff" | "neg") => (side === "aff" ? "Aff" : "Neg")
const otherSide = (side: "aff" | "neg"): "aff" | "neg" => (side === "aff" ? "neg" : "aff")

function formatRating(r: number): string {
  return r.toFixed(1)
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border bg-background px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold tabular-nums">{value}</div>
    </div>
  )
}

export function WatchRankingsPrediction({ video }: { video: VideoType }) {
  const style = video[6]
  const affTeam = video[9]
  const negTeam = video[10]
  const enabled = Boolean(affTeam && negTeam) && isRankedSeasonRound(video)
  const { datasets, loading, error } = useAllRankingDatasets(enabled)

  const result = useMemo(() => {
    if (!enabled || loading || error || datasets.length === 0 || !affTeam || !negTeam) return null

    const datasetId = videoStyleDatasetId(style)
    if (!datasetId) return null

    const dataset = datasets.find((d) => d.id === datasetId)
    if (!dataset) return null

    const aEntry = findVideoTeamRanking(datasets, style, affTeam)
    const bEntry = findVideoTeamRanking(datasets, style, negTeam)
    if (!aEntry || !bEntry) return null

    const matchup = modelMatchup(aEntry, bEntry, dataset, datasets, DEFAULT_WEIGHTS)
    return { matchup, aEntry, bEntry }
  }, [enabled, loading, error, datasets, style, affTeam, negTeam])

  if (loading) {
    return (
      <section aria-label="Rankings prediction" className="space-y-2">
        <h2 className="text-sm font-semibold">Rankings prediction</h2>
        <div className="min-w-0 rounded-lg border bg-card p-3 space-y-3 animate-pulse">
          <div className="h-4 bg-muted rounded w-1/4" />
          <div className="grid grid-cols-2 gap-3">
            <div className="h-20 bg-muted rounded" />
            <div className="h-20 bg-muted rounded" />
          </div>
        </div>
      </section>
    )
  }

  if (error) {
    return (
      <section aria-label="Rankings prediction" className="space-y-2">
        <h2 className="text-sm font-semibold">Rankings prediction</h2>
        <div className="rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
          Could not load rankings: {error}
        </div>
      </section>
    )
  }

  if (!result || !affTeam || !negTeam) {
    return null
  }

  const { matchup, aEntry, bEntry } = result
  const { a, b, sides, aSideTilt, bSideTilt } = matchup

  return (
    <section aria-label="Rankings prediction" className="space-y-2">
      <h2 className="text-sm font-semibold">Rankings prediction</h2>
      <div className="min-w-0 rounded-lg border bg-card p-3 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">Who wins? (Glicko-2 model)</h3>
          <span className="text-xs text-muted-foreground">
            Based on full-season ratings, blended with school & individual performance
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <SideCard
            teamName={affTeam}
            side="aff"
            probability={sides[0].prelim}
            elim3={sides[0].elim3}
            elim5={sides[0].elim5}
            rating={a.blended}
            deviation={aEntry.deviation}
            matches={aEntry.matches}
            sideTilt={aSideTilt}
            opponentName={negTeam}
            opponentSide="neg"
          />
          <SideCard
            teamName={negTeam}
            side="neg"
            probability={sides[1].prelim}
            elim3={sides[1].elim3}
            elim5={sides[1].elim5}
            rating={b.blended}
            deviation={bEntry.deviation}
            matches={bEntry.matches}
            sideTilt={bSideTilt}
            opponentName={affTeam}
            opponentSide="aff"
          />
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Prelim = 1 judge; Elim = 3/5 judge panel (majority)</span>
        </div>

        <div className="text-xs text-muted-foreground">
          Side effects: field aff/neg split + each team&apos;s own aff vs. neg tilt, shrunk by round count.
          Ratings only reflect tournaments in the rankings — treat as estimates, not guarantees.
        </div>

        <div className="border-t pt-3">
          <h4 className="text-xs font-medium text-muted-foreground mb-2">Side recommendation</h4>
          <div className="flex flex-wrap gap-3 text-sm">
            {recommendSide(matchup, "prelim") ? (
              <>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-500/10 text-blue-400">
                  <strong>Prelims:</strong> {affTeam} should take {sideLabel(recommendSide(matchup, "prelim")!.side)} (+{recommendSide(matchup, "prelim")!.margin.toFixed(1)}%)
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-500/10 text-red-400">
                  <strong>Prelims:</strong> {negTeam} should take {sideLabel(otherSide(recommendSide(matchup, "prelim")!.side))} (+{recommendSide(matchup, "prelim")!.margin.toFixed(1)}%)
                </span>
              </>
            ) : (
              <span className="px-2 py-0.5 rounded bg-muted">No strong side preference in prelims</span>
            )}
            {recommendSide(matchup, "elim") ? (
              <>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-500/10 text-blue-400">
                  <strong>Elims:</strong> {affTeam} should take {sideLabel(recommendSide(matchup, "elim")!.side)} (+{recommendSide(matchup, "elim")!.margin.toFixed(1)}%)</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-500/10 text-red-400">
                  <strong>Elims:</strong> {negTeam} should take {sideLabel(otherSide(recommendSide(matchup, "elim")!.side))} (+{recommendSide(matchup, "elim")!.margin.toFixed(1)}%)</span>
              </>
            ) : (
              <span className="px-2 py-0.5 rounded bg-muted">No strong side preference in elims</span>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

function SideCard({
  teamName,
  side,
  probability,
  elim3,
  elim5,
  rating,
  deviation,
  matches,
  sideTilt,
  opponentName,
  opponentSide,
}: {
  teamName: string
  side: "aff" | "neg"
  probability: number
  elim3: number
  elim5: number
  rating: number
  deviation: number
  matches: number
  sideTilt: number
  opponentName: string
  opponentSide: "aff" | "neg"
}) {
  const isAff = side === "aff"

  return (
    <div
      className={cn(
        "relative min-w-0 rounded-md border bg-card p-3 space-y-2",
        isAff ? "border-blue-200/50 dark:border-blue-800/50" : "border-red-200/50 dark:border-red-800/50",
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span
          className={cn(
            "text-[10px] font-semibold uppercase tracking-wide",
            isAff ? "text-blue-400" : "text-red-400",
          )}
        >
          {sideLabel(side)}
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">{matches} rounds</span>
      </div>
      <div className="truncate font-medium">{teamName}</div>
      <div className="text-xs text-muted-foreground">vs {opponentName} ({sideLabel(opponentSide)})</div>

      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Prelim (1 judge)</span>
          <span className="font-semibold tabular-nums">{pct(probability)}</span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className={cn("h-full transition-all duration-300", isAff ? "bg-blue-500" : "bg-red-500")}
            style={{ width: `${probability * 100}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1.5 text-xs">
        <Stat label="Elim (3)" value={pct(elim3)} />
        <Stat label="Elim (5)" value={pct(elim5)} />
        <Stat label="Blended rating" value={formatRating(rating)} />
        <Stat label="Deviation" value={`±${formatRating(deviation)}`} />
      </div>

      <div className="text-[10px] text-muted-foreground">
        Side tilt: {sideTilt >= 0 ? "+" : ""}{sideTilt.toFixed(2)} log-odds
      </div>
    </div>
  )
}