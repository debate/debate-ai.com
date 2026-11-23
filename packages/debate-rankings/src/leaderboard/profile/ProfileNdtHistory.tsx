/**
 * @fileoverview College NDT section of a school profile: the school's
 * National Debate Tournament record — championships (NDT plus CEDA in one
 * total), its all-time rank among schools by all-seasons NDT points, elim
 * qualifiers (with first-round at-large bids merged in and marked "first
 * round") and the school's elim finish rank for the last decade and for all
 * years, speaker and coaching awards — from the
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
  latestNdtYear,
  mergeElimsAndBids,
  ndtElimScore,
  rankNdtElimScore,
  useNdtHistory,
  type NdtElimOrBid,
  type NdtElimRank,
  type NdtElimScore,
} from "./ndtHistory"
import { useNdtSchoolAllTimeRank } from "./useNdtAllTimeRanks"

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
 * The school's elim finish score ({@link ndtElimScore}) shown as its integer
 * rank among every school with an elim in the span.
 */
function ElimRankStat({
  label,
  result,
  rank,
  onShowAll,
}: {
  label: string
  result: NdtElimScore | undefined
  rank: NdtElimRank | undefined
  onShowAll?: () => void
}) {
  return (
    <div className="relative rounded-md border bg-muted/30 px-3 py-2 pr-9">
      <div className="text-lg font-semibold tabular-nums text-foreground">{rank ? `#${rank.rank}` : "—"}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xs tabular-nums text-muted-foreground/80">
        {rank && result
          ? `of ${rank.of} schools · ${result.score} pts · ${result.elims} elim${result.elims === 1 ? "" : "s"}`
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
 * Elim qualifiers with first-round at-large bids merged in: a team that held a
 * bid that year shows "(first round)" after its name, and a bid team that
 * missed elims gets its own row without a round.
 */
function ElimAndBidList({ items, school }: { items: NdtElimOrBid[]; school: string }) {
  if (items.length === 0) return null
  return (
    <section className="min-w-0">
      <SectionHeading icon={<Swords className={LIST_ICON} />}>Elim qualifiers ({items.length})</SectionHeading>
      <ul className={`space-y-0.5 text-sm ${SCROLL_AREA}`}>
        {items.map((item) => (
          <li key={`${item.year}-${item.team}-${item.round ?? "bid"}`} className="flex flex-wrap items-baseline gap-x-2">
            <YearLink year={item.year} />
            {item.round && (
              <Badge variant={item.round === "Champion" ? "default" : "secondary"} className="text-xs">
                {item.round}
              </Badge>
            )}
            <span>
              <Link href={pastTeamHref({ school, name: item.team })} className="text-foreground hover:underline underline-offset-4">
                {item.team}
              </Link>
              {item.firstRound && (
                <span className="ml-1 inline-flex items-center gap-0.5 text-muted-foreground" title="First-round at-large bid">
                  <Ticket className="h-3 w-3" aria-hidden />
                  (first round{item.bidRank ? ` #${item.bidRank}` : ""})
                </span>
              )}
            </span>
            <span className="text-xs text-muted-foreground">
              {[item.record, item.seed && `seed ${item.seed}`].filter(Boolean).join(" · ")}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

/**
 * The school's headline numbers — championships, finalists and top speakers
 * (NDT, CEDA and Shirley; see {@link collegeHonors}), elim qualifiers and
 * elim finish ranks — with their source line. School pages show it at the
 * top of the page; the NDT record card below keeps the lists.
 * Renders nothing for a school that never attended the NDT.
 * @param props.school - School name as the rankings spell it.
 */
export function ProfileNdtHeadline({ school, className = "" }: { school: string; className?: string }) {
  const schools = useNdtHistory()
  const [elimSpan, setElimSpan] = useState<ElimRankSpan["id"] | null>(null)
  const history = useMemo(() => (schools ? findNdtSchoolHistory(schools, school) : null), [schools, school])
  const allTime = useNdtSchoolAllTimeRank(history?.school ?? null)

  if (!history) return null

  const decadeStart = latestNdtYear(schools ?? []) - 9
  const decadeLabel = `${decadeStart}–${decadeStart + 9}`
  const decadeElims = history.elims.filter((elim) => elim.year >= decadeStart).length
  const honors = collegeHonors(school, history)
  const elimSpans: ElimRankSpan[] = [
    {
      id: "decade",
      label: `Elim finish rank, ${decadeLabel}`,
      short: decadeLabel,
      sinceYear: decadeStart,
      recentFromYear: decadeStart,
    },
    {
      id: "allYears",
      label: "Elim finish rank, all years",
      short: "All years",
      sinceYear: -Infinity,
      recentFromYear: decadeStart,
    },
  ]

  return (
    <section className={className} aria-label="College NDT and CEDA record">
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat
          label="All-time rank"
          value={allTime ? `#${allTime.rank}` : "—"}
          hint={allTime ? `of ${allTime.of} schools · ${Math.round(allTime.total)} NDT pts` : undefined}
        />
        <Stat label="Championships" value={honors.championships.total} hint={honorHint(honors.championships)} />
        <Stat label="Finalists" value={honors.finalists.total} hint={honorHint(honors.finalists)} />
        <Stat label="Top speakers" value={honors.topSpeakers.total} hint={honorHint(honors.topSpeakers)} />
        <Stat label={`Elim qualifiers, ${decadeLabel}`} value={decadeElims} />
        <ElimRankStat
          label={`Elim finish rank, ${decadeLabel}`}
          result={ndtElimScore(history, decadeStart, decadeStart)}
          rank={rankNdtElimScore(schools ?? [], history, decadeStart, decadeStart)}
          onShowAll={() => setElimSpan("decade")}
        />
        <Stat label="Elim qualifiers, all years" value={history.elims.length} />
        <ElimRankStat
          label="Elim finish rank, all years"
          result={ndtElimScore(history, -Infinity, decadeStart)}
          rank={rankNdtElimScore(schools ?? [], history, -Infinity, decadeStart)}
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

  const elims = mergeElimsAndBids(history)
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
          <ElimAndBidList items={elims} school={history.school} />
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
