/**
 * @fileoverview Persistent storage for this team's own round history —
 * closes the real follow-up (not a form oversight) documented in
 * `docs/features/pre-round-briefings.md`'s "Known gaps" and in TODO.md's
 * Tracker Status "Pre-Round Briefings — add a 'create briefing' form" entry:
 * `round/pre-round-briefing.ts`'s `buildPreRoundBriefingFromStores` already
 * supports a head-to-head `ownRecords`/`opponentTeamId` history, but no
 * persisted store of a team's own round history existed for it to read
 * from, so the "Prior meetings" section always rendered "No recorded prior
 * meetings" even when an opponent profile was picked.
 *
 * Stores `OpponentRoundRecord`s — the same type `opponent-team-profile.ts`
 * already uses for an opponent's round history — logged from this team's
 * own perspective (so `won` reflects whether *this* team won). A team
 * competes in many rounds, so records aren't keyed by a single id the way
 * `opponentTeamProfiles.ts` keys one profile per `teamId`; each logged round
 * gets its own synthetic `id`, mirroring `debate-data-sync`'s
 * `tournamentResults.ts` append-only, caller-assigned-id convention
 * (SSR/no-storage-safe, corrupt or missing JSON degrades to an empty list
 * rather than throwing).
 *
 * @module state/ownRoundHistory
 */

import type { OpponentRoundRecord } from "debate-data-sync/src/rankings/opponent-team-profile";
import { getHeadToHeadRecords } from "debate-data-sync/src/rankings/opponent-team-profile";

/** An `OpponentRoundRecord` as persisted: a unique id, since a team logs many rounds. */
export interface OwnRoundHistoryRecord extends OpponentRoundRecord {
  id: string;
}

const STORAGE_KEY = "ownRoundHistory";

function readAll(): OwnRoundHistoryRecord[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as OwnRoundHistoryRecord[]) : [];
  } catch {
    return [];
  }
}

function writeAll(records: OwnRoundHistoryRecord[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

/** Lists every persisted round this team has logged, in stored order. */
export function listOwnRoundHistory(): OwnRoundHistoryRecord[] {
  return readAll();
}

/** Saves a new logged round, appending it to the persisted history. */
export function saveOwnRoundHistoryRecord(record: OwnRoundHistoryRecord): void {
  const records = readAll();
  records.push(record);
  writeAll(records);
}

/** Deletes a persisted logged round by `id`; a no-op if it isn't stored. */
export function deleteOwnRoundHistoryRecord(id: string): void {
  writeAll(readAll().filter((record) => record.id !== id));
}

/**
 * Every persisted round this team logged against a specific opponent — the
 * head-to-head history `round/pre-round-briefing.ts`'s
 * `buildPreRoundBriefingFromStores` needs for its "Prior meetings" section.
 * Delegates to the existing `getHeadToHeadRecords` filter rather than
 * introducing new head-to-head logic here.
 */
export function getOwnRoundHistoryAgainst(opponentTeamId: string): OwnRoundHistoryRecord[] {
  return getHeadToHeadRecords(readAll(), opponentTeamId) as OwnRoundHistoryRecord[];
}
