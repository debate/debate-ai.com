/**
 * @fileoverview Persistent storage for manually-entered round pairing/room
 * assignments, keyed by `roundId` — idea #12 ("Pre-Round Intelligence
 * Panel")'s "A manual pairing/room-assignment entry form as the practical
 * stand-in" follow-up in TODO.md's Product Feature Ideas list, tracked
 * alongside the "Confirmed blocker: Tabroom results/pairings/ballot data"
 * note (Tabroom's `results`/`postings` pages 302-redirect to a login wall
 * for automated requests, so pairings have to be hand-entered). Stores
 * pairings in localStorage, mirroring `preRoundBriefings.ts`'s exact
 * upsert-by-`roundId` persistence convention (a pairing is looked up/edited
 * by round, not appended to a history log the way judge decisions or
 * counsel-panel assessments are).
 *
 * A saved pairing's `tournamentName`/`division`/`roundLabel`/`side`/`room`/
 * `opponentLabel` fields deliberately mirror `round/pre-round-briefing.ts`'s
 * `RoundEventInfo` shape (plus a free-text `judgeLabel`, since a pairing
 * sheet lists a judge by name rather than by an already-persisted
 * `JudgeProfile` id) so `panels/PreRoundBriefingsPanel.tsx` can prefill its
 * "create briefing" form directly from a saved pairing's fields.
 *
 * @module state/roundPairings
 */

import type { DebateSide } from "debate-data-sync/src/rankings/opponent-team-profile";

export type RoundPairingRecord = {
  roundId: string;
  tournamentName: string;
  division: string;
  roundLabel: string;
  side: DebateSide;
  room?: string;
  opponentLabel?: string;
  /** Free-text judge name, as a pairing sheet lists it — not an already-persisted `JudgeProfile` id. */
  judgeLabel?: string;
  /** Epoch-ms timestamp of when this record was last saved, stamped by `saveRoundPairing` itself. */
  updatedAt?: number;
};

const STORAGE_KEY = "roundPairings";

function readAll(): RoundPairingRecord[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as RoundPairingRecord[]) : [];
  } catch {
    return [];
  }
}

function writeAll(records: RoundPairingRecord[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

/** Lists every persisted round pairing. */
export function listRoundPairings(): RoundPairingRecord[] {
  return readAll();
}

/** Looks up the persisted pairing for a round, if any. */
export function getRoundPairing(roundId: string): RoundPairingRecord | undefined {
  return readAll().find((record) => record.roundId === roundId);
}

/**
 * Saves a round's pairing, overwriting any existing record for that
 * `roundId`. Stamps `updatedAt` with `now` (defaulting to `Date.now()`),
 * overwriting whatever `record.updatedAt` was passed in — mirrors
 * `preRoundBriefings.ts#savePreRoundBriefing`'s exact stamping rule.
 */
export function saveRoundPairing(record: RoundPairingRecord, now: number = Date.now()): void {
  const stamped: RoundPairingRecord = { ...record, updatedAt: now };
  const records = readAll();
  const index = records.findIndex((existing) => existing.roundId === stamped.roundId);
  if (index === -1) {
    records.push(stamped);
  } else {
    records[index] = stamped;
  }
  writeAll(records);
}

/**
 * Adopts a round pairing as-is — e.g. one fetched from the account during
 * cross-device sync (`hooks/useRoundPairings.ts`) — preserving its own
 * `updatedAt` rather than stamping a fresh one the way `saveRoundPairing`
 * does for an interactive save. Overwrites any existing local record for the
 * same `roundId`.
 */
export function adoptRoundPairing(record: RoundPairingRecord): void {
  const records = readAll();
  const index = records.findIndex((existing) => existing.roundId === record.roundId);
  if (index === -1) {
    records.push(record);
  } else {
    records[index] = record;
  }
  writeAll(records);
}

/** Deletes a round's persisted pairing; a no-op if it isn't stored. */
export function deleteRoundPairing(roundId: string): void {
  writeAll(readAll().filter((record) => record.roundId !== roundId));
}

/**
 * Every persisted pairing, sorted by `roundId` for a stable panel display
 * order — mirrors `preRoundBriefings.ts#buildPreRoundBriefingsPanelView`.
 * Used by `panels/PreRoundBriefingsPanel.tsx`.
 */
export function buildRoundPairingsPanelView(): RoundPairingRecord[] {
  return [...listRoundPairings()].sort((a, b) => a.roundId.localeCompare(b.roundId));
}

/** Raw "log a pairing" form input, as `panels/PreRoundBriefingsPanel.tsx` collects it. */
export type RoundPairingDraft = {
  roundId: string;
  tournamentName: string;
  division: string;
  roundLabel: string;
  side: DebateSide;
  room?: string;
  opponentLabel?: string;
  judgeLabel?: string;
};

export type RoundPairingDraftResult =
  | { ok: true; record: RoundPairingRecord }
  | { ok: false; error: string };

/**
 * Validates and composes a `RoundPairingRecord` from a "log a pairing" form
 * draft, mirroring `preRoundBriefings.ts#buildPreRoundBriefingRecordFromDraft`'s
 * required-field check exactly (round id, tournament, division, and round
 * label). Does not persist the result — call `saveRoundPairing(result.record)`
 * once `result.ok` is `true`.
 */
export function buildRoundPairingRecordFromDraft(draft: RoundPairingDraft): RoundPairingDraftResult {
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
  const judgeLabel = draft.judgeLabel?.trim();

  return {
    ok: true,
    record: {
      roundId,
      tournamentName,
      division,
      roundLabel,
      side: draft.side,
      ...(room && { room }),
      ...(opponentLabel && { opponentLabel }),
      ...(judgeLabel && { judgeLabel }),
    },
  };
}
