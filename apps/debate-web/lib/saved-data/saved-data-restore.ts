/**
 * @fileoverview Restore from a "Saved to your account" export file.
 *
 * Reads either file Settings → General hands out — one item's **Export**
 * (`exportOwnSavedItem`) or **Export all as JSON** (`exportAllOwnSavedData`) —
 * and writes its documents, flows, rounds, practice debates vs AI, word-count
 * rounds, drill sets, judge decisions and sent speeches back as rows owned by
 * the caller. It only ever adds rows: an item that is still in the account is
 * skipped, never overwritten, so restoring the same file twice is harmless.
 *
 * - Flows and rounds come back under their original local id (`clientId`),
 *   so `/debate?flowId=` / `?roundId=` links and a round's `flowIds` keep
 *   pointing at them. They pass the same validators and size caps as
 *   `PUT /api/flows/[clientId]` and `PUT /api/rounds/[clientId]`.
 * - Documents get a fresh row id (ids are global), at the top level of
 *   My Files, unless a document with the exported id is still the caller's.
 * - Word-count rounds and drill sets come back under their own `roundId`,
 *   through the same validators and size caps as
 *   `PUT /api/word-count-rounds/[roundId]` and `PUT /api/drill-sets/[roundId]`.
 *   Insert-only is safe against their tools' device merge
 *   (`planWordCountRoundMerge` / `planDrillSetMerge`): a round only the
 *   account holds is adopted on the next page load, and one a device still
 *   holds is skipped here as already in the account.
 * - Practice debates vs AI get a fresh row id (ids are global), after their
 *   `data` passes `isValidDebateVsBotRecord`. One is skipped as already in the
 *   account when the exported id is still the caller's, or when the caller has
 *   a debate with the same topic, opponent and start second — which is what a
 *   second restore of the same file finds. Owner and email are the caller's,
 *   `result` is re-derived from the outcome exactly as `setOutcome` does, and
 *   no score, badge or streak is awarded: the round already counted once.
 * - Judge decisions and sent speeches come back under their own generated
 *   `id` (`clientId`), after `isValidJudgeDecisionRecord` /
 *   `isValidSpeechSendLogEntry` and the same size caps as
 *   `PUT /api/judge-decisions/[decisionId]` and
 *   `PUT /api/speech-send-log/[entryId]`. One whose id the caller already has
 *   is skipped. Their tools adopt entries only the account holds on the next
 *   page load, as word-count rounds do.
 *
 * @module lib/saved-data/saved-data-restore
 */

import { and, eq, or } from "drizzle-orm";
import { deriveFlowLabel, deriveRoundLabel, isValidFlow, isValidRound, MAX_SAVED_FLOW_BYTES, MAX_SAVED_ROUND_BYTES } from "@debate-ai/round";
import {
  isValidDrillSetRecord,
  isValidJudgeDecisionRecord,
  isValidWordCountRoundRecord,
  MAX_SAVED_DRILL_SET_BYTES,
  MAX_SAVED_JUDGE_DECISION_BYTES,
  MAX_SAVED_WORD_COUNT_ROUND_BYTES,
} from "@debate-ai/practice-rounds";
import { isValidSpeechSendLogEntry, MAX_SAVED_SPEECH_SEND_LOG_BYTES } from "@debate-ai/editor/engine";
import { isValidDebateVsBotRecord, MAX_SAVED_PRACTICE_DEBATE_BYTES, resolveResultStatus } from "@debate-ai/practice-vs-ai/backend";
import { normalizeFormat } from "@debate-ai/reason-docs/lib/debate-editor/format";
import type { getDBFromContext } from "@/lib/database/context";
import { ensureDocumentColumns, fileStatColumns } from "@/lib/file-stats/columns";
import { documents, practiceVsAiDebates, savedDrillSets, savedFlows, savedJudgeDecisions, savedRounds, savedSpeechSendLog, savedWordCountRounds } from "../database/schema";
import { ITEM_KINDS, type ItemKind } from "./saved-data-items";

type AccountDB = Awaited<ReturnType<typeof getDBFromContext>>;

/** Largest export file the restore route reads, in characters of JSON. */
export const MAX_RESTORE_FILE_CHARS = 20_000_000;

/** Most items one restore writes; a bulk export holds at most 1000 per kind. */
export const MAX_RESTORE_ITEMS = 4000;

/** Largest document `content` a restore writes, in characters. */
export const MAX_RESTORE_DOC_CHARS = 5_000_000;

/** One item read out of an export file, before validation. */
export interface RestoreEntry {
  kind: ItemKind;
  /** The exported document: `{ kind, id, title, createdAt, updatedAt, ... }`. */
  doc: Record<string, unknown>;
}

export type ParsedRestoreFile = { ok: true; entries: RestoreEntry[] } | { ok: false; error: string };

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const isKind = (value: unknown): value is ItemKind => typeof value === "string" && (ITEM_KINDS as readonly string[]).includes(value);

/**
 * Splits a parsed export file into items. Accepts a single-item export
 * (`{ kind, id, ... }`) or a bulk archive (`{ exportedAt, docs: [...], ... }`);
 * anything else is an error the user can act on.
 */
export function parseRestoreFile(value: unknown): ParsedRestoreFile {
  if (!isRecord(value)) return { ok: false, error: "This isn't a Debate AI export file." };
  if (isKind(value.kind)) return { ok: true, entries: [{ kind: value.kind, doc: value }] };
  if (typeof value.exportedAt !== "string") return { ok: false, error: "This isn't a Debate AI export file." };
  const entries: RestoreEntry[] = [];
  for (const kind of ITEM_KINDS) {
    const list = value[kind];
    if (list === undefined) continue;
    if (!Array.isArray(list)) return { ok: false, error: `The export's "${kind}" list is malformed.` };
    for (const doc of list) if (isRecord(doc)) entries.push({ kind, doc });
  }
  if (entries.length === 0) return { ok: false, error: "This export file has nothing to restore." };
  if (entries.length > MAX_RESTORE_ITEMS) return { ok: false, error: `This export has more than ${MAX_RESTORE_ITEMS} items; restore it in smaller files.` };
  return { ok: true, entries };
}

export interface RestoreSkip {
  kind: ItemKind;
  title: string;
  reason: string;
}

export interface RestoreReport {
  /** Rows written, per kind. */
  restored: Record<ItemKind, number>;
  /** Items left alone, with why — already in the account, invalid, too large, unsupported. */
  skipped: RestoreSkip[];
}

const titleOf = (doc: Record<string, unknown>, fallback: string) => (typeof doc.title === "string" && doc.title.trim() ? doc.title.trim() : fallback);

/** The export's `createdAt`, or `now` when it is missing or not a date. */
const createdAtOf = (doc: Record<string, unknown>, now: Date) => {
  const at = typeof doc.createdAt === "string" ? new Date(doc.createdAt) : null;
  return at && !Number.isNaN(at.getTime()) && at.getTime() > 0 ? at : now;
};

type Outcome = { restored: true } | { restored: false; reason: string };

async function restoreFlow(db: AccountDB, userId: string, doc: Record<string, unknown>, now: Date): Promise<Outcome> {
  const flow = doc.data;
  if (!isValidFlow(flow)) return { restored: false, reason: "Not a valid flow." };
  const data = JSON.stringify(flow);
  if (data.length > MAX_SAVED_FLOW_BYTES) return { restored: false, reason: "Too large to save to your account." };
  const [existing] = await db.select({ id: savedFlows.id }).from(savedFlows).where(and(eq(savedFlows.userId, userId), eq(savedFlows.clientId, flow.id))).limit(1);
  if (existing) return { restored: false, reason: "Already in your account." };
  await db.insert(savedFlows).values({ userId, clientId: flow.id, label: deriveFlowLabel(flow), data, createdAt: createdAtOf(doc, now), updatedAt: now });
  return { restored: true };
}

async function restoreRound(db: AccountDB, userId: string, doc: Record<string, unknown>, now: Date): Promise<Outcome> {
  const round = doc.data;
  if (!isValidRound(round)) return { restored: false, reason: "Not a valid round." };
  const data = JSON.stringify(round);
  if (data.length > MAX_SAVED_ROUND_BYTES) return { restored: false, reason: "Too large to save to your account." };
  const [existing] = await db.select({ id: savedRounds.id }).from(savedRounds).where(and(eq(savedRounds.userId, userId), eq(savedRounds.clientId, round.id))).limit(1);
  if (existing) return { restored: false, reason: "Already in your account." };
  await db.insert(savedRounds).values({ userId, clientId: round.id, label: deriveRoundLabel(round), data, createdAt: createdAtOf(doc, now), updatedAt: now });
  return { restored: true };
}

async function restoreWordCountRound(db: AccountDB, userId: string, doc: Record<string, unknown>, now: Date): Promise<Outcome> {
  const record = doc.data;
  if (!isValidWordCountRoundRecord(record)) return { restored: false, reason: "Not a valid word-count round." };
  const data = JSON.stringify(record);
  if (data.length > MAX_SAVED_WORD_COUNT_ROUND_BYTES) return { restored: false, reason: "Too large to save to your account." };
  const [existing] = await db
    .select({ id: savedWordCountRounds.id })
    .from(savedWordCountRounds)
    .where(and(eq(savedWordCountRounds.userId, userId), eq(savedWordCountRounds.clientId, record.roundId)))
    .limit(1);
  if (existing) return { restored: false, reason: "Already in your account." };
  await db.insert(savedWordCountRounds).values({ userId, clientId: record.roundId, data, createdAt: createdAtOf(doc, now), updatedAt: now });
  return { restored: true };
}

async function restoreDrillSet(db: AccountDB, userId: string, doc: Record<string, unknown>, now: Date): Promise<Outcome> {
  const record = doc.data;
  if (!isValidDrillSetRecord(record)) return { restored: false, reason: "Not a valid drill set." };
  const data = JSON.stringify(record);
  if (data.length > MAX_SAVED_DRILL_SET_BYTES) return { restored: false, reason: "Too large to save to your account." };
  const [existing] = await db
    .select({ id: savedDrillSets.id })
    .from(savedDrillSets)
    .where(and(eq(savedDrillSets.userId, userId), eq(savedDrillSets.clientId, record.roundId)))
    .limit(1);
  if (existing) return { restored: false, reason: "Already in your account." };
  await db.insert(savedDrillSets).values({ userId, clientId: record.roundId, data, createdAt: createdAtOf(doc, now), updatedAt: now });
  return { restored: true };
}

async function restoreJudgeDecision(db: AccountDB, userId: string, doc: Record<string, unknown>, now: Date): Promise<Outcome> {
  const record = doc.data;
  if (!isValidJudgeDecisionRecord(record)) return { restored: false, reason: "Not a valid judge decision." };
  const data = JSON.stringify(record);
  if (data.length > MAX_SAVED_JUDGE_DECISION_BYTES) return { restored: false, reason: "Too large to save to your account." };
  const [existing] = await db
    .select({ id: savedJudgeDecisions.id })
    .from(savedJudgeDecisions)
    .where(and(eq(savedJudgeDecisions.userId, userId), eq(savedJudgeDecisions.clientId, record.id)))
    .limit(1);
  if (existing) return { restored: false, reason: "Already in your account." };
  await db.insert(savedJudgeDecisions).values({ userId, clientId: record.id, roundId: record.roundId, data, createdAt: createdAtOf(doc, now), updatedAt: now });
  return { restored: true };
}

async function restoreSpeech(db: AccountDB, userId: string, doc: Record<string, unknown>, now: Date): Promise<Outcome> {
  const entry = doc.data;
  if (!isValidSpeechSendLogEntry(entry)) return { restored: false, reason: "Not a valid sent speech." };
  const data = JSON.stringify(entry);
  if (data.length > MAX_SAVED_SPEECH_SEND_LOG_BYTES) return { restored: false, reason: "Too large to save to your account." };
  const [existing] = await db
    .select({ id: savedSpeechSendLog.id })
    .from(savedSpeechSendLog)
    .where(and(eq(savedSpeechSendLog.userId, userId), eq(savedSpeechSendLog.clientId, entry.id)))
    .limit(1);
  if (existing) return { restored: false, reason: "Already in your account." };
  await db.insert(savedSpeechSendLog).values({ userId, clientId: entry.id, data, createdAt: createdAtOf(doc, now), updatedAt: now });
  return { restored: true };
}

async function restorePracticeRound(db: AccountDB, userId: string, email: string, doc: Record<string, unknown>, now: Date): Promise<Outcome> {
  const record = doc.data;
  if (!isValidDebateVsBotRecord(record)) return { restored: false, reason: "Not a valid practice debate." };
  const outcome = record.outcome ?? "";
  const stored = { ...record, email, outcome: outcome || undefined };
  const data = JSON.stringify(stored);
  if (data.length > MAX_SAVED_PRACTICE_DEBATE_BYTES) return { restored: false, reason: "Too large to save to your account." };
  const startedAt = new Date(record.createdAt * 1000);
  const mine = eq(practiceVsAiDebates.userId, userId);
  const sameId = typeof doc.id === "number" && Number.isInteger(doc.id) ? and(mine, eq(practiceVsAiDebates.id, doc.id)) : undefined;
  const sameRound = and(mine, eq(practiceVsAiDebates.topic, record.topic), eq(practiceVsAiDebates.botName, record.botName), eq(practiceVsAiDebates.createdAt, startedAt));
  const [existing] = await db
    .select({ id: practiceVsAiDebates.id })
    .from(practiceVsAiDebates)
    .where(sameId ? or(sameId, sameRound) : sameRound)
    .limit(1);
  if (existing) return { restored: false, reason: "Already in your account." };
  await db.insert(practiceVsAiDebates).values({
    userId,
    email,
    botName: record.botName,
    topic: record.topic,
    outcome,
    // Same derivation as the store's `setOutcome`, so a forged `result` can't stick.
    result: !outcome ? "pending" : outcome === "User conceded" ? "loss" : resolveResultStatus(outcome),
    data,
    createdAt: startedAt,
    updatedAt: now,
  });
  return { restored: true };
}

async function restoreJudgeDecision(db: AccountDB, userId: string, doc: Record<string, unknown>, now: Date): Promise<Outcome> {
  const record = doc.data;
  if (!isValidJudgeDecisionRecord(record)) return { restored: false, reason: "Not a valid judge decision." };
  const data = JSON.stringify(record);
  if (data.length > MAX_SAVED_JUDGE_DECISION_BYTES) return { restored: false, reason: "Too large to save to your account." };
  const [existing] = await db
    .select({ id: savedJudgeDecisions.id })
    .from(savedJudgeDecisions)
    .where(and(eq(savedJudgeDecisions.userId, userId), eq(savedJudgeDecisions.clientId, record.id)))
    .limit(1);
  if (existing) return { restored: false, reason: "Already in your account." };
  await db.insert(savedJudgeDecisions).values({ userId, clientId: record.id, roundId: record.roundId, data, createdAt: createdAtOf(doc, now), updatedAt: now });
  return { restored: true };
}

async function restoreSpeechSend(db: AccountDB, userId: string, doc: Record<string, unknown>, now: Date): Promise<Outcome> {
  const entry = doc.data;
  if (!isValidSpeechSendLogEntry(entry)) return { restored: false, reason: "Not a valid sent speech." };
  const data = JSON.stringify(entry);
  if (data.length > MAX_SAVED_SPEECH_SEND_LOG_BYTES) return { restored: false, reason: "Too large to save to your account." };
  const [existing] = await db
    .select({ id: savedSpeechSendLog.id })
    .from(savedSpeechSendLog)
    .where(and(eq(savedSpeechSendLog.userId, userId), eq(savedSpeechSendLog.clientId, entry.id)))
    .limit(1);
  if (existing) return { restored: false, reason: "Already in your account." };
  await db.insert(savedSpeechSendLog).values({ userId, clientId: entry.id, data, createdAt: createdAtOf(doc, now), updatedAt: now });
  return { restored: true };
}

async function restoreDoc(db: AccountDB, userId: string, doc: Record<string, unknown>, now: Date, author: string | null): Promise<Outcome> {
  if (typeof doc.content !== "string") return { restored: false, reason: "Not a valid document." };
  if (doc.content.length > MAX_RESTORE_DOC_CHARS) return { restored: false, reason: "Too large to save to your account." };
  if (typeof doc.id === "number" && Number.isInteger(doc.id)) {
    const [existing] = await db
      .select({ id: documents.id })
      .from(documents)
      .where(and(eq(documents.id, doc.id), eq(documents.userId, userId)))
      .limit(1);
    if (existing) return { restored: false, reason: "Already in your account." };
  }
  // Narrowed, never trusted: `format` decides whether a reader gunzips the column.
  const format = normalizeFormat(doc.format);
  await db.insert(documents).values({
    title: titleOf(doc, "Untitled").slice(0, 500),
    content: doc.content,
    format,
    userId,
    parentId: null,
    isFolder: false,
    author,
    createdAt: createdAtOf(doc, now),
    updatedAt: now,
    ...(await fileStatColumns(doc.content, format)),
  });
  return { restored: true };
}

const FALLBACK_TITLES: Record<ItemKind, string> = {
  docs: "Untitled",
  flows: "Untitled flow",
  rounds: "Untitled round",
  practiceRounds: "Practice debate",
  wordCountRounds: "Word-count round",
  drills: "Drill set",
  judgeDecisions: "Judge decision",
  speeches: "Sent speech",
};

/**
 * Writes each entry back as the caller's own row, one at a time, and reports
 * what was restored and what was skipped. Never updates or deletes a row.
 */
export async function restoreOwnSavedData(
  db: AccountDB,
  userId: string,
  entries: readonly RestoreEntry[],
  { now = new Date(), author = null, email = "" }: { now?: Date; author?: string | null; email?: string } = {},
): Promise<RestoreReport> {
  const restored: Record<ItemKind, number> = { docs: 0, flows: 0, rounds: 0, practiceRounds: 0, wordCountRounds: 0, drills: 0, judgeDecisions: 0, speeches: 0 };
  const skipped: RestoreSkip[] = [];
  if (entries.some((e) => e.kind === "docs")) await ensureDocumentColumns(db);
  for (const { kind, doc } of entries) {
    let outcome: Outcome;
    switch (kind) {
      case "flows":
        outcome = await restoreFlow(db, userId, doc, now);
        break;
      case "rounds":
        outcome = await restoreRound(db, userId, doc, now);
        break;
      case "docs":
        outcome = await restoreDoc(db, userId, doc, now, author);
        break;
      case "practiceRounds":
        outcome = await restorePracticeRound(db, userId, email, doc, now);
        break;
      case "wordCountRounds":
        outcome = await restoreWordCountRound(db, userId, doc, now);
        break;
      case "drills":
        outcome = await restoreDrillSet(db, userId, doc, now);
        break;
      case "judgeDecisions":
        outcome = await restoreJudgeDecision(db, userId, doc, now);
        break;
      case "speeches":
        outcome = await restoreSpeechSend(db, userId, doc, now);
        break;
    }
    if (outcome.restored) restored[kind] += 1;
    else skipped.push({ kind, title: titleOf(doc, FALLBACK_TITLES[kind]), reason: outcome.reason });
  }
  return { restored, skipped };
}
