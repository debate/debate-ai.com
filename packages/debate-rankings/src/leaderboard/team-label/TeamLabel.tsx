/**
 * @fileoverview How the site names a team: a bordered pill holding the
 * school (its logo from `debate-icons` when there is one, else its name)
 * followed by the debaters (their last names when known, else the initials
 * of the team's code). With a logo, the debaters sit on a second row under
 * it; without one, the school name and debaters share one line. The border
 * is blue for the aff and red for the neg;
 * a team with no side in view (rankings, profiles) uses the aff blue.
 *
 * Last names wrap rather than truncate, so they always show in full. A
 * ranked team can carry its rank inside the pill as a small badge
 * ({@link TeamRankBadge}) whose hover tooltip lists the team's stats. A row
 * from a past college season's table carries its `season`, and its tooltip
 * names that season and its debatedata rating.
 *
 * `teamDisplayParts` in `@debate-ai/rankings` decides the two parts;
 * this file only draws them.
 * @module leaderboard/team-label/TeamLabel
 */

import type { ReactNode } from "react"
import Link from "next/link"
import { teamDisplayParts, type RankingEntry } from "../../index"
import { getSchoolLogo } from "../lib/schoolLogos"
import { cn } from "../ui/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/primitives/tooltip"

/** The side a team debated, which colors its border. */
export type TeamSide = "aff" | "neg"

/** Border and text classes for each side; no side uses the aff colors. */
export const TEAM_SIDE_CLASS: Record<TeamSide, string> = {
  aff: "border-blue-500/80 dark:border-blue-400/80",
  neg: "border-red-500/80 dark:border-red-400/80",
}

/**
 * Background and text for a team on a known side: mostly white with a faint
 * blue (aff) or red (neg) tint, so school logos read cleanly. Dark mode keeps
 * a softened white rather than a glaring one. Used by the label pill itself
 * and by the card and watch-page aff/neg badges that hold a bare label.
 */
export const TEAM_SIDE_SURFACE_CLASS: Record<TeamSide, string> = {
  aff: "bg-blue-50/95 text-blue-950 dark:bg-blue-50/85 dark:text-blue-950",
  neg: "bg-red-50/95 text-red-950 dark:bg-red-50/85 dark:text-red-950",
}

/** The school part: its logo when `debate-icons` has one, else its name. */
function SchoolMark({ school }: { school: string }) {
  const logo = getSchoolLogo(school)
  if (!logo) return <span className="truncate">{school}</span>
  // The logo is decorative; the name stays in the text (visually hidden) so
  // screen readers, find-in-page and text search still see the school.
  const name = <span className="sr-only">{school}</span>
  if (typeof logo === "function") {
    const Logo = logo
    return (
      <>
        <Logo aria-hidden className="h-4 w-auto shrink-0" />
        {name}
      </>
    )
  }
  const src = typeof logo === "string" ? logo : logo.src
  return (
    <>
      <img src={src} alt="" aria-hidden title={school} className="h-4 w-auto shrink-0 object-contain" />
      {name}
    </>
  )
}

export interface TeamLabelProps {
  /** The school, shown as its logo when there is one. */
  school?: string | null
  /** Last names (`"Le & Luo"`) or initials (`"LL"`). */
  debaters?: string | null
  /** Colors the border: blue aff, red neg. Defaults to the aff blue. */
  side?: TeamSide | null
  /** Makes the debaters a link, usually to the team's profile. */
  href?: string
  /** Makes the school a link, usually to the school's profile. */
  schoolHref?: string
  /** Hover text for the whole pill. */
  title?: string
  /**
   * Leaves out the pill's own border and padding, for a badge that already
   * draws the side's border (the card and watch-page aff/neg badges).
   */
  bare?: boolean
  /** Drawn inside the pill after the debaters, e.g. a {@link TeamRankBadge}. */
  badge?: ReactNode
  className?: string
}

/**
 * A team as a bordered pill: school logo or name, then debaters. Renders
 * nothing when neither part is known.
 */
export function TeamLabel({ school, debaters, side, href, schoolHref, title, bare, badge, className }: TeamLabelProps) {
  if (!school && !debaters) return null
  const schoolPart = school ? <SchoolMark school={school} /> : null
  // School name on the first row, debaters on the second row.
  const stacked = Boolean(debaters && school)
  return (
    <span
      data-team-label=""
      data-side={side ?? undefined}
      data-stacked={stacked ? "" : undefined}
      title={title ?? [school, debaters].filter(Boolean).join(" ")}
      className={cn(
        "inline-flex max-w-full min-w-0 align-middle leading-tight",
        stacked ? "flex-col items-center gap-0.5 text-center" : "items-center gap-1.5",
        !bare && "rounded-md border px-1.5 py-0.5",
        !bare && TEAM_SIDE_CLASS[side ?? "aff"],
        !bare && side && TEAM_SIDE_SURFACE_CLASS[side],
        className,
      )}
    >
      {schoolPart &&
        (schoolHref ? (
          <Link href={schoolHref} className="inline-flex min-w-0 items-center hover:underline underline-offset-4">
            {schoolPart}
          </Link>
        ) : (
          schoolPart
        ))}
      {schoolPart && debaters ? " " : null}
      {(debaters || badge) && (
        <span className={cn("inline-flex min-w-0 items-center gap-1", stacked && "justify-center")}>
          {debaters &&
            (href ? (
              <Link href={href} className="min-w-0 whitespace-normal break-words font-medium hover:underline underline-offset-4">
                {debaters}
              </Link>
            ) : (
              <span className="min-w-0 whitespace-normal break-words font-medium">{debaters}</span>
            ))}
          {badge}
        </span>
      )}
    </span>
  )
}

/**
 * A team's rankings row as the label reads it: the current season's
 * `RankingEntry`, or a past college season's row, which has a `season` and
 * a rating on debatedata's own scale.
 */
export type TeamRankingRow = Pick<RankingEntry, "school" | "name"> & Partial<RankingEntry> & { season?: number }

export interface TeamCodeLabelProps extends Omit<TeamLabelProps, "school" | "debaters"> {
  /** The team as a video or tournament names it, e.g. `"Harker LL"`. */
  label?: string | null
  /** The team's rankings row, when found: supplies the school and last names. */
  ranking?: TeamRankingRow | null
  /** Shows the ranking's rank inside the pill as a {@link TeamRankBadge}. */
  showRank?: boolean
}

/**
 * {@link TeamLabel} for a team code such as a video's aff or neg team: the
 * rankings row's school and last names when there is one, else the code's
 * school and initials.
 */
export function TeamCodeLabel({ label, ranking, showRank, ...rest }: TeamCodeLabelProps) {
  const parts = teamDisplayParts({ label, school: ranking?.school, name: ranking?.name })
  const badge =
    showRank && ranking && typeof ranking.rank === "number" ? (
      <TeamRankBadge ranking={ranking} side={rest.side} />
    ) : undefined
  return <TeamLabel {...parts} badge={badge} {...rest} />
}

/** Fill and text for the rank badge, matching the pill's border color. */
const RANK_BADGE_CLASS: Record<TeamSide, string> = {
  aff: "bg-blue-600 text-white dark:bg-blue-500",
  neg: "bg-red-600 text-white dark:bg-red-500",
}

/** Win rates arrive as percentages (`54.5`), as on the team profile. */
const percent = (rate?: number | null) =>
  typeof rate === "number" ? `${Number.isInteger(rate) ? rate : rate.toFixed(1)}%` : "—"

/** The tooltip's stat lines for a ranked team, also used as its spoken label. */
export function teamRankStats(ranking: TeamRankingRow) {
  if (typeof ranking.season === "number") {
    const end = ranking.season
    const lines: [string, string][] = [
      ["Season", `${end - 1}-${String(end % 100).padStart(2, "0")}`],
      ["Rank", `#${ranking.rank}`],
    ]
    if (typeof ranking.rating === "number") lines.push(["Rating", ranking.rating.toFixed(2)])
    return lines
  }
  const lines: [string, string][] = [["Rank", `#${ranking.rank}`]]
  if (typeof ranking.adjustedRating === "number") {
    const dev = typeof ranking.deviation === "number" ? ` ±${ranking.deviation.toFixed(1)}` : ""
    lines.push(["Rating", `${ranking.adjustedRating.toFixed(1)}${dev}`])
  }
  if (typeof ranking.matches === "number") lines.push(["Rounds", String(ranking.matches)])
  if (ranking.affWinRate != null || ranking.negWinRate != null)
    lines.push(["Win % aff / neg", `${percent(ranking.affWinRate)} / ${percent(ranking.negWinRate)}`])
  if (ranking.affElimWinRate != null || ranking.negElimWinRate != null)
    lines.push(["Elim win % aff / neg", `${percent(ranking.affElimWinRate)} / ${percent(ranking.negElimWinRate)}`])
  return lines
}

/**
 * A team's rank ("#7") as a small badge in its side's color. Hovering or
 * focusing it opens a tooltip with the school, debaters, rating, rounds and
 * aff/neg win rates. Renders as a span so it can sit inside a link.
 */
export function TeamRankBadge({
  ranking,
  side,
}: {
  ranking: TeamRankingRow
  side?: TeamSide | null
}) {
  const stats = teamRankStats(ranking)
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          data-team-rank=""
          aria-label={`${ranking.school} ${ranking.name}: ${stats.map(([k, v]) => `${k} ${v}`).join(", ")}`}
          className={cn(
            "inline-flex shrink-0 cursor-help items-center rounded px-1 text-[10px] font-semibold leading-4 tabular-nums",
            RANK_BADGE_CLASS[side ?? "aff"],
          )}
        >
          #{ranking.rank}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-left">
        <div className="font-semibold">{ranking.school}</div>
        <div className="mb-1 opacity-80">{ranking.name}</div>
        <dl className="grid grid-cols-[auto_auto] gap-x-3 gap-y-0.5">
          {stats.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="opacity-70">{k}</dt>
              <dd className="text-right tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
      </TooltipContent>
    </Tooltip>
  )
}
