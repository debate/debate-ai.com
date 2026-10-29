/**
 * @fileoverview Profile of a past-season college policy team: one that is
 * not in the current season's rankings but is named in a past season's
 * debatedata table, the NDT's history or the CEDA champions list. The data is
 * limited to what those sources kept — each season's rank and rating on
 * debatedata's own scale, NDT results, CEDA titles — followed by the
 * library's videos of the team. See `pastTeamHelpers.ts` for the matching.
 * @module leaderboard/profile/PastTeamProfile
 */

"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  COLLEGE_HISTORY_FIRST_YEAR,
  COLLEGE_HISTORY_LAST_YEAR,
  collegeHistorySourceUrl,
  loadCollegeHistory,
  teamDisplayParts,
  type CollegeHistoryEntry,
} from "../../index"
import { findCedaSchoolTitles } from "../../sync/ceda-champions"
import { Badge } from "../ui/primitives/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/primitives/table"
import { TeamLabel } from "../team-label/TeamLabel"
import { SchoolLogo } from "../SchoolLogo"
import { seasonLabel } from "../leaderboardUtils"
import { ProfileVideos } from "./ProfileVideosSlot"
import { useNdtHistory } from "./ndtHistory"
import { schoolHref } from "./rankingProfileHelpers"
import { findPastTeamProfile, pastTeamVideoSearch, type PastTeamProfile } from "./pastTeamHelpers"

const NDT_RESULTS_URL = (year: number) => `https://nationaldebatetournament.org/tournament-results/${year}-ndt-results/`

let allHistory: Promise<Map<number, CollegeHistoryEntry[]>> | null = null

/** Every past season's debatedata table, by season year, loaded once. */
function loadAllCollegeHistory(): Promise<Map<number, CollegeHistoryEntry[]>> {
  const years: number[] = []
  for (let year = COLLEGE_HISTORY_FIRST_YEAR; year <= COLLEGE_HISTORY_LAST_YEAR; year += 1) years.push(year)
  allHistory ??= Promise.all(years.map(async (year) => [year, await loadCollegeHistory(year)] as const)).then(
    (pairs) => new Map(pairs),
  )
  return allHistory.catch((err) => {
    allHistory = null
    throw err
  })
}

/**
 * The past team `slug` names once its sources load. `loading` stays true
 * until they have; a one-word slug (a school's) never loads anything.
 *
 * @param slug - The `@handle`, without its `@`.
 * @param enabled - `false` skips the lookup (e.g. while the handle may still
 *   name a ranked team or school).
 */
export function usePastTeamProfile(slug: string, enabled = true): { loading: boolean; profile: PastTeamProfile | null } {
  // Both slug shapes (school plus initials, or plus names) have at least two words.
  const wanted = enabled && slug.includes("-")
  const ndt = useNdtHistory()
  const [history, setHistory] = useState<Map<number, CollegeHistoryEntry[]> | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!wanted) return
    let cancelled = false
    loadAllCollegeHistory()
      .then((loaded) => !cancelled && setHistory(loaded))
      .catch(() => !cancelled && setFailed(true))
    return () => {
      cancelled = true
    }
  }, [wanted])

  const profile = useMemo(
    () =>
      wanted && (history || failed)
        ? findPastTeamProfile({ collegeHistory: history ?? new Map(), ndt, cedaTitles: findCedaSchoolTitles }, slug)
        : null,
    [wanted, history, failed, ndt, slug],
  )
  // The NDT file failing to load leaves `ndt` null for good; don't wait on it past the tables.
  return { loading: wanted && !history && !failed, profile }
}

/** The team's seasons in debatedata's top-100 tables. */
function SeasonsTable({ team }: { team: PastTeamProfile }) {
  if (team.seasons.length === 0) return null
  return (
    <section className="mt-6">
      <h2 className="mb-1 text-lg font-semibold text-foreground">Past seasons</h2>
      <p className="mb-2 text-sm text-muted-foreground">
        Rank in debatedata's top 100 college policy teams that season. Rating is a conservative skill estimate on
        that site's own scale, not comparable with current-season ratings.
      </p>
      <div className="rounded-lg border bg-card shadow-sm">
        <Table className="text-sm">
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>Season</TableHead>
              <TableHead>Debaters</TableHead>
              <TableHead className="text-right">Rank</TableHead>
              <TableHead className="text-right">Rating</TableHead>
              <TableHead className="text-right">Mu</TableHead>
              <TableHead className="text-right">Sigma</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {team.seasons.map(({ season, entry }) => (
              <TableRow key={season}>
                <TableCell>
                  <a
                    href={collegeHistorySourceUrl(season)}
                    target="_blank"
                    rel="noreferrer"
                    className="tabular-nums text-primary hover:underline"
                  >
                    {seasonLabel(String(season))}
                  </a>
                </TableCell>
                <TableCell>{entry.name}</TableCell>
                <TableCell className="text-right tabular-nums">#{entry.rank}</TableCell>
                <TableCell className="text-right tabular-nums">{entry.rating.toFixed(2)}</TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">{entry.mu.toFixed(2)}</TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">{entry.sigma.toFixed(2)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  )
}

/** The team's NDT results and CEDA titles. */
function NationalsResults({ team }: { team: PastTeamProfile }) {
  if (team.ndt.length === 0 && team.ceda.length === 0) return null
  return (
    <section className="mt-6">
      <h2 className="mb-2 text-lg font-semibold text-foreground">National tournaments</h2>
      <ul className="space-y-0.5 text-sm">
        {team.ceda.map((title) => (
          <li key={`ceda-${title.year}`} className="flex flex-wrap items-baseline gap-x-2">
            <span className="tabular-nums text-foreground">{title.year}</span>
            <Badge className="text-xs">CEDA Champion</Badge>
            <span className="text-foreground">{title.team}</span>
          </li>
        ))}
        {team.ndt.map((result) => (
          <li key={`ndt-${result.year}-${result.kind}-${result.team}`} className="flex flex-wrap items-baseline gap-x-2">
            <a
              href={NDT_RESULTS_URL(result.year)}
              target="_blank"
              rel="noreferrer"
              className="tabular-nums text-primary hover:underline"
            >
              {result.year}
            </a>
            <Badge variant={result.kind === "Championship" ? "default" : "secondary"} className="text-xs">
              NDT {result.kind === "Elims" ? result.round ?? "Elims" : result.kind}
            </Badge>
            <span className="text-foreground">{result.team}</span>
            <span className="text-xs text-muted-foreground">
              {[result.record, result.seed && `seed ${result.seed}`, result.rank && `rank ${result.rank}`]
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
 * The page body for a past team (the host's frame and back link around it).
 *
 * @param props.team - From {@link usePastTeamProfile}.
 */
export function PastTeamProfileView({ team }: { team: PastTeamProfile }) {
  return (
    <>
      <div className="mt-3 overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm">
        <header className="px-4 pb-4 pt-5 sm:px-6">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            <TeamLabel
              {...teamDisplayParts({ school: team.school, name: team.name })}
              title={`${team.school} · ${team.name}`}
              className="border-2 px-2.5 py-1 [&_img]:h-7 sm:[&_img]:h-8"
            />
          </h1>
          <Link
            href={schoolHref(team.school)}
            className="mt-1 flex items-center gap-2 text-base text-muted-foreground underline-offset-4 hover:underline"
          >
            <SchoolLogo school={team.school} className="h-5 w-auto" />
            {team.school}
          </Link>
          <p className="mt-2 text-sm text-muted-foreground">
            Past-season college policy team · not in the current season's rankings, so only the records below are
            available. Results are matched by school and initials, so another pair with the same initials may
            appear.
          </p>
        </header>
      </div>
      <SeasonsTable team={team} />
      <NationalsResults team={team} />
      <ProfileVideos search={pastTeamVideoSearch(team)} />
    </>
  )
}
