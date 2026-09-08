/**
 * @fileoverview Composes one coaching program's calendar entirely from real,
 * persisted state — the persistence half of idea #13's ("Coaching Programs
 * and Group Challenges") own follow-up in TODO.md: "A calendar/schedule view
 * across a program's drills, sprints, and challenges." Mirrors
 * `coachingProgramRosterAnalytics.ts`'s "compose the pure function directly
 * against the persisted store" convention.
 *
 * @module state/coachingProgramCalendar
 */

import { getCoachingProgram } from "debate-team-collaboration/src/state/coachingPrograms";
import { listGroupChallenges } from "debate-team-collaboration/src/state/groupChallenges";
import { listSprintNotesForTopic } from "debate-team-collaboration/src/state/sprintNotes";
import {
  buildCoachingProgramCalendarEvents,
  type CoachingProgramCalendarEvent,
  type CoachingProgramCalendarExternalEvent,
} from "../lib/coaching-program-calendar";

/**
 * Builds one coaching program's schedule directly from persisted state: its
 * saved config (for the roster), every persisted `GroupChallenge` (narrowed
 * to this program's roster by `buildCoachingProgramCalendarEvents`), and —
 * when `topic` is non-blank — that topic's persisted sprint notes. A blank
 * `topic` still returns the program's challenge-window events; it simply
 * carries no sprint-note events, since a topic sprint's notes are only
 * addressable by topic. `drillReviews` (default `[]`) is passed straight
 * through — see `lib/coaching-program-calendar.ts`'s file doc comment for
 * why this module doesn't resolve them itself. Returns `undefined` if no
 * program is stored under `programId`, mirroring
 * `buildPersistedCoachingProgramRosterAnalytics`'s identical convention.
 */
export function buildPersistedCoachingProgramCalendar(
  programId: string,
  topic: string,
  drillReviews: CoachingProgramCalendarExternalEvent[] = [],
): CoachingProgramCalendarEvent[] | undefined {
  const program = getCoachingProgram(programId);
  if (!program) return undefined;

  const trimmedTopic = topic.trim();
  const sprintNotes = trimmedTopic ? listSprintNotesForTopic(trimmedTopic) : [];
  return buildCoachingProgramCalendarEvents(program.memberIds, listGroupChallenges(), sprintNotes, drillReviews);
}
