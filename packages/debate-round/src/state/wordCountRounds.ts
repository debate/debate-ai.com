/**
 * @fileoverview Persistent storage for word-count-mode round results, keyed
 * by `roundId` — the "(c) persisting word-count-mode round results alongside
 * timed rounds" follow-up named under idea #2 ("Word-Count-Only Speech
 * Format") in TODO.md's Product Feature Ideas list. Stores each round's
 * chosen `debate-timer` word-count style and submitted speech text in
 * localStorage, mirroring the existing
 * `aiVersusRounds.ts`/`practiceRounds.ts` persistence convention
 * (SSR/no-storage-safe, corrupt or missing JSON degrades to an empty list
 * rather than throwing). A speech's `WordCountStatus` is derived on read via
 * `getWordCountStatus` rather than stored, so a stored record never goes
 * stale if the format's word limits ever change.
 *
 * `buildWordCountRoundsPanelView` sorts the stored list by `roundId` for a
 * stable panel display order, mirroring the same helper on
 * `coachingSessions.ts`/`opponentPersonaSelections.ts`.
 *
 * @module state/wordCountRounds
 */

import { getWordCountStatus, wordCountStyles, type WordCountStyleKey } from "debate-timer/src/formats/word-count-format";
import { findPresetWordLimit, type WordLimitPreset } from "./wordLimitPresets";

export type WordCountSpeechSubmission = {
  /** Matches a `WordCountSpeech.name` in the round's style, e.g. `"AC"`. */
  name: string;
  speaker: string;
  text: string;
};

export type WordCountRoundRecord = {
  roundId: string;
  styleKey: WordCountStyleKey;
  submittedSpeeches: WordCountSpeechSubmission[];
  /**
   * Stamped automatically by `saveWordCountRound` the first time a
   * `roundId` is saved, and preserved across later updates to that same
   * `roundId` — a debater's word-count trend view (`buildWordCountTrendData`
   * below) sorts on this. Optional so a record persisted before this field
   * existed still parses; such a record is excluded from the trend view
   * rather than sorted arbitrarily.
   */
  createdAt?: number;
  /**
   * Stamped automatically by `saveWordCountRound` on every save — unlike
   * `createdAt`, this is refreshed each time, not just on first save.
   * Drives `resolveWordCountRoundConflict` below, so
   * `hooks/useWordCountRounds.ts`'s account merge can tell which of two
   * devices' copies of the same `roundId` is actually newer instead of just
   * filling gaps. Optional for the same reason as `createdAt`: a record
   * persisted before this field existed still parses, and such a record
   * always loses a conflict to one that does carry a timestamp (see
   * `resolveWordCountRoundConflict`).
   */
  updatedAt?: number;
};

const STORAGE_KEY = "wordCountRounds";

function readAll(): WordCountRoundRecord[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as WordCountRoundRecord[]) : [];
  } catch {
    return [];
  }
}

function writeAll(records: WordCountRoundRecord[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

/** Lists every persisted word-count round. */
export function listWordCountRounds(): WordCountRoundRecord[] {
  return readAll();
}

/** Looks up the persisted state for a round, if any. */
export function getWordCountRound(roundId: string): WordCountRoundRecord | undefined {
  return readAll().find((record) => record.roundId === roundId);
}

/**
 * Saves a round's state, overwriting any existing record for that
 * `roundId`. Stamps `createdAt` with the current time on a round's first
 * save, and preserves that original timestamp across later updates (rather
 * than taking a caller-supplied `createdAt`, so every save site — the
 * standalone form and the live in-round meter alike — gets consistent
 * trend-view dates for free). Also stamps `updatedAt` with the current time
 * on every save, first or otherwise, so cross-device conflict resolution
 * (`resolveWordCountRoundConflict`) can tell which device saved most
 * recently.
 */
export function saveWordCountRound(record: WordCountRoundRecord): void {
  const records = readAll();
  const index = records.findIndex((existing) => existing.roundId === record.roundId);
  const createdAt = index === -1 ? Date.now() : (records[index].createdAt ?? Date.now());
  const stamped: WordCountRoundRecord = { ...record, createdAt, updatedAt: Date.now() };
  if (index === -1) {
    records.push(stamped);
  } else {
    records[index] = stamped;
  }
  writeAll(records);
}

/**
 * Adopts a round record as-is — e.g. one fetched from the account during
 * cross-device sync (`hooks/useWordCountRounds.ts`) — preserving its own
 * `createdAt` rather than stamping a fresh one the way `saveWordCountRound`
 * does for an interactive save. Overwrites any existing local record for
 * the same `roundId`. Preserving the original `createdAt` matters here: a
 * record synced from another device should keep its true save time so the
 * word-count trend view (`buildWordCountTrendData`) sorts it correctly
 * alongside records saved on this device.
 */
export function adoptWordCountRound(record: WordCountRoundRecord): void {
  const records = readAll();
  const index = records.findIndex((existing) => existing.roundId === record.roundId);
  if (index === -1) {
    records.push(record);
  } else {
    records[index] = record;
  }
  writeAll(records);
}

export type WordCountRoundConflictResolution = "local" | "remote" | "none";

/**
 * Decides which of two devices' copies of the same `roundId` is newer, for
 * `hooks/useWordCountRounds.ts`'s account merge — TODO.md idea #2's
 * "resolving a same-`roundId` conflict between two devices instead of only
 * filling gaps" follow-up. Pure and side-effect-free: the caller applies
 * the result (`adoptWordCountRound` for `"remote"`, pushing to the account
 * for `"local"`).
 *
 * A newer `updatedAt` wins. A record with no `updatedAt` (saved before this
 * field existed) always loses to one that has it, since a known save time
 * is more trustworthy than an unknown one. When both are missing, or both
 * are exactly equal, this returns `"none"` — the same conservative
 * gap-filling-only behavior this repo used before conflict resolution
 * existed, rather than guessing.
 */
export function resolveWordCountRoundConflict(
  local: WordCountRoundRecord,
  remote: WordCountRoundRecord,
): WordCountRoundConflictResolution {
  if (remote.updatedAt !== undefined && (local.updatedAt === undefined || remote.updatedAt > local.updatedAt)) {
    return "remote";
  }
  if (local.updatedAt !== undefined && (remote.updatedAt === undefined || local.updatedAt > remote.updatedAt)) {
    return "local";
  }
  return "none";
}

export type WordCountRoundMergePlan = {
  /** Records to adopt locally — new to this device, or the remote copy is newer per `resolveWordCountRoundConflict`. */
  adopt: WordCountRoundRecord[];
  /** Local records to best-effort push to the account — new to the account, or the local copy is newer. */
  pushLocal: WordCountRoundRecord[];
};

/**
 * Pure merge-planning step for `hooks/useWordCountRounds.ts`'s account
 * merge, extracted so it's directly testable without a hook/DOM harness.
 * For each `roundId`, decides whether the remote copy should be adopted
 * locally or the local copy should be (best-effort) pushed to the account,
 * via `resolveWordCountRoundConflict` when a `roundId` exists on both
 * sides. The caller applies both effects; this only decides.
 */
export function planWordCountRoundMerge(
  localRecords: WordCountRoundRecord[],
  remoteRecords: WordCountRoundRecord[],
): WordCountRoundMergePlan {
  const localById = new Map(localRecords.map((record) => [record.roundId, record]));
  const remoteIds = new Set(remoteRecords.map((record) => record.roundId));

  const adopt: WordCountRoundRecord[] = [];
  const pushLocal: WordCountRoundRecord[] = [];

  for (const remote of remoteRecords) {
    const local = localById.get(remote.roundId);
    if (!local) {
      adopt.push(remote);
      continue;
    }
    const resolution = resolveWordCountRoundConflict(local, remote);
    if (resolution === "remote") adopt.push(remote);
    else if (resolution === "local") pushLocal.push(local);
  }
  for (const local of localRecords) {
    if (!remoteIds.has(local.roundId)) pushLocal.push(local);
  }

  return { adopt, pushLocal };
}

/**
 * Renders a short "synced from another device" notice for a dismissible
 * toast, for the `roundId`s a merge just adopted from the account (i.e.
 * `planWordCountRoundMerge`'s `adopt` list) — TODO.md idea #2's "surfacing a
 * 'synced just now from another device' toast when the merge actually
 * adopts a remote copy" follow-up. Returns an empty string for an empty
 * list — callers should only render a banner when this is non-empty.
 */
export function buildWordCountSyncNoticeMessage(adoptedRoundIds: string[]): string {
  if (adoptedRoundIds.length === 0) return "";
  if (adoptedRoundIds.length === 1) return `🔄 Synced round ${adoptedRoundIds[0]} from another device.`;
  return `🔄 Synced ${adoptedRoundIds.length} rounds from another device: ${adoptedRoundIds.join(", ")}.`;
}

/** Deletes a round's persisted state; a no-op if it isn't stored. */
export function deleteWordCountRound(roundId: string): void {
  writeAll(readAll().filter((record) => record.roundId !== roundId));
}

/**
 * Clears every persisted word-count round at once (a "delete all my synced
 * history" bulk action) — TODO.md idea #2's "a bulk 'delete all my synced
 * history' action" follow-up. Returns the `roundId`s that were actually
 * removed, so the caller (`hooks/useWordCountRounds.ts`) knows whether
 * there's anything to also clear from the account sync; an empty array when
 * nothing was stored.
 */
export function clearWordCountRounds(): string[] {
  const removedIds = readAll().map((record) => record.roundId);
  if (removedIds.length > 0) writeAll([]);
  return removedIds;
}

/** Every persisted word-count round, sorted by `roundId` for a stable panel display order. */
export function buildWordCountRoundsPanelView(): WordCountRoundRecord[] {
  return [...readAll()].sort((a, b) => a.roundId.localeCompare(b.roundId));
}

/**
 * Computes each submitted speech's `WordCountStatus` against its round's
 * style, by matching each submission's `name` to the style's `WordCountSpeech`.
 * A submission whose `name` no longer matches any speech in the style is
 * skipped rather than throwing, since a format's speech list could change
 * after a round was recorded. `presets` (TODO.md idea #2's "per-style
 * word-limit preset manager" follow-up) overrides a matching speech's
 * authored limit, same priority order as `resolveSpeechWordLimit`.
 */
export function getWordCountRoundStatuses(
  roundId: string,
  presets: WordLimitPreset[] = [],
): { name: string; speaker: string; status: ReturnType<typeof getWordCountStatus> }[] {
  const record = getWordCountRound(roundId);
  if (!record) return [];
  const style = wordCountStyles[record.styleKey];
  return record.submittedSpeeches
    .map((submission) => {
      const speech = style.speeches.find((candidate) => candidate.name === submission.name);
      if (!speech) return undefined;
      const wordLimit = findPresetWordLimit(presets, submission.name) ?? speech.wordLimit;
      return {
        name: submission.name,
        speaker: submission.speaker,
        status: getWordCountStatus(submission.text, wordLimit),
      };
    })
    .filter((entry): entry is { name: string; speaker: string; status: ReturnType<typeof getWordCountStatus> } => entry !== undefined);
}

export type WordCountTrendPoint = {
  roundId: string;
  name: string;
  speaker: string;
  createdAt: number;
  count: number;
  wordLimit: number;
  overLimit: boolean;
};

/**
 * Flattens every persisted round's submitted speeches into a single
 * chronological list — the "(a) a trend view showing a debater's
 * word-count-vs-limit history across past submissions" follow-up named
 * under idea #2 ("Word-Count-Only Speech Format") in TODO.md's Product
 * Feature Ideas list. Each point recomputes its status the same way
 * `getWordCountRoundStatuses` does (so a stored round never goes stale if a
 * format's limits or a user's presets change later), plus the `wordLimit`
 * actually used and the round's `createdAt`.
 *
 * A record saved before `createdAt` existed is excluded rather than sorted
 * arbitrarily; a submission whose `name` no longer matches any speech in
 * its round's style is skipped, same as `getWordCountRoundStatuses`.
 */
export function buildWordCountTrendData(presets: WordLimitPreset[] = []): WordCountTrendPoint[] {
  return readAll()
    .filter((record): record is WordCountRoundRecord & { createdAt: number } => record.createdAt !== undefined)
    .flatMap((record) => {
      const style = wordCountStyles[record.styleKey];
      return record.submittedSpeeches
        .map((submission): WordCountTrendPoint | undefined => {
          const speech = style.speeches.find((candidate) => candidate.name === submission.name);
          if (!speech) return undefined;
          const wordLimit = findPresetWordLimit(presets, submission.name) ?? speech.wordLimit;
          const status = getWordCountStatus(submission.text, wordLimit);
          return {
            roundId: record.roundId,
            name: submission.name,
            speaker: submission.speaker,
            createdAt: record.createdAt,
            count: status.count,
            wordLimit,
            overLimit: status.overLimit,
          };
        })
        .filter((point): point is WordCountTrendPoint => point !== undefined);
    })
    .sort((a, b) => a.createdAt - b.createdAt);
}
