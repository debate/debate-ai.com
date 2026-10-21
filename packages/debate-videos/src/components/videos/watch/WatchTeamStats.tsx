/**
 * @fileoverview The two teams of a round on its watch page: each team's
 * rankings row (rank, rating, matches, side win rates) and its radar chart,
 * with the opponent overlaid as a dashed polygon so the matchup reads at a
 * glance. When both teams are found, a simulated matchup above the cards
 * predicts the winner for the sides they debated and the round's stage (see
 * `WatchMatchupPrediction`). Renders nothing unless at least one team is
 * found in the rankings.
 *
 * The lookup is the one the list layout's Aff and Neg cells use, so it shares
 * their limit: only a current-season round of a ranked style is matched (see
 * `isRankedSeasonRound`), since a past season's team code names other people.
 * @module components/watch/WatchTeamStats
 */

"use client"

import type { ReactNode } from "react"
import { useAllRankingDatasets } from "../../../hooks/useAllRankingDatasets"
import { isRankedSeasonRound } from "../../../hooks/useVideoTeamRankings"
import {
  findVideoTeamProfile,
  teamHref,
  teamRadarData,
  type ProfileEntry,
} from "../../../panels/leaderboard/profile/rankingProfileHelpers"
import { TeamRadarChart } from "../../../panels/leaderboard/profile/TeamRadarChart"
import { cn } from "../../../ui/lib/utils"
import { predictWatchMatchup } from "../../../lib/watch-matchup-prediction"
import { WatchMatchupPrediction } from "./WatchMatchupPrediction"
import { TeamCodeLabel } from "../../navigation/team-label/TeamLabel"
import type { VideoType } from "../../../types/videos"

const rating = (n: number) => n.toFixed(1)
const percent = (n: number | null) =>
  n === null ? "—" : `${Number.isInteger(n) ? n : n.toFixed(1)}%`

/** One labelled number in a team's stat grid. */
function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-md border bg-background px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold tabular-nums">{value}</div>
    </div>
  )
}

/** One team's card: name linking to its profile, its stats, its radar. */
function TeamCard({
  side,
  label,
  item,
  opponent,
}: {
  side: "aff" | "neg"
  label: string
  item: ProfileEntry
  opponent: { label: string; item: ProfileEntry } | null
}) {
  const { entry, fieldSize, datasetLabel } = item
  const data = teamRadarData(item)
  const opponentData = opponent ? teamRadarData(opponent.item) : null
  return (
    <div className="min-w-0 rounded-lg border bg-card p-3 space-y-3">
      <header className="flex items-baseline justify-between gap-2">
        <div className="min-w-0">
          <span
            className={cn(
              "mr-1.5 text-[10px] font-semibold uppercase tracking-wide",
              side === "aff" ? "text-blue-400" : "text-red-400",
            )}
          >
            {side}
          </span>
          <TeamCodeLabel label={label} ranking={entry} side={side} href={teamHref(entry)} className="font-semibold" />
          <div className="truncate text-xs text-muted-foreground">
            {entry.school} · {entry.name}
          </div>
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">{datasetLabel}</span>
      </header>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        <Stat label={`Rank of ${fieldSize}`} value={`#${entry.rank}`} />
        <Stat label="Rating" value={rating(entry.adjustedRating)} />
        <Stat label="Deviation" value={`±${rating(entry.deviation)}`} />
        <Stat label="Matches" value={entry.matches} />
        <Stat label="Aff win" value={percent(entry.affWinRate)} />
        <Stat label="Neg win" value={percent(entry.negWinRate)} />
        <Stat label="Elim aff" value={percent(entry.affElimWinRate)} />
        <Stat label="Elim neg" value={percent(entry.negElimWinRate)} />
      </div>
      <TeamRadarChart
        data={data}
        caption={opponent ? `${label} vs ${opponent.label} (edge = best)` : `${label} (edge = best)`}
        ariaLabel={`${label} radar: ${data.map((d) => `${d.metric} ${d.display}`).join(", ")}`}
        comparison={opponentData && opponent ? { label: opponent.label, data: opponentData } : undefined}
      />
    </div>
  )
}

/**
 * Stats and radar for the round's aff and neg teams, when the rankings know
 * them. A team the rankings don't know is left out; with neither found the
 * section is not rendered at all.
 *
 * @param props.video - The round being watched.
 */
export function WatchTeamStats({ video }: { video: VideoType }) {
  const affTeam = video[9]
  const negTeam = video[10]
  const enabled = Boolean(affTeam || negTeam) && isRankedSeasonRound(video)
  const { datasets } = useAllRankingDatasets(enabled)
  if (!enabled || datasets.length === 0) return null

  const aff = affTeam ? findVideoTeamProfile(datasets, video[6], affTeam) : null
  const neg = negTeam ? findVideoTeamProfile(datasets, video[6], negTeam) : null
  if (!aff && !neg) return null
  const dataset = aff && neg ? datasets.find((d) => d.id === aff.datasetId) : undefined
  const prediction =
    aff && neg && dataset && aff.entry !== neg.entry
      ? predictWatchMatchup(aff.entry, neg.entry, dataset, datasets, video[8], video[11], video[0])
      : null

  return (
    <section aria-label="Team stats" className="space-y-2">
      <h2 className="text-sm font-semibold">Team rankings</h2>
      {prediction && affTeam && negTeam && (
        <WatchMatchupPrediction
          prediction={prediction}
          affLabel={<TeamCodeLabel label={affTeam} ranking={aff?.entry} side="aff" />}
          negLabel={<TeamCodeLabel label={negTeam} ranking={neg?.entry} side="neg" />}
          decision={typeof video[12] === "string" ? video[12] : null}
        />
      )}
      <div className={cn("grid grid-cols-1 gap-3", aff && neg && "xl:grid-cols-2")}>
        {aff && affTeam && (
          <TeamCard side="aff" label={affTeam} item={aff} opponent={neg && negTeam ? { label: negTeam, item: neg } : null} />
        )}
        {neg && negTeam && (
          <TeamCard side="neg" label={negTeam} item={neg} opponent={aff && affTeam ? { label: affTeam, item: aff } : null} />
        )}
      </div>
    </section>
  )
}
