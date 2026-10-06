/**
 * @fileoverview Team and school profile pages opened from the Team Rankings
 * table. A team profile shows its ranking stats in every division it is
 * ranked in; a school profile aggregates all of that school's ranked entries.
 * Both list the library videos matching the team or school below the stats.
 * @module panels/leaderboard/profile/RankingProfiles
 */

"use client"

import Link from "next/link"
import type { ReactNode } from "react"
import { useAllRankingDatasets } from "../../../hooks/useAllRankingDatasets"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../ui/primitives/table"
import {
  findSchoolEntries,
  findTeamEntries,
  schoolDivisionRadarData,
  schoolHref,
  schoolVideoSearch,
  summarizeSchool,
  teamHref,
  teamRadarData,
  teamSlug,
  teamVideoQuery,
  type ProfileEntry,
} from "./rankingProfileHelpers"
import { ProfileVideos } from "./ProfileVideos"
import { ProfileCaselistDocuments } from "./ProfileCaselistDocuments"
import { TeamRadarChart } from "./TeamRadarChart"
import { MatchupSimulator } from "./MatchupSimulator"

const rating = (n: number) => n.toFixed(1)
const percent = (n: number | null) =>
  n === null ? "—" : `${Number.isInteger(n) ? n : n.toFixed(1)}%`

/** One labelled number tile. */
function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg border bg-card px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
    </div>
  )
}

/** Page frame shared by both profiles: back link, then content. */
function ProfileFrame({ children }: { children: ReactNode }) {
  return (
    <div>
      <Link href="/coaching/rankings" className="text-sm text-muted-foreground hover:text-foreground">
        ← Team Rankings
      </Link>
      {children}
    </div>
  )
}

/** Loading, error and not-found states; `null` once there is something to show. */
function ProfileStatus({
  loading,
  error,
  found,
  kind,
}: {
  loading: boolean
  error: string | null
  found: boolean
  kind: "team" | "school"
}) {
  if (loading) {
    return <p className="py-16 text-center text-muted-foreground">Loading rankings…</p>
  }
  if (error) {
    return <p className="py-16 text-center text-muted-foreground">{error}</p>
  }
  if (!found) {
    return (
      <p className="py-16 text-center text-muted-foreground">
        No ranked {kind} matches this link.
      </p>
    )
  }
  return null
}

/** Stats and radar chart for one team in one division. */
function TeamDivisionStats({ item }: { item: ProfileEntry }) {
  const { entry } = item
  const data = teamRadarData(item)
  return (
    <div className="mt-4">
      <h2 className="mb-2 text-sm font-medium text-muted-foreground">
        {item.datasetLabel} · rank {entry.rank} of {item.fieldSize}
      </h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
        <Stat label="Rank" value={entry.rank} />
        <Stat label="Adj. rating" value={rating(entry.adjustedRating)} />
        <Stat label="Matches" value={entry.matches} />
        <Stat label="Aff win" value={percent(entry.affWinRate)} />
        <Stat label="Neg win" value={percent(entry.negWinRate)} />
        <Stat
          label="Elim aff / neg"
          value={`${percent(entry.affElimWinRate)} / ${percent(entry.negElimWinRate)}`}
        />
      </div>
      <div className="mt-2 max-w-md">
        <TeamRadarChart
          data={data}
          caption={`Profile · ${item.datasetLabel} (edge = best; ranking is a field percentile, matches are relative to the most-played entry)`}
          ariaLabel={`${entry.name} radar: ${data.map((d) => `${d.metric} ${d.display}`).join(", ")}`}
        />
      </div>
    </div>
  )
}

/**
 * Profile of one ranked team (or LD debater).
 *
 * @param props.slug - The `/teams/[team]` segment, from `teamSlug`.
 */
export function TeamProfilePage({ slug }: { slug: string }) {
  const { datasets, loading, error } = useAllRankingDatasets()
  const entries = loading ? [] : findTeamEntries(datasets, slug)
  const first = entries[0]?.entry

  return (
    <ProfileFrame>
      <ProfileStatus loading={loading} error={error} found={Boolean(first)} kind="team" />
      {first && (
        <>
          <header className="mt-3">
            <h1 className="text-2xl font-semibold text-foreground">{first.name}</h1>
            <Link
              href={schoolHref(first.school)}
              className="text-sm text-primary underline-offset-4 hover:underline"
            >
              {first.school}
            </Link>
          </header>
          {entries.map((item) => (
            <TeamDivisionStats key={item.datasetId} item={item} />
          ))}
          <MatchupSimulator
            lockedTeamSlug={teamSlug(first)}
            title={`Simulate ${first.name} vs. any ranked team`}
          />
          <ProfileVideos query={teamVideoQuery(first)} />
          <ProfileCaselistDocuments school={first.school} team={first.name} />
        </>
      )}
    </ProfileFrame>
  )
}

/**
 * Profile of one school: aggregate stats and every ranked entry, by division.
 *
 * @param props.slug - The `/schools/[school]` segment, from `profileSlug`.
 */
export function SchoolProfilePage({ slug }: { slug: string }) {
  const { datasets, loading, error } = useAllRankingDatasets()
  const entries = loading ? [] : findSchoolEntries(datasets, slug)
  const summary = summarizeSchool(entries)

  const divisions = entries.reduce(
    (groups, item) => {
      const group = groups.get(item.datasetId) ?? { datasetLabel: item.datasetLabel, items: [] as ProfileEntry[] }
      group.items.push(item)
      return groups.set(item.datasetId, group)
    },
    new Map<string, { datasetLabel: string; items: ProfileEntry[] }>(),
  )

  return (
    <ProfileFrame>
      <ProfileStatus loading={loading} error={error} found={entries.length > 0} kind="school" />
      {entries.length > 0 && (
        <>
          <header className="mt-3">
            <h1 className="text-2xl font-semibold text-foreground">{summary.school}</h1>
            <p className="text-sm text-muted-foreground">
              {summary.divisions.map((d) => d.datasetLabel).join(" · ")}
            </p>
          </header>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Ranked entries" value={summary.teams} />
            {summary.divisions.map((d) => (
              <Stat
                key={d.datasetId}
                label={`Best rank · ${d.datasetLabel}`}
                value={
                  <>
                    {d.bestRank}
                    <span className="text-sm font-normal text-muted-foreground"> / {d.fieldSize}</span>
                  </>
                }
              />
            ))}
            <Stat
              label="Avg. adj. rating"
              value={summary.averageAdjustedRating === null ? "—" : rating(summary.averageAdjustedRating)}
            />
            <Stat label="Total matches" value={summary.totalMatches} />
          </div>

          {Array.from(divisions.values()).map((div) => {
            const data = schoolDivisionRadarData(div.items)
            if (data.length === 0) return null
            return (
              <div key={div.datasetLabel} className="mt-4">
                <h2 className="mb-2 text-sm font-medium text-muted-foreground">
                  {div.datasetLabel} · {div.items.length} teams
                </h2>
                <div className="mt-2 max-w-md">
                  <TeamRadarChart
                    data={data}
                    caption={`School average · ${div.datasetLabel} (${div.items.length} teams; edge = best; ranking is a field percentile, matches relative to the most-played entry)`}
                    ariaLabel={`School average radar · ${div.datasetLabel}: ${data.map((d) => `${d.metric} ${d.display}`).join(", ")}`}
                  />
                </div>
              </div>
            )
          })}

          <div className="mt-4 rounded-lg border bg-card shadow-sm">
            <Table className="text-sm">
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>Division</TableHead>
                  <TableHead className="text-right">Rank</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="text-right">Adj. Rating</TableHead>
                  <TableHead className="text-right">Matches</TableHead>
                  <TableHead className="text-right">Aff Win</TableHead>
                  <TableHead className="text-right">Neg Win</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map(({ datasetId, datasetLabel, fieldSize, entry }) => (
                  <TableRow key={`${datasetId}-${entry.hash || entry.name}`}>
                    <TableCell className="text-muted-foreground">{datasetLabel}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {entry.rank}
                      <span className="text-muted-foreground"> / {fieldSize}</span>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={teamHref(entry)}
                        className="font-medium text-foreground underline-offset-4 hover:underline"
                      >
                        {entry.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{rating(entry.adjustedRating)}</TableCell>
                    <TableCell className="text-right tabular-nums">{entry.matches}</TableCell>
                    <TableCell className="text-right tabular-nums">{percent(entry.affWinRate)}</TableCell>
                    <TableCell className="text-right tabular-nums">{percent(entry.negWinRate)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <ProfileVideos search={schoolVideoSearch(summary.school, entries)} />
          <ProfileCaselistDocuments school={summary.school} />
        </>
      )}
    </ProfileFrame>
  )
}
