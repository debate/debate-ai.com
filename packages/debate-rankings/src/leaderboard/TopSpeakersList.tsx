/**
 * @fileoverview The "Top 10 speaker awards" card on the Greatest of All Time
 * pages: the debaters with the most top speaker awards in the format showing,
 * each with the awards they won (year and tournament), linked to their
 * team's page when one exists and to their school's page otherwise. A
 * collapsible `<details>` above the all-time list; it renders nothing for a
 * format with no speaker awards on record.
 * @module leaderboard/TopSpeakersList
 */

import Link from "next/link"
import { Mic } from "lucide-react"
import { SchoolLogo } from "./SchoolLogo"
import { ndtSchoolDisplayName } from "./profile/ndtAllSeasons"
import { schoolHref, teamHref } from "./profile/rankingProfileHelpers"
import { TOP_SPEAKERS_LIMIT, type SpeakerAward, type TopSpeaker } from "./profile/topSpeakers"

function awardsLine(awards: SpeakerAward[]): string {
  return awards.map((award) => `${award.year} ${award.tournament}${award.rank === 1 ? "" : ` ${award.label.replace(" speaker", "")}`}`).join(" · ")
}

/**
 * @param props.speakers - The ranked debaters, best first; the card is hidden when empty or missing.
 * @param props.format - The format's name, e.g. `"high school Policy"` or `"College Policy"`.
 * @param props.ndt - Schools are NDT names (shown without their state or "University").
 */
export function TopSpeakersList({
  speakers,
  format,
  ndt = false,
  limit = TOP_SPEAKERS_LIMIT,
}: {
  speakers: TopSpeaker[] | null | undefined
  format: string
  ndt?: boolean
  limit?: number
}) {
  if (!speakers?.length) return null
  const rows = speakers.slice(0, limit)
  return (
    <details open className="rounded-lg border bg-background" data-top-speakers>
      <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-base font-semibold">
        <Mic className="h-4 w-4 text-amber-500" aria-hidden />
        Top {limit} speaker awards · {format}
      </summary>
      <div className="border-t px-4 pb-3 pt-2">
        <p className="text-xs text-muted-foreground">
          The debaters with the most top speaker awards of all time{ndt ? " at the NDT" : " at the TOC, NDCA, Barkley Forum, Cal and Glenbrooks"}.
          Ties go to the most points for lower speaker places, then the most tournaments, then the most recent award.
        </p>
        <ol aria-label={`Top ${limit} speaker awards, ${format}`} className="mt-1 divide-y text-sm">
          {rows.map((speaker) => {
            const school = ndt ? ndtSchoolDisplayName(speaker.school) : speaker.school
            return (
              <li key={`${speaker.school}-${speaker.name}`} className="flex items-start gap-3 px-1.5 py-1.5" data-top-speaker>
                <span className="w-9 shrink-0 pt-0.5 text-right font-semibold tabular-nums text-muted-foreground">{speaker.rank}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    {speaker.teamName ? (
                      <Link
                        href={teamHref({ school: speaker.school, name: speaker.teamName })}
                        className="font-medium text-foreground underline-offset-4 hover:underline"
                      >
                        {speaker.name}
                      </Link>
                    ) : (
                      <span className="font-medium text-foreground">{speaker.name}</span>
                    )}
                    <Link
                      href={schoolHref(school)}
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-4 hover:underline"
                    >
                      <SchoolLogo school={school} className="h-4 w-auto max-w-[3.5rem] shrink-0 object-contain" />
                      {school}
                    </Link>
                  </div>
                  <span className="block text-xs text-muted-foreground">{awardsLine(speaker.awards)}</span>
                </div>
                <span className="shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                  <span className="text-sm font-semibold text-foreground">{speaker.topSpeakerAwards}</span> top speaker
                  {speaker.topSpeakerAwards === 1 ? "" : "s"}
                  {speaker.awards.length > speaker.topSpeakerAwards && (
                    <span className="block">{speaker.awards.length} awards</span>
                  )}
                </span>
              </li>
            )
          })}
        </ol>
      </div>
    </details>
  )
}
