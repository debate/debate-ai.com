/**
 * @fileoverview College NDT section of a school profile: the school's
 * National Debate Tournament record — years attended, championships, elim
 * runs, first-round at-large bids, speaker and coaching awards — from the
 * NDT's published school history. Renders nothing for a school that never
 * attended.
 * @module panels/leaderboard/profile/ProfileNdtHistory
 */

"use client"

import { useMemo } from "react"
import { Trophy } from "lucide-react"
import type { NdtTeamResult } from "@debate-ai/data-sync/src/rankings/ndt-school-history"
import { Badge } from "../../../ui/primitives/badge"
import { Card, CardContent, CardHeader, CardTitle } from "../../../ui/primitives/card"
import { findNdtSchoolHistory } from "./rankingProfileHelpers"
import {
  averageNdtElim,
  bestNdtFinish,
  latestNdtYear,
  MAX_ELIM_DEPTH,
  MIN_RANKED_ELIMS,
  rankNdtElimAverage,
  useNdtHistory,
  type NdtElimAverage,
  type NdtElimRank,
} from "./ndtHistory"

/** A list's capped-height scroll box, so a long record doesn't stretch the page. */
export const SCROLL_AREA = "max-h-56 overflow-y-auto overscroll-contain pr-1"

const NDT_RESULTS_URL = (year: number) => `https://nationaldebatetournament.org/tournament-results/${year}-ndt-results/`

function YearLink({ year }: { year: number }) {
  return (
    <a
      href={NDT_RESULTS_URL(year)}
      target="_blank"
      rel="noreferrer"
      className="tabular-nums text-primary hover:underline"
    >
      {year}
    </a>
  )
}

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-md border bg-muted/30 px-3 py-2">
      <div className="text-lg font-semibold tabular-nums text-foreground">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
      {hint && <div className="text-xs tabular-nums text-muted-foreground/80">{hint}</div>}
    </div>
  )
}

/** Average elim placement as a round label, with its depth and sample size. */
function ElimAverageStat({
  label,
  average,
  rank,
}: {
  label: string
  average: NdtElimAverage | undefined
  rank: NdtElimRank | undefined
}) {
  return (
    <Stat
      label={label}
      value={average?.round ?? "—"}
      hint={
        average
          ? `${average.depth.toFixed(1)} of ${MAX_ELIM_DEPTH} · ${average.elims} elim${average.elims === 1 ? "" : "s"} · ${
              rank ? `#${rank.rank} of ${rank.of} schools` : `unranked, under ${MIN_RANKED_ELIMS} elims`
            }`
          : "no elims"
      }
    />
  )
}

function TeamList({ title, items }: { title: string; items: NdtTeamResult[] }) {
  if (items.length === 0) return null
  return (
    <section className="min-w-0">
      <h3 className="mb-1 text-sm font-medium text-muted-foreground">
        {title} ({items.length})
      </h3>
      <ul className={`space-y-0.5 text-sm ${SCROLL_AREA}`}>
        {items.map((item) => (
          <li key={`${item.year}-${item.team}`} className="flex flex-wrap items-baseline gap-x-2">
            <YearLink year={item.year} />
            {item.round && (
              <Badge variant={item.round === "Champion" ? "default" : "secondary"} className="text-xs">
                {item.round}
              </Badge>
            )}
            <span className="text-foreground">{item.team}</span>
            <span className="text-xs text-muted-foreground">
              {[item.record, item.seed && `seed ${item.seed}`, item.rank && `rank ${item.rank}`]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

/**
 * @param props.school - School name as the rankings spell it.
 */
export function ProfileNdtHistory({ school }: { school: string }) {
  const schools = useNdtHistory()
  const history = useMemo(() => (schools ? findNdtSchoolHistory(schools, school) : null), [schools, school])

  if (!history) return null

  const elims = [...history.elims].sort((a, b) => b.year - a.year)
  const champions = [...history.championships].sort((a, b) => b.year - a.year)
  const bestRound = bestNdtFinish(history)
  const decadeStart = latestNdtYear(schools ?? []) - 9

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Trophy className="h-4 w-4" aria-hidden />
          College NDT record
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {history.school} · from the{" "}
          <a
            href="https://nationaldebatetournament.org/history/results-records/school-history/"
            target="_blank"
            rel="noreferrer"
            className="hover:underline"
          >
            National Debate Tournament school history
          </a>
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Stat label="Years attended" value={history.years.length} />
          <Stat label="Championships" value={history.championships.length} />
          <Stat label="Elim qualifiers" value={history.elims.length} />
          <Stat label="Best finish" value={bestRound ?? "—"} />
          <ElimAverageStat
            label="Avg elim finish, all years"
            average={averageNdtElim(history)}
            rank={rankNdtElimAverage(schools ?? [], history)}
          />
          <ElimAverageStat
            label={`Avg elim finish, ${decadeStart}–${decadeStart + 9}`}
            average={averageNdtElim(history, decadeStart)}
            rank={rankNdtElimAverage(schools ?? [], history, decadeStart)}
          />
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {history.years.length > 0 && (
            <section className="min-w-0">
              <h3 className="mb-1 text-sm font-medium text-muted-foreground">
                Years in attendance ({history.years.length})
              </h3>
              <p className={`flex flex-wrap gap-x-2 text-sm ${SCROLL_AREA}`}>
                {history.years.map((year) => (
                  <YearLink key={year} year={year} />
                ))}
              </p>
            </section>
          )}

          <TeamList title="Championships" items={champions} />
          <TeamList title="Elim qualifiers" items={elims} />
          <TeamList title="First-round at-large bids" items={history.atLargeBids} />
          <TeamList title="Copeland Award winners" items={history.copelandWinners} />

          {history.speakerAwards.length > 0 && (
            <section className="min-w-0">
              <h3 className="mb-1 text-sm font-medium text-muted-foreground">
                Speaker awards ({history.speakerAwards.length})
              </h3>
              <ul className={`space-y-0.5 text-sm ${SCROLL_AREA}`}>
                {history.speakerAwards.map((award) => (
                  <li key={`${award.year}-${award.speaker}`} className="flex flex-wrap items-baseline gap-x-2">
                    <YearLink year={award.year} />
                    <span className="text-foreground">{award.speaker}</span>
                    {award.rank && <span className="text-xs text-muted-foreground">speaker #{award.rank}</span>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {history.coachingAwards.length > 0 && (
            <section className="min-w-0">
              <h3 className="mb-1 text-sm font-medium text-muted-foreground">
                Coaching awards ({history.coachingAwards.length})
              </h3>
              <ul className={`space-y-0.5 text-sm ${SCROLL_AREA}`}>
                {history.coachingAwards.map((award) => (
                  <li key={`${award.year}-${award.coach}-${award.award}`} className="flex flex-wrap gap-x-2">
                    <span className="tabular-nums text-muted-foreground">{award.year}</span>
                    <span className="text-foreground">{award.coach}</span>
                    <span className="text-muted-foreground">{award.award}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
