/**
 * @fileoverview Restore from a "Saved to your account" export file.
 *
 * Reads either file Settings → General hands out — one item's **Export**
 * (`exportOwnSavedItem`) or **Export all as JSON** (`exportAllOwnSavedData`) —
 * and writes its documents, flows and rounds back as rows owned by the
 * caller. It only ever adds rows: an item that is still in the account is
 * skipped, never overwritten, so restoring the same file twice is harmless.
 *
 * - Flows and rounds come back under their original local id (`clientId`),
 *   so `/debate?flowId=` / `?roundId=` links and a round's `flowIds` keep
 *   pointing at them. They pass the same validators and size caps as
 *   `PUT /api/flows/[clientId]` and `PUT /api/rounds/[clientId]`.
 * - Documents get a fresh row id (ids are global), at the top level of
 *   My Files, unless a document with the exported id is still the caller's.
 * - Practice debates vs AI are reported as skipped: their record is written
 *   by the vsbot routes, not a validated client save, so there is no
 *   validator to restore them through yet. Word-count rounds and drill sets
 *   (both in the bulk archive) are skipped the same way: their tools re-sync
 *   them from each device, so restoring them here waits on that design.
 *
 * @module lib/saved-data/saved-data-restore
 */

import { and, eq } from "drizzle-orm";
import { deriveFlowLabel, deriveRoundLabel, isValidFlow, isValidRound, MAX_SAVED_FLOW_BYTES, MAX_SAVED_ROUND_BYTES } from "@debate-ai/round";
import { normalizeFormat } from "@debate-ai/reason-docs/lib/debate-editor/format";
import type { getDBFromContext } from "@/lib/database/context";
import { ensureDocumentColumns, fileStatColumns } from "@/lib/file-stats/columns";
import { documents, savedFlows, savedRounds } from "../database/schema";
import type { ItemKind as SavedItemKind } from "./saved-data-items";

/** Kinds a Manage export can be restored into; drill sets are listed and exported but not restorable yet. */
const ITEM_KINDS = ["docs", "flows", "rounds", "practiceRounds"] as const satisfies readonly SavedItemKind[];
type ItemKind = (typeof ITEM_KINDS)[number];

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
};

/**
 * Writes each entry back as the caller's own row, one at a time, and reports
 * what was restored and what was skipped. Never updates or deletes a row.
 */
export async function restoreOwnSavedData(
  db: AccountDB,
  userId: string,
  entries: readonly RestoreEntry[],
  { now = new Date(), author = null }: { now?: Date; author?: string | null } = {},
): Promise<RestoreReport> {
  const restored: Record<ItemKind, number> = { docs: 0, flows: 0, rounds: 0, practiceRounds: 0, wordCountRounds: 0, drills: 0 };
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
        outcome = { restored: false, reason: "Practice debates can't be restored yet." };
        break;
      case "wordCountRounds":
        outcome = { restored: false, reason: "Word-count rounds can't be restored yet." };
        break;
      case "drills":
        outcome = { restored: false, reason: "Drill sets can't be restored yet." };
        break;
    }
    if (outcome.restored) restored[kind] += 1;
    else skipped.push({ kind, title: titleOf(doc, FALLBACK_TITLES[kind]), reason: outcome.reason });
  }
  return { restored, skipped };
}
