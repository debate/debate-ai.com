/**
 * @fileoverview Profile of a past-season high school team: one a school
 * page lists among a season's best ranked entries (2015-16 on) that is not in
 * the current rankings. It shows each season the team was among its school's
 * best entries — event, rank in the field and TOC bids — plus the library's
 * videos of it. See `pastHighSchoolTeam.ts` for the matching.
 * @module leaderboard/profile/PastHighSchoolTeamProfile
 */

"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import {
  SCHOOL_SEASON_FORMATS,
  fetchSchoolSeasons,
  schoolSeasonKey,
  teamDisplayParts,
  type RankingDataset,
} from "../../index"
import { findTocSchoolRecord } from "../../sync/toc-champions"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/primitives/table"
import { TeamLabel } from "../team-label/TeamLabel"
import { ProfileVideos } from "./ProfileVideosSlot"
import { seasonLabel } from "./programStrength"
import { schoolHref, teamVideoSearch } from "./rankingProfileHelpers"
import { findNationalsTeamFinishes, type NationalsRow } from "./nationalsHistory"
import { findPastHighSchoolTeam, pastHighSchoolSchoolKeys, type PastHighSchoolTeam } from "./pastHighSchoolTeam"

/**
 * The past high school team `slug` names once the school-seasons table has
 * been asked; `loading` stays true until then. Candidate schools are tried in
 * turn ({@link pastHighSchoolSchoolKeys}) and the first that lists the team wins.
 * The team's TOC, NDCA, Barkley, Cal and Glenbrooks finishes are added, and a
 * team named only there (a nationals finish before 2015-16, say) still gets a
 * page.
 *
 * @param slug - The `@handle`, without its `@`.
 * @param enabled - `false` skips the lookup (e.g. while the handle may still
 *   name a ranked team, a school or a past college team).
 * @param datasets - The loaded rankings, to spell a school key's name.
 */
export function usePastHighSchoolTeam(
  slug: string,
  enabled = true,
  datasets: readonly RankingDataset[] = [],
): { loading: boolean; team: PastHighSchoolTeam | null } {
  const keys = enabled ? pastHighSchoolSchoolKeys(slug) : []
  const wanted = keys.length > 0
  const keyList = keys.join("|")
  // Nationals finishes per candidate school key, first key with any.
  const nationals = useMemo(() => {
    if (!keyList) return null
    for (const key of keyList.split("|")) {
      const rows = findNationalsTeamFinishes(schoolNameFor(key, datasets), key, slug)
      if (rows.length) return { key, rows }
    }
    return null
    // `datasets` only spells the school, and the rankings are loaded before the lookup is enabled.
  }, [keyList, slug])
  const [state, setState] = useState<{ slug: string; team: PastHighSchoolTeam | null } | null>(null)

  useEffect(() => {
    if (!wanted) return
    let cancelled = false
    ;(async () => {
      for (const key of pastHighSchoolSchoolKeys(slug)) {
        try {
          const { seasons } = await fetchSchoolSeasons(key, 1)
          const team = findPastHighSchoolTeam(seasons, key, slug)
          if (team) return team
        } catch {
          // An unknown school or a failed request: try the next candidate.
        }
      }
      return null
    })().then((team) => !cancelled && setState({ slug, team }))
    return () => {
      cancelled = true
    }
  }, [wanted, slug])

  const done = state?.slug === slug
  let team = done ? state.team : null
  if (done && nationals) {
    if (team && team.schoolKey === nationals.key) team = { ...team, nationals: nationals.rows }
    else if (!team) team = { schoolKey: nationals.key, name: nationals.rows[0].competitors, seasons: [], nationals: nationals.rows }
  }
  return { loading: wanted && !done, team }
}

/**
 * The school's name as the rankings spell it, for a school key: from any
 * loaded rankings row, then the TOC record, then the key's words.
 */
function schoolNameFor(key: string, datasets: readonly RankingDataset[]): string {
  for (const dataset of datasets) {
    const row = dataset.entries.find((entry) => schoolSeasonKey(entry.school) === key)
    if (row) return row.school
  }
  const words = key.replace(/-/g, " ")
  return (
    findTocSchoolRecord(words)?.school.replace(/\s*\([^)]*\)\s*$/, "") ??
    words.replace(/\b\w/g, (c) => c.toUpperCase())
  )
}

/**
 * The page body for a past high school team (the host's frame around it).
 *
 * @param props.team - From {@link usePastHighSchoolTeam}.
 * @param props.datasets - The loaded rankings, to spell the school's name.
 */
export function PastHighSchoolTeamView({
  team,
  datasets,
}: {
  team: PastHighSchoolTeam
  datasets: readonly RankingDataset[]
}) {
  const school = schoolNameFor(team.schoolKey, datasets)
  const nationals = team.nationals ?? []
  const events = [...new Set(team.seasons.map((s) => s.event))]
  const nationalsEvents = [...new Set(nationals.map((r) => r.event))].filter((event) => !events.includes(event as never))
  const search = teamVideoSearch(
    SCHOOL_SEASON_FORMATS.filter((f) => events.includes(f.event)).map((f) => ({
      datasetId: f.datasetId,
      entry: { school, name: team.name },
    })),
  )
  return (
    <>
      <div className="mt-3 overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm">
        <header className="px-4 pb-4 pt-5 sm:px-6">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            <TeamLabel
              {...teamDisplayParts({ school, name: team.name })}
              title={`${school} · ${team.name}`}
              schoolHref={schoolHref(school)}
              className="border-2 px-2.5 py-1 [&_img]:h-7 sm:[&_img]:h-8"
            />
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {team.seasons.length > 0 ? `Past season${team.seasons.length === 1 ? "" : "s"}` : "Nationals finishes"} ·{" "}
            {[...events, ...nationalsEvents].join(" · ")} · not in this season&apos;s rankings
          </p>
        </header>
      </div>
      {nationals.length > 0 && <NationalsFinishes rows={nationals} schoolHref={schoolHref(school)} />}
      {team.seasons.length > 0 && (
      <section className="mt-6">
        <h2 className="mb-1 text-lg font-semibold text-foreground">Past seasons</h2>
        <p className="mb-2 text-sm text-muted-foreground">
          Seasons the team was one of its school&apos;s best ranked entries in its event, with its rank among every
          entry rated that season.
        </p>
        <div className="overflow-x-auto rounded-lg border bg-card shadow-sm">
          <Table className="text-sm">
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Season</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Debaters</TableHead>
                <TableHead className="text-right">Rank</TableHead>
                <TableHead className="text-right">TOC bids</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {team.seasons.map((season) => (
                <TableRow key={`${season.year}-${season.event}`}>
                  <TableCell className="tabular-nums">{seasonLabel(season.year)}</TableCell>
                  <TableCell>{season.event}</TableCell>
                  <TableCell>{season.name}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    #{season.rank}
                    <span className="text-muted-foreground"> / {season.fieldSize}</span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{season.bids}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
      )}
      <ProfileVideos search={search} />
    </>
  )
}

/** The team's national finishes, one row each, newest first. */
function NationalsFinishes({ rows, schoolHref: href }: { rows: readonly NationalsRow[]; schoolHref: string }) {
  return (
    <section className="mt-6">
      <h2 className="mb-1 text-lg font-semibold text-foreground">National finishes</h2>
      <p className="mb-2 text-sm text-muted-foreground">
        The team&apos;s Tournament of Champions, NDCA, Barkley, Cal and Glenbrooks finishes, as its{" "}
        <Link href={href} className="underline underline-offset-4">
          school page
        </Link>{" "}
        lists them.
      </p>
      <div className="overflow-x-auto rounded-lg border bg-card shadow-sm">
        <Table className="text-sm">
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>Year</TableHead>
              <TableHead>Tournament</TableHead>
              <TableHead>Event</TableHead>
              <TableHead>Finish</TableHead>
              <TableHead>Debaters</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, i) => (
              <TableRow key={`${row.tournament}-${row.year}-${row.event}-${row.label}-${i}`}>
                <TableCell className="tabular-nums">{row.year}</TableCell>
                <TableCell>{row.tournament}</TableCell>
                <TableCell>{row.event}</TableCell>
                <TableCell>
                  {row.label}
                  {row.probable && <span className="text-xs italic text-muted-foreground"> probable</span>}
                </TableCell>
                <TableCell>{row.competitors}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  )
}
