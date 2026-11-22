/**
 * @fileoverview Saved verdicts from the AI Judge Decision page's "Judge
 * pasted speeches" section (`panels/SpeechJudgeSection.tsx`).
 *
 * Before this store a verdict lived only in component state: a reload, or
 * judging a second set of speeches, lost it, and nothing reached the
 * account. Each verdict is now kept with the speeches it judged, newest
 * first, under the `"speechJudgeDecisions"` key. That key is a synced
 * tool-record collection (`toolRecordCollections.ts`), so a signed-in
 * user's verdicts are saved to their `saved_tool_records` rows and appear on
 * their other devices; signed out they stay on this device.
 *
 * A verdict is written once and never edited, so the store only appends and
 * deletes. It keeps at most {@link MAX_SPEECH_JUDGE_DECISIONS}; saving past
 * the cap drops the oldest, and those deletes reach the account too.
 *
 * @module state/speechJudgeDecisions
 */

import {
  mirrorToolRecordDelete,
  mirrorToolRecordSave,
} from "@debate-ai/research-evidence/src/account-sync/tool-record-mirror";
import { MAX_TOOL_RECORD_BYTES } from "@debate-ai/research-evidence/src/account-sync/toolRecordCollections";
import type { JudgedSpeech } from "../round/speech-judge-ai";

/** One saved verdict and the speeches it judged. */
export type SpeechJudgeDecisionRecord = {
  /** Generated once when the verdict is saved; the record's id on every device. */
  id: string;
  /** The speeches as they were sent to the judge. */
  speeches: JudgedSpeech[];
  /** The judge's full reply: decision, reason for decision and per-speech critique. */
  decision: string;
  /** The judge that wrote it, as shown on its badge. */
  judgeName: string;
  /** Unix ms. */
  judgedAt: number;
};

/** The `localStorage` key, and the synced collection's key. */
export const SPEECH_JUDGE_DECISIONS_STORAGE_KEY = "speechJudgeDecisions";

/** How many verdicts are kept; the oldest beyond this are dropped on save. */
export const MAX_SPEECH_JUDGE_DECISIONS = 30;

function isJudgedSpeech(value: unknown): value is JudgedSpeech {
  if (typeof value !== "object" || value === null) return false;
  const speech = value as Record<string, unknown>;
  return (
    typeof speech.id === "string" &&
    typeof speech.name === "string" &&
    typeof speech.text === "string" &&
    (speech.side === "aff" || speech.side === "neg")
  );
}

/** Whether `value` is a well-formed saved verdict. Malformed entries (an old or damaged copy) are skipped on read. */
export function isSpeechJudgeDecisionRecord(value: unknown): value is SpeechJudgeDecisionRecord {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    record.id.length > 0 &&
    Array.isArray(record.speeches) &&
    record.speeches.every(isJudgedSpeech) &&
    typeof record.decision === "string" &&
    record.decision.trim().length > 0 &&
    typeof record.judgeName === "string" &&
    typeof record.judgedAt === "number" &&
    Number.isFinite(record.judgedAt)
  );
}

function readAll(): SpeechJudgeDecisionRecord[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(SPEECH_JUDGE_DECISIONS_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isSpeechJudgeDecisionRecord) : [];
  } catch {
    return [];
  }
}

function writeAll(records: SpeechJudgeDecisionRecord[]): boolean {
  if (typeof localStorage === "undefined") return false;
  try {
    localStorage.setItem(SPEECH_JUDGE_DECISIONS_STORAGE_KEY, JSON.stringify(records));
    return true;
  } catch {
    // Storage full or unavailable: the verdict stays on screen but isn't kept.
    return false;
  }
}

function generateSpeechJudgeDecisionId(): string {
  return `speech-judge-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Every saved verdict, newest first. */
export function listSpeechJudgeDecisions(): SpeechJudgeDecisionRecord[] {
  return readAll().sort((a, b) => b.judgedAt - a.judgedAt);
}

/**
 * Whether a verdict is small enough for one account row
 * (`MAX_TOOL_RECORD_BYTES`). A larger one is still kept on this device, and
 * the section says it wasn't saved to the account.
 */
export function fitsInAccountRow(record: SpeechJudgeDecisionRecord): boolean {
  return new TextEncoder().encode(JSON.stringify(record)).length <= MAX_TOOL_RECORD_BYTES;
}

export type SaveSpeechJudgeDecisionResult = {
  /** The saved record, or `null` when this browser couldn't store it. */
  record: SpeechJudgeDecisionRecord | null;
  /** Ids dropped to stay within {@link MAX_SPEECH_JUDGE_DECISIONS}, oldest first. */
  trimmedIds: string[];
};

/**
 * Saves a new verdict with a fresh id, then drops the oldest beyond the cap.
 * Both the save and any drops are mirrored to the account when signed in.
 */
export function saveSpeechJudgeDecision(
  input: Omit<SpeechJudgeDecisionRecord, "id">,
): SaveSpeechJudgeDecisionResult {
  const record: SpeechJudgeDecisionRecord = {
    ...input,
    speeches: input.speeches.map((speech) => ({ ...speech })),
    id: generateSpeechJudgeDecisionId(),
  };
  const newestFirst = [record, ...listSpeechJudgeDecisions()];
  const kept = newestFirst.slice(0, MAX_SPEECH_JUDGE_DECISIONS);
  const trimmedIds = newestFirst
    .slice(MAX_SPEECH_JUDGE_DECISIONS)
    .map((existing) => existing.id)
    .reverse();

  if (!writeAll(kept)) return { record: null, trimmedIds: [] };

  if (fitsInAccountRow(record)) mirrorToolRecordSave(SPEECH_JUDGE_DECISIONS_STORAGE_KEY, record);
  for (const id of trimmedIds) mirrorToolRecordDelete(SPEECH_JUDGE_DECISIONS_STORAGE_KEY, id);
  return { record, trimmedIds };
}

/** Deletes one saved verdict here and on the account; a no-op for an unknown id. */
export function deleteSpeechJudgeDecision(id: string): void {
  const all = readAll();
  const remaining = all.filter((record) => record.id !== id);
  if (remaining.length === all.length) return;
  writeAll(remaining);
  mirrorToolRecordDelete(SPEECH_JUDGE_DECISIONS_STORAGE_KEY, id);
}

/** Whether a `storage` event may have changed the saved verdicts (another tab, or an account merge). */
export function isSpeechJudgeDecisionsStorageEvent(event: { key: string | null }): boolean {
  return event.key === null || event.key === SPEECH_JUDGE_DECISIONS_STORAGE_KEY;
}

/** Longest preview line shown for a saved verdict. */
export const SPEECH_JUDGE_DECISION_PREVIEW_CHARS = 140;

/**
 * A one-line preview of a verdict for the saved list: its first non-blank
 * line with Markdown markers stripped, clipped to
 * {@link SPEECH_JUDGE_DECISION_PREVIEW_CHARS}.
 */
export function previewSpeechJudgeDecision(decision: string): string {
  const firstLine =
    decision
      .split("\n")
      .map((line) => line.replace(/^[#>*\-\s]+/, "").replace(/\*\*/g, "").trim())
      .find((line) => line.length > 0) ?? "";
  if (firstLine.length <= SPEECH_JUDGE_DECISION_PREVIEW_CHARS) return firstLine;
  return `${firstLine.slice(0, SPEECH_JUDGE_DECISION_PREVIEW_CHARS - 1).trimEnd()}…`;
}

/** How many of the judged speeches had text, e.g. for "6 speeches". */
export function countJudgedSpeeches(record: Pick<SpeechJudgeDecisionRecord, "speeches">): number {
  return record.speeches.filter((speech) => speech.text.trim().length > 0).length;
}
