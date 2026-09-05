/**
 * @fileoverview Pure composition slice for idea #13's ("Coaching Programs
 * and Group Challenges") own follow-up in TODO.md: "A calendar/schedule view
 * across a program's drills, sprints, and challenges."
 *
 * A coach today can see a program's group-challenge standings (Group
 * Challenges panel / `coaching-program-roster-analytics.ts`'s digest) and a
 * topic sprint's notes (Team Collaboration Mode's `TopicSprintPanel`), but
 * nothing lays their actual dates out on one shared schedule. This module
 * turns a program roster's own `GroupChallenge` windows (`startsAt`/
 * `endsAt`) and a chosen topic's `SprintNote`s (`createdAt`) into one
 * chronological list of dated events — reusing `debate-community`'s own
 * `getUtcDayKey` (already the day-bucketing convention `daily-best-card.ts`'s
 * calendar view and this package's own roster-analytics digest use) rather
 * than introducing a second date-bucketing rule.
 *
 * Per-drill scheduled review reminders (`debate-practice-rounds`'
 * `state/drillSets.ts#scheduledReviewAt`) are deliberately left out of this
 * first slice: that package depends on this one (`debate-community`, for
 * Progress Unlocks tiers), so composing drill dates in the other direction
 * here would be circular. See `docs/features/coaching-programs.md`'s "Known
 * gaps" for the follow-up this leaves open.
 *
 * This is the first slice only — it works entirely off caller-supplied
 * inputs; it doesn't read persisted state or render a UI. See
 * `state/coachingProgramCalendar.ts` for the persisted-store composition and
 * `panels/CoachingProgramRosterAnalyticsPanel.tsx` for the UI.
 *
 * @module lib/coaching-program-calendar
 */

import { getUtcDayKey } from "debate-research-evidence/src/lib/daily-best-card";
import type { GroupChallenge } from "debate-team-collaboration/src/lib/group-challenges";
import type { SprintNote } from "debate-team-collaboration/src/lib/team-collaboration-mode";

/** How a `CoachingProgramCalendarEvent` came about. */
export type CoachingProgramCalendarEventKind = "challenge-start" | "challenge-end" | "sprint-note";

/** One dated event on a coaching program's schedule. */
export interface CoachingProgramCalendarEvent {
  /** The UTC calendar day (`YYYY-MM-DD`) this event falls on. */
  dayKey: string;
  kind: CoachingProgramCalendarEventKind;
  label: string;
  /** A note's text preview — absent for challenge events. */
  detail?: string;
}

/** One calendar day's events, for a day-grouped rendering. */
export interface CoachingProgramCalendarDay {
  dayKey: string;
  events: CoachingProgramCalendarEvent[];
}

/** How much of a sprint note's text to keep in a calendar event's `detail` — mirrors `team-collaboration-mode.ts`'s `ANNOUNCEMENT_TEXT_PREVIEW_LENGTH`. */
const NOTE_DETAIL_PREVIEW_LENGTH = 80;

/** Whether a challenge's own roster shares at least one member with the program roster — the same "any overlap counts" rule `buildCoachingProgramChallengeDigest` already applies to completed-challenge events. */
function isRosterScopedChallenge(memberIds: string[], challenge: GroupChallenge): boolean {
  const memberSet = new Set(memberIds);
  return challenge.memberIds.some((id) => memberSet.has(id));
}

function truncateNoteText(text: string): string {
  return text.length > NOTE_DETAIL_PREVIEW_LENGTH
    ? `${text.slice(0, NOTE_DETAIL_PREVIEW_LENGTH).trimEnd()}…`
    : text;
}

/**
 * Builds a coaching program's schedule: a "starts"/"ends" event for every
 * roster-scoped challenge (`challenges` narrowed to ones whose own
 * `memberIds` overlaps the program roster — challenges outside this
 * program's squad are excluded, matching `buildCoachingProgramChallengeDigest`'s
 * scoping rule), plus one event per supplied sprint note. Sorted
 * chronologically (day ascending), then by kind, then by label, for a
 * stable, deterministic order when several events land on the same day.
 *
 * `sprintNotes` is caller-supplied rather than looked up by topic here — a
 * topic sprint isn't itself dated the way a challenge window is, so the
 * caller (`state/coachingProgramCalendar.ts`) resolves which topic's notes
 * to include.
 */
export function buildCoachingProgramCalendarEvents(
  memberIds: string[],
  challenges: GroupChallenge[],
  sprintNotes: SprintNote[],
): CoachingProgramCalendarEvent[] {
  const events: CoachingProgramCalendarEvent[] = [];

  for (const challenge of challenges) {
    if (!isRosterScopedChallenge(memberIds, challenge)) continue;
    events.push({
      dayKey: getUtcDayKey(challenge.startsAt),
      kind: "challenge-start",
      label: `"${challenge.title}" challenge starts`,
    });
    events.push({
      dayKey: getUtcDayKey(challenge.endsAt),
      kind: "challenge-end",
      label: `"${challenge.title}" challenge ends`,
    });
  }

  for (const note of sprintNotes) {
    events.push({
      dayKey: getUtcDayKey(note.createdAt),
      kind: "sprint-note",
      label: `${note.authorId} logged a "${note.topic}" note`,
      detail: truncateNoteText(note.text),
    });
  }

  return events.sort(
    (a, b) => a.dayKey.localeCompare(b.dayKey) || a.kind.localeCompare(b.kind) || a.label.localeCompare(b.label),
  );
}

/**
 * Groups an already-built (or any) event list into one entry per distinct
 * `dayKey`, sorted chronologically — what
 * `panels/CoachingProgramRosterAnalyticsPanel.tsx`'s calendar section
 * actually renders (a heading per day rather than a flat list repeating the
 * date on every row).
 */
export function groupCoachingProgramCalendarEventsByDay(
  events: CoachingProgramCalendarEvent[],
): CoachingProgramCalendarDay[] {
  const byDay = new Map<string, CoachingProgramCalendarEvent[]>();
  for (const event of events) {
    const bucket = byDay.get(event.dayKey);
    if (bucket) bucket.push(event);
    else byDay.set(event.dayKey, [event]);
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dayKey, dayEvents]) => ({ dayKey, events: dayEvents }));
}
