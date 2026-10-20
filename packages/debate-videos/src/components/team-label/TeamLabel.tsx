/**
 * @fileoverview How the site names a team: a bordered pill holding the
 * school (its logo from `debate-icons` when there is one, else its name)
 * followed by the debaters (their last names when known, else the initials
 * of the team's code). The border is blue for the aff and red for the neg;
 * a team with no side in view (rankings, profiles) uses the aff blue.
 *
 * `teamDisplayParts` in `@debate/rankings-adapter` decides the two parts;
 * this file only draws them.
 * @module components/team-label/TeamLabel
 */

import Link from "next/link"
import { teamDisplayParts, type RankingEntry } from "@debate/rankings-adapter"
import { getSchoolLogo } from "../../lib/schoolLogos"
import { cn } from "../../ui/lib/utils"

/** The side a team debated, which colors its border. */
export type TeamSide = "aff" | "neg"

/** Border and text classes for each side; no side uses the aff colors. */
export const TEAM_SIDE_CLASS: Record<TeamSide, string> = {
  aff: "border-blue-500/80 dark:border-blue-400/80",
  neg: "border-red-500/80 dark:border-red-400/80",
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
  className?: string
}

/**
 * A team as a bordered pill: school logo or name, then debaters. Renders
 * nothing when neither part is known.
 */
export function TeamLabel({ school, debaters, side, href, schoolHref, title, bare, className }: TeamLabelProps) {
  if (!school && !debaters) return null
  const schoolPart = school ? <SchoolMark school={school} /> : null
  return (
    <span
      data-team-label=""
      data-side={side ?? undefined}
      title={title ?? [school, debaters].filter(Boolean).join(" ")}
      className={cn(
        "inline-flex max-w-full min-w-0 items-center gap-1.5 align-middle leading-tight",
        !bare && "rounded-md border px-1.5 py-0.5",
        !bare && TEAM_SIDE_CLASS[side ?? "aff"],
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
      {debaters &&
        (href ? (
          <Link href={href} className="truncate font-medium hover:underline underline-offset-4">
            {debaters}
          </Link>
        ) : (
          <span className="truncate font-medium">{debaters}</span>
        ))}
    </span>
  )
}

export interface TeamCodeLabelProps extends Omit<TeamLabelProps, "school" | "debaters"> {
  /** The team as a video or tournament names it, e.g. `"Harker LL"`. */
  label?: string | null
  /** The team's rankings row, when found: supplies the school and last names. */
  ranking?: Pick<RankingEntry, "school" | "name"> | null
}

/**
 * {@link TeamLabel} for a team code such as a video's aff or neg team: the
 * rankings row's school and last names when there is one, else the code's
 * school and initials.
 */
export function TeamCodeLabel({ label, ranking, ...rest }: TeamCodeLabelProps) {
  const parts = teamDisplayParts({ label, school: ranking?.school, name: ranking?.name })
  return <TeamLabel {...parts} {...rest} />
}
