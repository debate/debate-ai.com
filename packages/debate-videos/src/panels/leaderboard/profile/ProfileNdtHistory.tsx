/**
 * @fileoverview College NDT section of a school profile: the school's
 * National Debate Tournament record — years attended, championships, elim
 * runs, first-round at-large bids, speaker and coaching awards — from the
 * NDT's published school history. Renders nothing for a school that never
 * attended.
 * @module panels/leaderboard/profile/ProfileNdtHistory
 */

"use client"

import { useEffect, useState } from "react"
import { Trophy } from "lucide-react"
import type { NdtSchoolHistory, NdtTeamResult } from "@debate-ai/data-sync/src/rankings/ndt-school-history"
import { Badge } from "../../../ui/primitives/badge"
import { Card, CardContent, CardHeader, CardTitle } from "../../../ui/primitives/card"
import { findNdtSchoolHistory } from "./rankingProfileHelpers"

const NDT_RESULTS_URL = (year: number) => `https://nationaldebatetournament.org/tournament-results/${year}-ndt-results/`

/** Elim rounds, deepest first, for the "best finish" stat and the sort. */
const ROUND_DEPTH = ["Champion", "Finals", "Semis", "Quarters", "Octas", "Doubles"]

let historyPromise: Promise<NdtSchoolHistory[]> | null = null

/** Loads the 300KB history once, on the first school page that needs it. */
function loadNdtHistory(): Promise<NdtSchoolHistory[]> {
  historyPromise ??= import("@debate-ai/data-sync/data/metadata/ndt-school-history.json").then(
    (module) => module.default as NdtSchoolHistory[],
  )
  return historyPromise
}

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

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border bg-muted/30 px-3 py-2">
      <div className="text-lg font-semibold tabular-nums text-foreground">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  )
}

function TeamList({ title, items }: { title: string; items: NdtTeamResult[] }) {
  if (items.length === 0) return null
  return (
    <section className="mt-4">
      <h3 className="mb-1 text-sm font-medium text-muted-foreground">
        {title} ({items.length})
      </h3>
      <ul className="space-y-0.5 text-sm">
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
  const [history, setHistory] = useState<NdtSchoolHistory | null>(null)

  useEffect(() => {
    let cancelled = false
    loadNdtHistory()
      .then((schools) => {
        if (!cancelled) setHistory(findNdtSchoolHistory(schools, school))
      })
      .catch(() => {
        if (!cancelled) setHistory(null)
      })
    return () => {
      cancelled = true
    }
  }, [school])

  if (!history) return null

  const elims = [...history.elims].sort((a, b) => b.year - a.year)
  const champions = [...history.championships].sort((a, b) => b.year - a.year)
  const bestRound = history.championships.length
    ? "Champion"
    : ROUND_DEPTH.find((round) => history.elims.some((elim) => elim.round === round))

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
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Years attended" value={history.years.length} />
          <Stat label="Championships" value={history.championships.length} />
          <Stat label="Elim qualifiers" value={history.elims.length} />
          <Stat label="Best finish" value={bestRound ?? "—"} />
        </div>

        {history.years.length > 0 && (
          <section className="mt-4">
            <h3 className="mb-1 text-sm font-medium text-muted-foreground">
              Years in attendance ({history.years.length})
            </h3>
            <p className="flex flex-wrap gap-x-2 text-sm">
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
          <section className="mt-4">
            <h3 className="mb-1 text-sm font-medium text-muted-foreground">
              Speaker awards ({history.speakerAwards.length})
            </h3>
            <ul className="space-y-0.5 text-sm">
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
          <section className="mt-4">
            <h3 className="mb-1 text-sm font-medium text-muted-foreground">
              Coaching awards ({history.coachingAwards.length})
            </h3>
            <ul className="space-y-0.5 text-sm">
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
      </CardContent>
    </Card>
  )
}
