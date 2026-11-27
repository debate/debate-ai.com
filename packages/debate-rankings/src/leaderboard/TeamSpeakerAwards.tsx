/**
 * @fileoverview The speaker awards line on a Greatest of All Time team row:
 * each of the team's debaters with their top speaker awards (year and
 * tournament) and a count, so the speaker honors sit with the team list
 * instead of in a block of their own. Debaters appear in the speaker
 * ranking's order (most top speaker awards, then speaker points,
 * tournaments, most recent award). Names link to the row's team page.
 * Renders nothing when none of the debaters has an award.
 * @module leaderboard/TeamSpeakerAwards
 */

import Link from "next/link"
import { Mic } from "lucide-react"
import type { SpeakerAward, TopSpeaker } from "./profile/topSpeakers"

/** `"2018 Barkley · 2019 NDCA · 2019 TOC 3rd"`: lower speaker places carry their place. */
export function speakerAwardsLine(awards: readonly SpeakerAward[]): string {
  return awards.map((award) => `${award.year} ${award.tournament}${award.rank === 1 ? "" : ` ${award.label.replace(" speaker", "")}`}`).join(" · ")
}

/**
 * @param props.speakers - The team's debaters with awards, in ranking order.
 * @param props.href - The team's page, linked from each debater's name; the names are plain text without it.
 */
export function TeamSpeakerAwards({ speakers, href }: { speakers: readonly TopSpeaker[]; href?: string }) {
  if (!speakers.length) return null
  return (
    <span className="block text-xs text-amber-700 dark:text-amber-400" data-team-speakers>
      {speakers.map((speaker) => (
        <span key={speaker.name} className="flex items-baseline gap-1" data-team-speaker>
          <Mic className="h-3 w-3 shrink-0 translate-y-0.5" aria-hidden />
          <span>
            {href ? (
              <Link href={href} className="font-medium underline-offset-4 hover:underline">
                {speaker.name}
              </Link>
            ) : (
              <span className="font-medium">{speaker.name}</span>
            )}
            : {speakerAwardsLine(speaker.awards)},{" "}
            {speaker.topSpeakerAwards > 0 ? (
              <>
                {speaker.topSpeakerAwards} top speaker{speaker.topSpeakerAwards === 1 ? "" : "s"}
                {speaker.awards.length > speaker.topSpeakerAwards && <> ({speaker.awards.length} awards)</>}
              </>
            ) : (
              <>
                {speaker.awards.length} speaker award{speaker.awards.length === 1 ? "" : "s"}
              </>
            )}
          </span>
        </span>
      ))}
    </span>
  )
}
