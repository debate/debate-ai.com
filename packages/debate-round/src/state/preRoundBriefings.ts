/**
 * @fileoverview Persistent storage for `pre-round-briefing.ts`'s
 * `PreRoundBriefing`, keyed by `roundId` — the "(c) persisting a generated
 * briefing per round" follow-up named in idea #12 ("Pre-Round Intelligence
 * Panel") in TODO.md's Product Feature Ideas list. Stores briefings in
 * localStorage, mirroring the existing
 * `judgeParadigmSelections.ts`/`coachingPrograms.ts` persistence convention.
 *
 * @module state/preRoundBriefings
 */

import type { DebateSide } from "debate-data-sync/src/rankings/opponent-team-profile";
import { buildPreRoundBriefingFromStores } from "../round/pre-round-briefing";
import type { PreRoundBriefing } from "../round/pre-round-briefing";

export type PreRoundBriefingRecord = {
  roundId: string;
  briefing: PreRoundBriefing;
};

const STORAGE_KEY = "preRoundBriefings";

function readAll(): PreRoundBriefingRecord[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PreRoundBriefingRecord[]) : [];
  } catch {
    return [];
  }
}

function writeAll(records: PreRoundBriefingRecord[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

/** Lists every persisted pre-round briefing. */
export function listPreRoundBriefings(): PreRoundBriefingRecord[] {
  return readAll();
}

/** Looks up the persisted briefing for a round, if any. */
export function getPreRoundBriefing(roundId: string): PreRoundBriefingRecord | undefined {
  return readAll().find((record) => record.roundId === roundId);
}

/** Saves a round's briefing, overwriting any existing record for that `roundId`. */
export function savePreRoundBriefing(record: PreRoundBriefingRecord): void {
  const records = readAll();
  const index = records.findIndex((existing) => existing.roundId === record.roundId);
  if (index === -1) {
    records.push(record);
  } else {
    records[index] = record;
  }
  writeAll(records);
}

/** Deletes a round's persisted briefing; a no-op if it isn't stored. */
export function deletePreRoundBriefing(roundId: string): void {
  writeAll(readAll().filter((record) => record.roundId !== roundId));
}

/**
 * Every persisted briefing, sorted by `roundId` for a stable display order —
 * the "(b) a briefing panel UI that renders it on a round-information page"
 * follow-up named in idea #12 ("Pre-Round Intelligence Panel") in TODO.md.
 * Used by `panels/PreRoundBriefingsPanel.tsx`.
 */
export function buildPreRoundBriefingsPanelView(): PreRoundBriefingRecord[] {
  return [...listPreRoundBriefings()].sort((a, b) => a.roundId.localeCompare(b.roundId));
}

/** Raw "create briefing" form input, as `panels/PreRoundBriefingsPanel.tsx` collects it. */
export type PreRoundBriefingDraft = {
  roundId: string;
  tournamentName: string;
  division: string;
  roundLabel: string;
  side: DebateSide;
  room?: string;
  opponentLabel?: string;
  /** The `teamId` of an already-persisted Opponent Team Profile to pull scouting data from. */
  opponentTeamId?: string;
  /** The `judgeId` of an already-persisted Judge Profile to pull tendency data from. */
  judgeId?: string;
  teamPrepNotes?: string[];
};

export type PreRoundBriefingDraftResult =
  | { ok: true; record: PreRoundBriefingRecord }
  | { ok: false; error: string };

/**
 * Validates and composes a `PreRoundBriefingRecord` from a "create briefing"
 * form draft — the panel's previously-missing "generate a new briefing for a
 * round" affordance named in `docs/features/pre-round-briefings.md`'s
 * "Known gaps." Resolves an opponent/judge profile from their persisted
 * stores by id via `buildPreRoundBriefingFromStores` rather than introducing
 * new briefing-composition logic. Does not persist the result — call
 * `savePreRoundBriefing(result.record)` once `result.ok` is `true`.
 */
export function buildPreRoundBriefingRecordFromDraft(
  draft: PreRoundBriefingDraft,
): PreRoundBriefingDraftResult {
  const roundId = draft.roundId.trim();
  const tournamentName = draft.tournamentName.trim();
  const division = draft.division.trim();
  const roundLabel = draft.roundLabel.trim();
  if (!roundId || !tournamentName || !division || !roundLabel) {
    return {
      ok: false,
      error: "Round ID, tournament, division, and round label are all required.",
    };
  }

  const room = draft.room?.trim();
  const opponentLabel = draft.opponentLabel?.trim();
  const opponentTeamId = draft.opponentTeamId?.trim();
  const judgeId = draft.judgeId?.trim();

  const briefing = buildPreRoundBriefingFromStores({
    event: {
      tournamentName,
      division,
      roundLabel,
      side: draft.side,
      ...(room && { room }),
      ...(opponentLabel && { opponentLabel }),
    },
    ...(opponentTeamId && { opponentTeamId }),
    ...(judgeId && { judgeId }),
    teamPrepNotes: draft.teamPrepNotes ?? [],
  });

  return { ok: true, record: { roundId, briefing } };
}
