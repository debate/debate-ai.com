/**
 * @fileoverview Pre-round intelligence briefing — pure data-composition
 * helpers for idea #12 in TODO.md ("Pre-Round Intelligence Panel") and the
 * "Matchup Prep Dashboard" item under Research Crowdsourcing Organizer
 * Features. Combines the already-built opponent-scouting summary
 * (`debate-data-sync`'s `OpponentTeamProfile`), judge-tendency summary
 * (`debate-speech-writer`'s `JudgeProfile`), a caller-supplied head-to-head
 * history, and free-text team prep notes into one structured, renderable
 * pre-round briefing. This is the first slice only — it doesn't fetch live
 * tournament results, prior pairings, event details, or room assignments
 * from any real data source (those don't exist in this repo today);
 * callers supply whichever pieces of the briefing they already have, and
 * each missing piece renders as an explicit "no data on file" line rather
 * than being silently omitted. It isn't wired into any round-information
 * page UI yet.
 *
 * `buildPreRoundBriefingFromStores` is a second, thin slice that closes the
 * "(c) wiring `buildPreRoundBriefing` to look up a persisted profile through
 * this store" follow-up named under both the "Opponent Team Profiles" and
 * "Judge Profiles" bullets in TODO.md's Research Crowdsourcing Organizer
 * Features list — it resolves `opponentProfile`/`judgeProfile` from the
 * existing `opponentTeamProfiles.ts`/`judgeProfiles.ts` persistence stores by
 * id when the caller doesn't already have the profile object on hand, then
 * delegates to the pure `buildPreRoundBriefing` above.
 */

import type {
  DebateSide,
  OpponentRoundRecord,
  OpponentTeamProfile,
} from "debate-data-sync/src/rankings/opponent-team-profile";
import { buildOpponentScoutingSummary } from "debate-data-sync/src/rankings/opponent-team-profile";
import { getOpponentTeamProfile } from "debate-data-sync/src/state/opponentTeamProfiles";
import type { JudgeProfile } from "debate-speech-writer/src/judge/judge-profile";
import { buildJudgeTendencySummary } from "debate-speech-writer/src/judge/judge-profile";
import { getJudgeProfile } from "debate-speech-writer/src/state/judgeProfiles";

/** Basic details about the upcoming round, as the caller already knows them. */
export interface RoundEventInfo {
  tournamentName: string;
  division: string;
  roundLabel: string;
  side: DebateSide;
  room?: string;
  /** Free-text opponent identifier, shown in the event line (e.g. a team code). */
  opponentLabel?: string;
}

/** Aggregate record derived from `priorMeetings`, this team's history against the opponent. */
export interface PriorMeetingsSummary {
  meetings: number;
  wins: number;
  losses: number;
}

/** One labeled section of the rendered briefing document. */
export interface PreRoundBriefingSection {
  title: string;
  body: string;
}

export interface PreRoundBriefing {
  event: RoundEventInfo;
  priorMeetings: PriorMeetingsSummary;
  sections: PreRoundBriefingSection[];
}

export interface BuildPreRoundBriefingInput {
  event: RoundEventInfo;
  /** This team's own round history, from which head-to-head meetings are derived. */
  ownRecords?: OpponentRoundRecord[];
  /** The `teamId` used in `ownRecords`/`opponentProfile` to identify the upcoming opponent. */
  opponentTeamId?: string;
  opponentProfile?: OpponentTeamProfile;
  judgeProfile?: JudgeProfile;
  /** Free-text prep notes the team has already written for this matchup/topic. */
  teamPrepNotes?: string[];
}

function formatEventLine(event: RoundEventInfo): string {
  const parts = [
    `${event.tournamentName} — ${event.division}, ${event.roundLabel}`,
    `Side: ${event.side}`,
  ];
  if (event.opponentLabel) parts.push(`Opponent: ${event.opponentLabel}`);
  if (event.room) parts.push(`Room: ${event.room}`);
  return parts.join("\n");
}

/**
 * Summarizes prior meetings against a specific opponent from a flat
 * round-record list already filtered to head-to-head rounds. `won` is read
 * from the perspective of whichever team the records belong to — pass in
 * your own team's `OpponentRoundRecord`s (not the opponent's) so `wins`
 * reflects your own record against them.
 */
export function summarizePriorMeetings(records: OpponentRoundRecord[]): PriorMeetingsSummary {
  const meetings = records.length;
  const wins = records.filter((r) => r.won).length;
  return { meetings, wins, losses: meetings - wins };
}

function formatPriorMeetingsSection(summary: PriorMeetingsSummary): string {
  if (summary.meetings === 0) return "No recorded prior meetings against this opponent.";
  return `${summary.meetings} prior meeting(s): ${summary.wins}-${summary.losses} record against this opponent.`;
}

function formatPrepNotesSection(notes: string[]): string {
  if (notes.length === 0) return "No team prep notes on file for this matchup.";
  return notes.map((note) => `- ${note}`).join("\n");
}

/**
 * Composes a `PreRoundBriefing` from whichever inputs the caller has on
 * hand — opponent scouting, judge tendencies, head-to-head history, and
 * prep notes — reporting each missing piece explicitly rather than omitting
 * its section.
 */
export function buildPreRoundBriefing(input: BuildPreRoundBriefingInput): PreRoundBriefing {
  const priorMeetings = summarizePriorMeetings(
    input.opponentTeamId
      ? (input.ownRecords ?? []).filter((r) => r.opponentTeamId === input.opponentTeamId)
      : [],
  );

  const sections: PreRoundBriefingSection[] = [
    { title: "Event", body: formatEventLine(input.event) },
    {
      title: "Opponent scouting",
      body: input.opponentProfile
        ? buildOpponentScoutingSummary(input.opponentProfile)
        : "No opponent scouting data on file.",
    },
    { title: "Prior meetings", body: formatPriorMeetingsSection(priorMeetings) },
    {
      title: "Judge tendencies",
      body: input.judgeProfile
        ? buildJudgeTendencySummary(input.judgeProfile)
        : "No judge tendency data on file.",
    },
    { title: "Team prep notes", body: formatPrepNotesSection(input.teamPrepNotes ?? []) },
  ];

  return { event: input.event, priorMeetings, sections };
}

export interface BuildPreRoundBriefingFromStoresInput extends BuildPreRoundBriefingInput {
  /** The judge's id in the `judgeProfiles.ts` store, used when `judgeProfile` isn't already supplied. */
  judgeId?: string;
}

/**
 * Same as `buildPreRoundBriefing`, but resolves `opponentProfile`/
 * `judgeProfile` from the persisted `opponentTeamProfiles.ts`/
 * `judgeProfiles.ts` stores by `opponentTeamId`/`judgeId` whenever the
 * caller doesn't already supply the profile object directly. An explicitly
 * supplied `opponentProfile`/`judgeProfile` always takes precedence over a
 * store lookup.
 */
export function buildPreRoundBriefingFromStores(
  input: BuildPreRoundBriefingFromStoresInput,
): PreRoundBriefing {
  const opponentProfile =
    input.opponentProfile ??
    (input.opponentTeamId ? getOpponentTeamProfile(input.opponentTeamId) : undefined);
  const judgeProfile = input.judgeProfile ?? (input.judgeId ? getJudgeProfile(input.judgeId) : undefined);

  return buildPreRoundBriefing({ ...input, opponentProfile, judgeProfile });
}

/**
 * Renders a `PreRoundBriefing` as a single markdown-ish text document,
 * suitable for a pre-round briefing panel or a printable/shareable note.
 */
export function buildPreRoundBriefingText(briefing: PreRoundBriefing): string {
  return briefing.sections
    .map((section) => `### ${section.title}\n${section.body}`)
    .join("\n\n");
}
