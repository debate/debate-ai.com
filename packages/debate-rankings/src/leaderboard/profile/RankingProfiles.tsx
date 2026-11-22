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
import { useEffect, useState, type ReactNode } from "react"
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
  canonicalSchoolHandle,
  profileHandleKind,
  schoolDivisionRadarData,
  schoolHandle,
  schoolHref,
  schoolAliases,
  schoolLevels,
  schoolVideoSearch,
  summarizeSchool,
  teamHandle,
  teamHref,
  teamRadarData,
  teamSlug,
  teamVideoSearch,
  type ProfileEntry,
} from "./rankingProfileHelpers"
import { ProfileVideos } from "./ProfileVideosSlot"
import { NICHE_ACADEMICS_SOURCE, findNicheAcademicsRank } from "../../schools/niche-academics"
import { PastTeamProfileView, usePastTeamProfile } from "./PastTeamProfile"
import { PastHighSchoolTeamView, usePastHighSchoolTeam } from "./PastHighSchoolTeamProfile"
import { ProfileCaselistDocuments } from "./ProfileCaselistDocuments"
import { ProfileCaselistTeam } from "./ProfileCaselistTeam"
import { CaselistSyncButton } from "./CaselistSyncButton"
import { ProfileHistoricalLegend } from "./ProfileHistoricalLegend"
import { ProfileNdtHeadline } from "./ProfileNdtHistory"
import { ProfileProgramStrengthHeadline } from "./ProfileProgramStrength"
import { SchoolLogo } from "../SchoolLogo"
import { useSchoolLogo, useShowSchoolMascots } from "../lib/school-art-settings"
import { TeamLabel } from "../team-label/TeamLabel"
import { TeamRadarChart } from "./TeamRadarChart"
import { MatchupSimulator } from "./MatchupSimulator"
import { FollowButton } from "./FollowButton"
import { fetchSchoolDirectoryEntry, type SchoolDirectoryEntry } from "../../schools/school-directory"
import { formatSchoolLocation, schoolLocation, type SchoolLocation } from "../../schools/school-location"

const SCHOOL_MASCOTS: Array<{ match: (name: string) => boolean; src: string }> = [
  { match: (n) => n.includes("emory"), src: "https://i.imgur.com/FNGtPF7.png" },
  { match: (n) => n.includes("georgetown"), src: "https://i.imgur.com/oE3FT1H.png" },
  { match: (n) => n.includes("oklahoma"), src: "https://i.imgur.com/VQ5S4T5.png" },
  { match: (n) => n.includes("michigan state"), src: "https://i.imgur.com/NGciz4V.png" },
  { match: (n) => n.includes("michigan") && !n.includes("michigan state"), src: "https://i.imgur.com/zN87K6g.png" },
  { match: (n) => n.includes("northwestern"), src: "https://i.imgur.com/wikmA5p.png" },
  { match: (n) => n.includes("north texas"), src: "" },
  { match: (n) => n.includes("st mark") || n.includes("st. mark") || n.includes("saint mark"), src: "https://i.imgur.com/9g79tLn.png" },
  { match: (n) => n.includes("texas") && !n.includes("north texas") && !n.includes("texas dallas"), src: "https://i.imgur.com/Ok41OIf.png" },
  { match: (n) => n.includes("kansas") && !n.includes("kansas state"), src: "https://i.imgur.com/CdwUMzp.png" },
  { match: (n) => n.includes("dartmouth"), src: "https://i.imgur.com/vJCwQqQ.png" },
  { match: (n) => n.includes("harvard") && !n.includes("harvard-westlake"), src: "https://i.imgur.com/YGxqIOO.png" },
  { match: (n) => n.includes("iowa"), src: "https://i.imgur.com/0uyNfd8.png" },
  { match: (n) => n.includes("wake forest"), src: "https://i.imgur.com/Y569FI5.png" },
  { match: (n) => n.includes("uc berkeley") || n.includes("cal berkeley") || /\bberkeley\b/.test(n), src: "https://i.imgur.com/gOvW4HW.png" },
]

/** School-page mascot: pinned to the top-left of the header. */
const MASCOT_CLASS = "h-[200px] w-auto shrink-0 self-start sm:h-[250px]"

function SchoolMascot({ school, className = "h-[230px] w-auto" }: { school: string; className?: string }) {
  // Hidden while Settings → Preferences has school mascots switched off.
  const show = useShowSchoolMascots()
  if (!show) return null
  const name = school.toLowerCase()
  const src = SCHOOL_MASCOTS.find((m) => m.match(name))?.src
  return src ? <img src={src} alt="" className={className} /> : null
}

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
/** "Houston, Texas" (or just the state) under a school's name; nothing when unknown. */
function SchoolLocationLine({ school, saved }: { school: string; saved?: Partial<SchoolLocation> | null }) {
  const text = formatSchoolLocation(schoolLocation(school, saved))
  return text ? (
    <p data-school-location className="text-sm text-muted-foreground">
      {text}
    </p>
  ) : null
}

/** Season year 2019 as "2018-19". */
function seasonLabel(year: number): string {
  return `${year - 1}-${String(year % 100).padStart(2, "0")}`
}

/**
 * The school directory's row for `handle` (null skips the lookup): how a
 * page finds a school of the last ten seasons that this season's rankings
 * don't list.
 */
function useSchoolDirectoryEntry(handle: string | null): { entry: SchoolDirectoryEntry | null; loading: boolean } {
  const [state, setState] = useState<{ handle: string | null; entry: SchoolDirectoryEntry | null }>({ handle: null, entry: null })
  useEffect(() => {
    if (!handle) return
    const controller = new AbortController()
    void fetchSchoolDirectoryEntry(handle, controller.signal).then((entry) => {
      if (!controller.signal.aborted) setState({ handle, entry })
    })
    return () => controller.abort()
  }, [handle])
  if (!handle) return { entry: null, loading: false }
  return state.handle === handle ? { entry: state.entry, loading: false } : { entry: null, loading: true }
}

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

/**
 * The Win rates band, listing only the rates the team has data for and
 * hidden entirely when it has none.
 */
function WinRatesBand({ entry }: { entry: ProfileEntry["entry"] }) {
  const rows = [
    ["Aff win %", entry.affWinRate],
    ["Neg win %", entry.negWinRate],
    ["Elim aff win %", entry.affElimWinRate],
    ["Elim neg win %", entry.negElimWinRate],
  ] as const
  const present = rows.filter(([, value]) => value !== null && Number.isFinite(value))
  if (present.length === 0) return null
  return (
    <StatBand title="Win rates" tone="dark">
      {present.map(([label, value]) => (
        <RecordStat key={label} label={label} value={percent(value)} />
      ))}
    </StatBand>
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
  const firstLogo = useSchoolLogo(first.school)
  const { entry, fieldSize, datasetLabel } = selected
  const topPercent = fieldSize > 0 ? (entry.rank / fieldSize) * 100 : null
  return (
    <div className="mt-3 overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm">
      <header className="px-4 pb-4 pt-5 sm:px-6">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          <TeamLabel
            {...teamDisplayParts({ school: first.school, name: first.name })}
            title={`${first.school} · ${first.name}`}
            schoolHref={schoolHref(first.school)}
            className="border-2 px-2.5 py-1 [&_img]:h-7 sm:[&_img]:h-8"
          />
        </h1>
        {/* With a logo, the logo in the label above already links to the school. */}
        {!firstLogo && (
          <Link href={schoolHref(first.school)} className="text-base text-muted-foreground underline-offset-4 hover:underline flex items-center gap-2 mt-1">
            {first.school}
          </Link>
        )}
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
      <WinRatesBand entry={entry} />
      {/* The rating model's per-argument splits (aff vs CP/DA, K, T; neg CP/DA, K, T)
          have no data source yet, so the band stays hidden until they do. */}
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
 * Swaps the address bar to `canonical` (an `@handle` path) when an older link
 * opened the page, without a navigation. `null` leaves the address alone.
 */
function useCanonicalPath(canonical: string | null) {
  useEffect(() => {
    if (!canonical || typeof window === "undefined") return
    if (decodeURIComponent(window.location.pathname) !== canonical) {
      window.history.replaceState(window.history.state, "", canonical + window.location.search + window.location.hash)
    }
  }, [canonical])
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
  // An older link (initials or full names) shows the last-names address
  // instead — unless it names several different pairs, which stay together.
  const handles = new Set(entries.map((item) => teamHandle(item.entry)))
  const canonical = handles.size === 1 ? `/@${[...handles][0]}` : null
  useCanonicalPath(canonical)

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
          <ProfileCaselistTeam dataset={selected.datasetId} school={first.school} team={first.name} />
        </>
      )}
    </ProfileFrame>
  )
}

/**
 * The page behind an `@handle` address, which teams and schools share
 * (`/@harker-lin-lee`, `/@michigan`): once the rankings load, renders the team
 * profile when the handle names a ranked team — see {@link profileHandleKind}
 * for the precedence — then, when it names no ranked school either, a
 * past-season college team's profile when one matches (see
 * `PastTeamProfile`), then a past-season high school team's (see
 * `PastHighSchoolTeamProfile`), and `school` otherwise.
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
  // Then a past high school team a school page lists among a season's best entries.
  const pastHighSchool = usePastHighSchoolTeam(slug, unranked && !past.loading && !past.profile)
  if (loading || error || past.loading || pastHighSchool.loading) {
    return (
      <ProfileFrame>
        <ProfileStatus
          loading={loading || past.loading || pastHighSchool.loading}
          error={error}
          found={false}
          kind="team"
        />
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
  if (pastHighSchool.team) {
    return (
      <ProfileFrame>
        <PastHighSchoolTeamView team={pastHighSchool.team} datasets={datasets} />
      </ProfileFrame>
    )
  }
  return <>{school}</>
}

/**
 * Profile of one school: aggregate stats and every ranked entry, by division.
 *
 * @param props.slug - The school's `@handle`, from `schoolHandle`.
 * @param props.ownerPanel - Rendered under the school's name: the host's
 *   owner-managed logo, roster and claim link.
 * @param props.savedLocation - City and state from the school's page; the
 *   line under the name falls back to the state its name or records give.
 * @param props.knownName - The school's name when the host knows the school
 *   though no ranking lists it (one a coach created when claiming it); the
 *   page then shows the name and `ownerPanel` instead of "not found".
 */
export function SchoolProfilePage({
  slug,
  ownerPanel,
  knownName,
  savedLocation,
}: {
  slug: string
  ownerPanel?: ReactNode
  knownName?: string | null
  /** The city and state the school's page saved (owners set them), if any. */
  savedLocation?: Partial<SchoolLocation> | null
}) {
  const { datasets, loading, error } = useAllRankingDatasets()
  const entries = loading ? [] : findSchoolEntries(datasets, slug)
  const summary = summarizeSchool(entries)
  const schoolLogo = useSchoolLogo(summary.school)
  // An older full-name link (`/@emory-university`) shows the school's handle
  // (`/@emory`) instead.
  useCanonicalPath(
    loading ? null : entries.length > 0 ? schoolHref(summary.school) : `/@${canonicalSchoolHandle(slug)}`,
  )

  const levels = schoolLevels(entries)
  // A school of the last ten seasons that this season's rankings don't list:
  // the school directory (rebuilt daily on the server) still knows it.
  const unranked = !loading && entries.length === 0
  const directory = useSchoolDirectoryEntry(unranked ? slug : null)
  const pastName = knownName || directory.entry?.name || null

  if (unranked && !knownName && directory.loading) {
    return (
      <ProfileFrame>
        <ProfileStatus loading error={null} found={false} kind="school" />
      </ProfileFrame>
    )
  }

  if (unranked && pastName) {
    const knownLevels = directory.entry
      ? { college: directory.entry.level === "college", highSchool: directory.entry.level === "highSchool" }
      : schoolLevels([], pastName)
    const aliases = directory.entry?.aliases ?? schoolAliases(slug).filter((name) => name !== pastName)
    const seasons = directory.entry
      ? directory.entry.firstYear === directory.entry.lastYear
        ? `Ranked in ${seasonLabel(directory.entry.lastYear)}`
        : `Ranked ${seasonLabel(directory.entry.firstYear)} to ${seasonLabel(directory.entry.lastYear)}`
      : null
    return (
      <ProfileFrame>
        <ProfileVideos search={schoolVideoSearch(pastName, [])} variant="marquee" />
        <header className="mt-3 flex items-start gap-4">
          <SchoolMascot school={pastName} className={MASCOT_CLASS} />
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-semibold text-foreground">{pastName}</h1>
            <SchoolLocationLine school={pastName} saved={savedLocation} />
            <p className="text-sm text-muted-foreground">
              {seasons ? `${seasons} · not in this season's rankings` : "No ranked entries yet"}
            </p>
            {aliases.length > 0 && (
              <p className="text-xs text-muted-foreground">Also listed as {aliases.join(", ")}</p>
            )}
            <FollowButton kind="school" slug={slug} name={pastName} />
            {knownLevels.college && <ProfileProgramStrengthHeadline school={pastName} className="mt-4" />}
            {knownLevels.college && <ProfileNdtHeadline school={pastName} className="mt-4" />}
          </div>
        </header>
        {ownerPanel}
        <ProfileHistoricalLegend school={pastName} levels={knownLevels} entries={[]} />
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
  const radarDivisions = Array.from(divisions.values())
    .map((div) => ({ div, data: schoolDivisionRadarData(div.items) }))
    .filter(({ data }) => data.length > 0)

  return (
    <ProfileFrame>
      <ProfileStatus loading={loading} error={error} found={entries.length > 0} kind="school" />
      {entries.length > 0 && (
        <>
          {/* The school's videos, newest first, scrolling across the top banner row. */}
          <ProfileVideos search={schoolVideoSearch(summary.school, entries)} variant="marquee" />
          {/* Mascot pinned top-left; name, follow and stat tiles fill the rest of the row. */}
          <header className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start">
            <SchoolMascot school={summary.school} className={MASCOT_CLASS} />
            <div className="min-w-0 flex-1">
              {/* With a logo, the logo stands for the name; the heading stays for screen readers. */}
              {schoolLogo && (
                <Link href={schoolHref(summary.school)} title={summary.school} className="mb-2 inline-block">
                  <SchoolLogo school={summary.school} className="h-12 w-auto" />
                </Link>
              )}
              <h1 className={schoolLogo ? "sr-only" : "text-2xl font-semibold text-foreground"}>
                {summary.school}
              </h1>
              <SchoolLocationLine school={summary.school} saved={savedLocation} />
              <p className="text-sm text-muted-foreground">
                {summary.divisions.map((d) => d.datasetLabel).join(" · ")}
              </p>
              <FollowButton kind="school" slug={schoolHandle(summary.school)} name={summary.school} />

              <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
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
                {levels.highSchool && <AcademicsRankStat school={summary.school} />}
              </div>
              {levels.college && <ProfileProgramStrengthHeadline school={summary.school} className="mt-4" />}
              {levels.college && <ProfileNdtHeadline school={summary.school} className="mt-4" />}
            </div>
          </header>
          {ownerPanel}

          {/* A high school's statistics (program strength by season, championships, TOC and NDCA records) lead the page. */}
          {levels.highSchool && (
            <ProfileHistoricalLegend
              school={summary.school}
              levels={{ ...levels, college: false }}
              entries={entries}
            />
          )}

          {/* Radar charts in a side column next to the entries table, so neither leaves an empty half row. */}
          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:items-start">
            {radarDivisions.length > 0 && (
              <div className="flex flex-col gap-4">
                {radarDivisions.map(({ div, data }) => (
                  <div key={div.datasetLabel}>
                    <h2 className="mb-2 text-sm font-medium text-muted-foreground">
                      {div.datasetLabel} · {div.items.length} teams
                    </h2>
                    <TeamRadarChart
                      data={data}
                      caption={`School average · ${div.datasetLabel} (${div.items.length} teams; edge = best; ranking is a field percentile, matches relative to the most-played entry)`}
                      ariaLabel={`School average radar · ${div.datasetLabel}: ${data.map((d) => `${d.metric} ${d.display}`).join(", ")}`}
                    />
                  </div>
                ))}
              </div>
            )}

            <div
              className={`overflow-x-auto rounded-lg border bg-card shadow-sm ${radarDivisions.length > 0 ? "lg:mt-7" : "lg:col-span-2"}`}
            >
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
          </div>

          {levels.college && (
            <ProfileHistoricalLegend
              school={summary.school}
              levels={{ ...levels, highSchool: false }}
              entries={entries}
            />
          )}
          <CaselistSyncButton
            targets={entries.map(({ datasetId, entry }) => ({ dataset: datasetId, school: entry.school, team: entry.name }))}
            label={`Sync all ${entries.length} team${entries.length === 1 ? "" : "s"} from openCaselist`}
            className="mt-6"
          />
          <ProfileCaselistDocuments school={summary.school} />
        </>
      )}
    </ProfileFrame>
  )
}

/**
 * A high school's academics ranks: its place on Niche's 2027 list of the 200
 * best US high schools (the only academics ranking the site uses), and its
 * place among that list's schools in its own state. The tiles don't name
 * Niche (the hover does). Shows "—" for a school outside the list.
 */
function AcademicsRankStat({ school }: { school: string }) {
  const niche = findNicheAcademicsRank(school)
  const source = `${NICHE_ACADEMICS_SOURCE.label}${niche ? ` · ${niche.name} (${niche.state}, ${niche.type})` : ": not in the top 200"}`
  return (
    <>
      <span title={source}>
        <Stat label="Academics rank" value={niche ? `#${niche.position}` : "—"} />
      </span>
      <span title={niche ? `${source} · #${niche.stateRank} of the list's ${niche.state} schools` : source}>
        <Stat label={niche ? `Academics rank · ${niche.state}` : "Academics rank in state"} value={niche ? `#${niche.stateRank}` : "—"} />
      </span>
    </>
  )
}
