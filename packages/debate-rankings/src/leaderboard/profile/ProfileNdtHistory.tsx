/**
 * @fileoverview College NDT section of a school profile: the school's
 * National Debate Tournament record — championships (NDT plus CEDA in one
 * total), elim qualifiers and the school's rank by average elim finish for the last decade and for
 * all years, first-round at-large bids, speaker and coaching awards — from the
 * NDT's published school history. Renders nothing for a school that never
 * attended. The headline tiles and source line are `ProfileNdtHeadline`,
 * which school pages show at the top of the page; the card keeps the lists.
 * Its "All seasons" button opens every NDT team and school ranked
 * by all-seasons points (NdtAllSeasonsDialog). The school's CEDA national
 * championships list sits directly under its NDT championships.
 * @module leaderboard/profile/ProfileNdtHistory
 */

"use client"

import { useMemo, useState, type ReactNode } from "react"
import Link from "next/link"
import { Award, GraduationCap, ListOrdered, Mic, Swords, Ticket, Trophy } from "lucide-react"
import { SchoolLogo } from "../SchoolLogo"
import { findCedaSchoolTitles } from "../../sync/ceda-champions"
import type { NdtTeamResult } from "../../sync/ndt-school-history"
import { SHIRLEY_SOURCE_URL } from "../../sync/shirley-results"
import { Badge } from "../ui/primitives/badge"
import { Button } from "../ui/primitives/button"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/primitives/card"
import { findNdtSchoolHistory } from "./rankingProfileHelpers"
import { pastTeamHref } from "./pastTeamHelpers"
import { NdtAllSeasonsButton } from "./NdtAllSeasonsDialog"
import { CedaTitleList } from "./ProfileCedaHistory"
import { ElimRankDialog, type ElimRankSpan } from "./ElimRankDialog"
import { collegeHonors, honorHint } from "./schoolHonors"
import {
  averageNdtElim,
  latestNdtYear,
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

/**
 * Average elim placement shown only as the school's rank among schools with
 * enough elims — never as a round name (Quarters, Semis…).
 */
function ElimRankStat({
  label,
  average,
  rank,
  onShowAll,
}: {
  label: string
  average: NdtElimAverage | undefined
  rank: NdtElimRank | undefined
  onShowAll?: () => void
}) {
  return (
    <div className="relative rounded-md border bg-muted/30 px-3 py-2 pr-9">
      <div className="text-lg font-semibold tabular-nums text-foreground">{rank ? `#${rank.rank}` : "—"}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xs tabular-nums text-muted-foreground/80">
        {rank
          ? `of ${rank.of} schools · ${average?.elims ?? 0} elim${average?.elims === 1 ? "" : "s"}`
          : average
            ? `unranked, under ${MIN_RANKED_ELIMS} elims`
            : "no elims"}
      </div>
      {onShowAll && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onShowAll}
          aria-haspopup="dialog"
          aria-label={`Full ranking: ${label}`}
          title="Show the full ranking"
          className="absolute right-1 top-1 h-7 w-7 text-muted-foreground hover:text-foreground"
        >
          <ListOrdered aria-hidden />
        </Button>
      )}
    </div>
  )
}

/** One NDT list; each team links to its past-team page. */
/** The icon before a list's label: the tournament's logo, or a lucide icon. */
const LIST_ICON = "h-4 w-4 shrink-0"

/** A list section's heading, with its icon before the label. */
export function SectionHeading({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <h3 className="mb-1 flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
      <span aria-hidden className="inline-flex shrink-0 items-center">
        {icon}
      </span>
      {children}
    </h3>
  )
}

function TeamList({
  title,
  items,
  school,
  icon,
}: {
  title: string
  items: NdtTeamResult[]
  school: string
  icon: ReactNode
}) {
  if (items.length === 0) return null
  return (
    <section className="min-w-0">
      <SectionHeading icon={icon}>
        {title} ({items.length})
      </SectionHeading>
      <ul className={`space-y-0.5 text-sm ${SCROLL_AREA}`}>
        {items.map((item) => (
          <li key={`${item.year}-${item.team}`} className="flex flex-wrap items-baseline gap-x-2">
            <YearLink year={item.year} />
            {item.round && (
              <Badge variant={item.round === "Champion" ? "default" : "secondary"} className="text-xs">
                {item.round}
              </Badge>
            )}
            <Link href={pastTeamHref({ school, name: item.team })} className="text-foreground hover:underline underline-offset-4">
              {item.team}
            </Link>
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
 * The school's headline numbers — championships, finalists and top speakers
 * (NDT, CEDA and Shirley; see {@link collegeHonors}), best finish, elim
 * qualifiers and elim finish ranks — with their source line. School pages
 * show it at the top of the page; the NDT record card below keeps the lists.
 * Renders nothing for a school that never attended the NDT.
 * @param props.school - School name as the rankings spell it.
 */
export function ProfileNdtHeadline({ school, className = "" }: { school: string; className?: string }) {
  const schools = useNdtHistory()
  const [elimSpan, setElimSpan] = useState<ElimRankSpan["id"] | null>(null)
  const history = useMemo(() => (schools ? findNdtSchoolHistory(schools, school) : null), [schools, school])

  if (!history) return null

  const decadeStart = latestNdtYear(schools ?? []) - 9
  const decadeLabel = `${decadeStart}–${decadeStart + 9}`
  const decadeElims = history.elims.filter((elim) => elim.year >= decadeStart).length
  const cedaTitles = findCedaSchoolTitles(school)?.titles.length ?? 0
  const honors = collegeHonors(school, history)
  const elimSpans: ElimRankSpan[] = [
    { id: "decade", label: `Elim finish rank, ${decadeLabel}`, short: decadeLabel, sinceYear: decadeStart },
    { id: "allYears", label: "Elim finish rank, all years", short: "All years", sinceYear: -Infinity },
  ]

  return (
    <section className={className} aria-label="College NDT and CEDA record">
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
        {cedaTitles > 0 && (
          <>
            {" "}and the{" "}
            <a href="https://www.cedadebate.org/" target="_blank" rel="noreferrer" className="hover:underline">
              Cross Examination Debate Association
            </a>{" "}
            history of winners
          </>
        )}
        {honors.championships.parts[2].count + honors.finalists.parts[1].count > 0 && (
          <>
            {" "}and the{" "}
            <a href={SHIRLEY_SOURCE_URL} target="_blank" rel="noreferrer" className="hover:underline">
              Shirley winners list
            </a>
          </>
        )}
      </p>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Championships" value={honors.championships.total} hint={honorHint(honors.championships)} />
        <Stat label="Finalists" value={honors.finalists.total} hint={honorHint(honors.finalists)} />
        <Stat label="Top speakers" value={honors.topSpeakers.total} hint={honorHint(honors.topSpeakers)} />
        <Stat label={`Elim qualifiers, ${decadeLabel}`} value={decadeElims} />
        <ElimRankStat
          label={`Elim finish rank, ${decadeLabel}`}
          average={averageNdtElim(history, decadeStart)}
          rank={rankNdtElimAverage(schools ?? [], history, decadeStart)}
          onShowAll={() => setElimSpan("decade")}
        />
        <Stat label="Elim qualifiers, all years" value={history.elims.length} />
        <ElimRankStat
          label="Elim finish rank, all years"
          average={averageNdtElim(history)}
          rank={rankNdtElimAverage(schools ?? [], history)}
          onShowAll={() => setElimSpan("allYears")}
        />
      </div>
      <ElimRankDialog
        schools={schools ?? []}
        spans={elimSpans}
        spanId={elimSpan}
        ownSchool={history.school}
        onSpan={setElimSpan}
        onClose={() => setElimSpan(null)}
      />
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
  const cedaTitles = findCedaSchoolTitles(school)?.titles.length ?? 0

  return (
    <Card className="mt-4">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Trophy className="h-4 w-4" aria-hidden />
            College NDT record
          </CardTitle>
          <NdtAllSeasonsButton history={schools ?? []} school={history.school} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2">
          {(champions.length > 0 || cedaTitles > 0) && (
            <div className="min-w-0 space-y-4">
              <TeamList
                title="NDT championships"
                items={champions}
                school={history.school}
                icon={<SchoolLogo school="NDT" className="h-4 w-auto" />}
              />
              <CedaTitleList school={school} />
            </div>
          )}
          <TeamList title="Elim qualifiers" items={elims} school={history.school} icon={<Swords className={LIST_ICON} />} />
          <TeamList
            title="First-round at-large bids"
            items={history.atLargeBids}
            school={history.school}
            icon={<Ticket className={LIST_ICON} />}
          />
          <TeamList
            title="Copeland Award winners"
            items={history.copelandWinners}
            school={history.school}
            icon={<Award className={LIST_ICON} />}
          />

          {history.speakerAwards.length > 0 && (
            <section className="min-w-0">
              <SectionHeading icon={<Mic className={LIST_ICON} />}>
                Speaker awards ({history.speakerAwards.length})
              </SectionHeading>
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
              <SectionHeading icon={<GraduationCap className={LIST_ICON} />}>
                Coaching awards ({history.coachingAwards.length})
              </SectionHeading>
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
