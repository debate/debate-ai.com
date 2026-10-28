"use client"

import { useMemo, type ReactNode } from "react"
import { cn } from "../../../ui/lib/utils"
import { useAllRankingDatasets } from "@debate-ai/rankings-adapter/src/leaderboard/hooks/useAllRankingDatasets"
import { isRankedSeasonRound } from "../../../hooks/useVideoTeamRankings"
import { findVideoTeamRanking, videoStyleDatasetId } from "@debate-ai/rankings-adapter/src/leaderboard/profile/rankingProfileHelpers"
import {
  modelMatchup,
  recommendSide,
  type MatchupWeights,
  type RankingDataset,
  type RankingEntry,
} from "@debate-ai/rankings-adapter"
import type { VideoType } from "../../../types/videos"
import { TeamCodeLabel } from "@debate-ai/rankings-adapter/src/leaderboard/team-label/TeamLabel"

const DEFAULT_WEIGHTS: MatchupWeights = { school: 0.2, individual: 0.2 }
const pct = (p: number) => `${(p * 100).toFixed(1)}%`
const sideLabel = (side: "aff" | "neg") => (side === "aff" ? "Aff" : "Neg")
const otherSide = (side: "aff" | "neg"): "aff" | "neg" => (side === "aff" ? "neg" : "aff")

function formatRating(r: number): string {
  return r.toFixed(1)
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border bg-background px-1.5 py-1">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-xs font-semibold tabular-nums">{value}</div>
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
      <section aria-label="Rankings prediction" className="space-y-1">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Rankings prediction
        </h2>
        <div className="min-w-0 rounded-lg border bg-card p-2 animate-pulse">
          <div className="h-3 bg-muted rounded w-1/3" />
          <div className="mt-2 grid grid-cols-2 gap-2">
            <div className="h-10 bg-muted rounded" />
            <div className="h-10 bg-muted rounded" />
          </div>
        </div>
      </section>
    )
  }

  if (error) {
    return (
      <section aria-label="Rankings prediction" className="space-y-1">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Rankings prediction
        </h2>
        <div className="rounded-md border border-destructive bg-destructive/10 p-2 text-xs text-destructive">
          Could not load rankings: {error}
        </div>
      </section>
    )
  }

  if (!result || !affTeam || !negTeam) {
    return null
  }

  const { matchup, aEntry, bEntry } = result
  const { sides } = matchup
  const [aSide, bSide] = sides
  const recP = recommendSide(matchup, "prelim")
  const recE = recommendSide(matchup, "elim")

  return (
    <section aria-label="Rankings prediction" className="space-y-1">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Rankings prediction
      </h2>
      <div className="min-w-0 rounded-lg border bg-card p-2 space-y-1.5">
        <div className="grid grid-cols-2 gap-2">
          <MiniCard
            teamName={<TeamCodeLabel label={affTeam} ranking={aEntry} side="aff" />}
            side="aff"
            probability={aSide.prelim}
            elim3={aSide.elim3}
            elim5={aSide.elim5}
            rating={matchup.a.blended}
            deviation={aEntry.deviation}
            matches={aEntry.matches}
            opponent={negTeam}
          />
          <MiniCard
            teamName={<TeamCodeLabel label={negTeam} ranking={bEntry} side="neg" />}
            side="neg"
            probability={bSide.prelim}
            elim3={bSide.elim3}
            elim5={bSide.elim5}
            rating={matchup.b.blended}
            deviation={bEntry.deviation}
            matches={bEntry.matches}
            opponent={affTeam}
          />
        </div>

        {recP || recE ? (
          <div className="col-span-2 flex flex-col gap-1 text-[10px] text-muted-foreground leading-none">
            {recP && (
              <div className="flex items-center gap-1">
                <span className="font-medium text-foreground">Prelims:</span>{" "}
                {affTeam} should take {sideLabel(recP.side)} (+{recP.margin.toFixed(1)}%)
              </div>
            )}
            {recE && (
              <div className="flex items-center gap-1">
                <span className="font-medium text-foreground">Elims:</span>{" "}
                {affTeam} should take {sideLabel(recE.side)} (+{recE.margin.toFixed(1)}%)
              </div>
            )}
          </div>
        ) : null}
      </div>
    </section>
  )
}

function MiniCard({
  teamName,
  side,
  probability,
  elim3,
  elim5,
  rating,
  deviation,
  matches,
  opponent,
}: {
  teamName: ReactNode
  side: "aff" | "neg"
  probability: number
  elim3: number
  elim5: number
  rating: number
  deviation: number
  matches: number
  opponent: string
}) {
  const isAff = side === "aff"

  return (
    <div
      className={cn(
        "relative min-w-0 rounded-md border bg-card p-2 space-y-1",
        isAff ? "border-blue-200/50 dark:border-blue-800/50" : "border-red-200/50 dark:border-red-800/50",
      )}
    >
      <div className="flex items-baseline justify-between gap-1">
        <span
          className={cn(
            "text-[10px] font-semibold uppercase tracking-wide",
            isAff ? "text-blue-400" : "text-red-400",
          )}
        >
          {sideLabel(side)}
        </span>
        <span className="text-[10px] text-muted-foreground">{matches} rounds</span>
      </div>
      <div className="min-w-0 font-medium text-sm">{teamName}</div>
      <div className="text-[10px] text-muted-foreground">vs {opponent}</div>

      <div className="flex items-center justify-between text-[11px]">
        <span className="text-muted-foreground">Prelim</span>
        <span className="font-semibold tabular-nums">{pct(probability)}</span>
      </div>

      <div className="grid grid-cols-4 gap-1">
        <Stat label="Elim 3" value={pct(elim3)} />
        <Stat label="Elim 5" value={pct(elim5)} />
        <Stat label="Rating" value={formatRating(rating)} />
        <Stat label="±Dev" value={formatRating(deviation)} />
      </div>
    </div>
  )
}
