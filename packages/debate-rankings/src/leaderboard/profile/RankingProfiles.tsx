/**
 * @fileoverview Team and school profile pages opened from the Team Rankings
 * table. A team profile shows its ranking stats in every division it is
 * ranked in; a school profile aggregates all of that school's ranked entries.
 * Both list the library videos matching the team or school below the stats,
 * and carry a Follow button with the follower count in the header.
 * @module leaderboard/profile/RankingProfiles
 */

"use client"

import Link from "next/link"
import { useState, type ReactNode } from "react"
import { formatSiteRating, teamDisplayParts, type RankingDataset } from "../../index"
import { useAllRankingDatasets } from "../hooks/useAllRankingDatasets"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/primitives/table"
import {
  findSchoolDivisionEntries,
  findSchoolEntries,
  findTeamEntries,
  profileHandleKind,
  profileSlug,
  schoolDivisionRadarData,
  schoolHref,
  schoolLevels,
  schoolVideoSearch,
  summarizeSchool,
  teamHref,
  teamRadarData,
  teamSlug,
  teamVideoSearch,
  type ProfileEntry,
} from "./rankingProfileHelpers"
import { ProfileVideos } from "./ProfileVideosSlot"
import { PastTeamProfileView, usePastTeamProfile } from "./PastTeamProfile"
import { ProfileCaselistDocuments } from "./ProfileCaselistDocuments"
import { ProfileCollegeHistory } from "./ProfileCollegeHistory"
import { ProfileTocHistory } from "./ProfileTocHistory"
import { SchoolLogo } from "../SchoolLogo"
import { TeamLabel } from "../team-label/TeamLabel"
import { TeamRadarChart } from "./TeamRadarChart"
import { MatchupSimulator } from "./MatchupSimulator"
import { FollowButton } from "./FollowButton"

const rating = formatSiteRating
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

/** One big number over a small uppercase label, as a cell of a {@link StatBand}. */
function RecordStat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-2 py-4 text-center sm:py-5">
      <div className="text-2xl font-bold tabular-nums tracking-tight sm:text-3xl">{value}</div>
      <div className="mt-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  )
}

/** One category of record stats: a caption over a row of cells split by dividers. */
function StatBand({ title, tone, children }: { title: string; tone: "light" | "dark"; children: ReactNode }) {
  return (
    <section
      aria-label={title}
      className={`border-t ${tone === "dark" ? "bg-muted/40" : ""}`}
    >
      <h3 className="px-4 pt-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{title}</h3>
      <div className="grid grid-cols-2 divide-border sm:grid-cols-4 sm:divide-x [&>*]:border-border max-sm:[&>*:nth-child(odd)]:border-r max-sm:[&>*:nth-child(n+3)]:border-t">
        {children}
      </div>
    </section>
  )
}

/** The pill style the header's division and rating chips share. */
const pillClass = (active: boolean) =>
  `inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm transition-colors ${
    active ? "bg-primary font-medium text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"
  }`

/**
 * The team's record card: a header with the team, its school, the
 * Follow button, a division picker and each division's rating, over the
 * picked division's stats grouped into Standing, Win rates and Rating model.
 */
function TeamRecordCard({
  entries,
  selected,
  onSelect,
}: {
  entries: ProfileEntry[]
  selected: ProfileEntry
  onSelect: (datasetId: ProfileEntry["datasetId"]) => void
}) {
  const first = entries[0].entry
  const { entry, fieldSize, datasetLabel } = selected
  const topPercent = fieldSize > 0 ? (entry.rank / fieldSize) * 100 : null
  return (
    <div className="mt-3 overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm">
      <header className="px-4 pb-4 pt-5 sm:px-6">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          <TeamLabel
            {...teamDisplayParts({ school: first.school, name: first.name })}
            title={`${first.school} · ${first.name}`}
            className="border-2 px-2.5 py-1 [&_img]:h-7 sm:[&_img]:h-8"
          />
        </h1>
        <Link href={schoolHref(first.school)} className="text-base text-muted-foreground underline-offset-4 hover:underline flex items-center gap-2 mt-1">
          <SchoolLogo school={first.school} className="h-5 w-auto" />
          {first.school}
        </Link>
        <div>
          <FollowButton kind="team" slug={teamSlug(first)} name={`${first.school} ${first.name}`} />
        </div>
        {entries.length > 1 && (
          <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Division">
            {entries.map((item) => (
              <button
                key={item.datasetId}
                type="button"
                aria-pressed={item.datasetId === selected.datasetId}
                onClick={() => onSelect(item.datasetId)}
                className={pillClass(item.datasetId === selected.datasetId)}
              >
                {item.datasetLabel}
              </button>
            ))}
          </div>
        )}
        <div className="mt-2 flex flex-wrap gap-2">
          {entries.map((item) => (
            <span key={item.datasetId} className={pillClass(false)}>
              {item.datasetLabel}
              <span className="font-semibold tabular-nums text-foreground">{rating(item.entry.adjustedRating)}</span>
            </span>
          ))}
        </div>
      </header>
      <h2 className="sr-only">
        {datasetLabel} · rank {entry.rank} of {fieldSize}
      </h2>
      <StatBand title="Standing" tone="light">
        <RecordStat label={`Rating · ${datasetLabel}`} value={rating(entry.adjustedRating)} />
        <RecordStat label={`Rank of ${fieldSize}`} value={`#${entry.rank}`} />
        <RecordStat label="Field percentile" value={topPercent === null ? "—" : `Top ${percent(Math.max(topPercent, 0.1))}`} />
        <RecordStat label="Matches" value={entry.matches} />
      </StatBand>
      <StatBand title="Win rates" tone="dark">
        <RecordStat label="Aff win %" value={percent(entry.affWinRate)} />
        <RecordStat label="Neg win %" value={percent(entry.negWinRate)} />
        <RecordStat label="Elim aff win %" value={percent(entry.affElimWinRate)} />
        <RecordStat label="Elim neg win %" value={percent(entry.negElimWinRate)} />
      </StatBand>
      <StatBand title="Rating model" tone="dark">
        <RecordStat label="aff vs cp da" value="—" />
        <RecordStat label="aff vs K" value="—" />
        <RecordStat label="aff vs T" value="—" />
        <RecordStat label="neg cp da" value="—" />
        <RecordStat label="neg K" value="—" />
        <RecordStat label="neg T" value="—" />
      </StatBand>
    </div>
  )
}

/**
 * Radar chart for one team in one division. When the team's school has
 * other ranked teams in the division, a checkbox under the radar (on by
 * default) overlays the school's average in that division.
 */
function TeamDivisionRadar({ item, datasets }: { item: ProfileEntry; datasets: RankingDataset[] }) {
  const { entry } = item
  const data = teamRadarData(item)
  const [showSchool, setShowSchool] = useState(true)
  const schoolItems = findSchoolDivisionEntries(datasets, item)
  const hasSchoolPeers = schoolItems.length > 1
  const schoolData = hasSchoolPeers && showSchool ? schoolDivisionRadarData(schoolItems) : null
  return (
    <div className="mt-4 max-w-md">
      <TeamRadarChart
        data={data}
        caption={`Profile · ${item.datasetLabel} (edge = best; ranking is a field percentile, matches are relative to the most-played entry)`}
        ariaLabel={`${entry.name} radar: ${data.map((d) => `${d.metric} ${d.display}`).join(", ")}${
          schoolData
            ? `; ${entry.school} average: ${schoolData.map((d) => `${d.metric} ${d.display}`).join(", ")}`
            : ""
        }`}
        comparison={
          schoolData
            ? { label: `${entry.school} average (${schoolItems.length} teams)`, data: schoolData }
            : undefined
        }
        footer={
          hasSchoolPeers && (
            <label className="mt-1 flex cursor-pointer select-none items-center gap-1.5 px-1 text-xs text-muted-foreground hover:text-foreground">
              <input
                type="checkbox"
                checked={showSchool}
                onChange={(event) => setShowSchool(event.target.checked)}
                className="h-3.5 w-3.5 cursor-pointer accent-primary"
              />
              Show {entry.school} average in {item.datasetLabel}
            </label>
          )
        }
      />
    </div>
  )
}

/**
 * Profile of one ranked team (or LD debater).
 *
 * @param props.slug - The team's `@<handle>` segment — or the older
 * school-plus-name slug a pre-move link or followed profile carries,
 * which still resolves (see `findTeamEntries`).
 */
export function TeamProfilePage({ slug }: { slug: string }) {
  const { datasets, loading, error } = useAllRankingDatasets()
  const entries = loading ? [] : findTeamEntries(datasets, slug)
  const first = entries[0]?.entry
  const [selectedId, setSelectedId] = useState<ProfileEntry["datasetId"] | null>(null)
  const selected = entries.find((item) => item.datasetId === selectedId) ?? entries[0]

  return (
    <ProfileFrame>
      <ProfileStatus loading={loading} error={error} found={Boolean(first)} kind="team" />
      {first && selected && (
        <>
          <TeamRecordCard entries={entries} selected={selected} onSelect={setSelectedId} />
          <TeamDivisionRadar key={selected.datasetId} item={selected} datasets={datasets} />
          <MatchupSimulator
            lockedTeamSlug={teamSlug(first)}
            title={`Simulate ${first.name} vs. any ranked team`}
          />
          <ProfileVideos search={teamVideoSearch(entries)} />
          <ProfileCaselistDocuments school={first.school} team={first.name} />
        </>
      )}
    </ProfileFrame>
  )
}

/**
 * The page behind an `@handle` address, which teams and schools share
 * (`/@harker-ll`, `/@michigan`): once the rankings load, renders the team
 * profile when the handle names a ranked team — see {@link profileHandleKind}
 * for the precedence — then, when it names no ranked school either, a
 * past-season college team's profile when one matches (see
 * `PastTeamProfile`), and `school` otherwise.
 *
 * @param props.slug - The handle, without its `@`.
 * @param props.school - The school profile for `slug`, from the host (it adds
 *   the owner-managed panel {@link SchoolProfilePage} takes).
 */
export function ProfileHandlePage({ slug, school }: { slug: string; school: ReactNode }) {
  const { datasets, loading, error } = useAllRankingDatasets()
  const kind = loading || error ? null : profileHandleKind(datasets, slug)
  // A handle that names neither a ranked team nor a ranked school may be a past team's.
  const unranked = kind === "school" && findSchoolEntries(datasets, slug).length === 0
  const past = usePastTeamProfile(slug, unranked)
  if (loading || error || past.loading) {
    return (
      <ProfileFrame>
        <ProfileStatus loading={loading || past.loading} error={error} found={false} kind="team" />
      </ProfileFrame>
    )
  }
  if (kind === "team") return <TeamProfilePage slug={slug} />
  if (past.profile) {
    return (
      <ProfileFrame>
        <PastTeamProfileView team={past.profile} />
      </ProfileFrame>
    )
  }
  return <>{school}</>
}

/**
 * Profile of one school: aggregate stats and every ranked entry, by division.
 *
 * @param props.slug - The school's `@handle`, from `profileSlug`.
 * @param props.ownerPanel - Rendered under the school's name: the host's
 *   owner-managed logo, roster and claim link.
 * @param props.knownName - The school's name when the host knows the school
 *   though no ranking lists it (one a coach created when claiming it); the
 *   page then shows the name and `ownerPanel` instead of "not found".
 */
export function SchoolProfilePage({
  slug,
  ownerPanel,
  knownName,
}: {
  slug: string
  ownerPanel?: ReactNode
  knownName?: string | null
}) {
  const { datasets, loading, error } = useAllRankingDatasets()
  const entries = loading ? [] : findSchoolEntries(datasets, slug)
  const summary = summarizeSchool(entries)

  const levels = schoolLevels(entries)

  if (!loading && entries.length === 0 && knownName) {
    const knownLevels = schoolLevels([], knownName)
    return (
      <ProfileFrame>
        <header className="mt-3">
          <h1 className="text-2xl font-semibold text-foreground">{knownName}</h1>
          <p className="text-sm text-muted-foreground">No ranked entries yet</p>
          <FollowButton kind="school" slug={slug} name={knownName} />
        </header>
        {ownerPanel}
        {knownLevels.college && <ProfileCollegeHistory school={knownName} />}
        {knownLevels.highSchool && <ProfileTocHistory school={knownName} />}
        <ProfileVideos search={schoolVideoSearch(knownName, [])} />
      </ProfileFrame>
    )
  }

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
            <SchoolLogo school={summary.school} className="mb-2 h-12 w-auto" />
            <h1 className="text-2xl font-semibold text-foreground">{summary.school}</h1>
            <p className="text-sm text-muted-foreground">
              {summary.divisions.map((d) => d.datasetLabel).join(" · ")}
            </p>
            <FollowButton kind="school" slug={profileSlug(summary.school)} name={summary.school} />
          </header>
          {ownerPanel}

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
                  <TableHead>Team</TableHead>
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
                      <TeamLabel
                        {...teamDisplayParts({ school: entry.school, name: entry.name })}
                        href={teamHref(entry)}
                        className="text-foreground"
                      />
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

          {levels.college && <ProfileCollegeHistory school={summary.school} />}
          {levels.highSchool && <ProfileTocHistory school={summary.school} />}
          <ProfileVideos search={schoolVideoSearch(summary.school, entries)} />
          <ProfileCaselistDocuments school={summary.school} />
        </>
      )}
    </ProfileFrame>
  )
}
