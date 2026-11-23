/**
 * @fileoverview The read and write side of Rebuttal Redos, over the
 * `rebuttal_redos` table. The rules, prompt and wire format come from
 * `@debate-ai/practice-rounds`' `rebuttal-redos/`; this file stores what the
 * rules allow, drafts assignments with the model, sends notifications and
 * shapes rows for the page.
 *
 * Debaters are found by the email written on the round, as round invites
 * are (`/api/rounds/invite`): a row's `student_id` is filled as soon as an
 * account with that email exists — at drafting time or on that account's
 * next board read.
 *
 * The model call goes through the Online Challenges key path
 * (`lib/debate-challenges/ai.ts`); when no key answers, each debater gets
 * the general fallback assignment and the judge edits it.
 *
 * @module lib/rebuttal-redos/store
 */

import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import type { getDBFromContext } from "@/lib/database/context";
import { notifications, rebuttalRedos, user, type RebuttalRedoRow } from "@/lib/database/schema";
import type { ChallengeTextGenerator } from "@/lib/debate-challenges/ai";
import { isChallengeFormat } from "@debate-ai/practice-rounds/src/debate-challenges/validation";
import {
  fallbackInstructions,
  parseRedoAssignments,
  redoAssignmentPrompt,
  seatLabel,
} from "@debate-ai/practice-rounds/src/rebuttal-redos/prompts";
import {
  availableRedoMoves,
  defaultRedoSeconds,
  fiatPointsFor,
  fiatSummary,
  redoSeats,
} from "@debate-ai/practice-rounds/src/rebuttal-redos/rules";
import { isRedoSide, isRedoStatus } from "@debate-ai/practice-rounds/src/rebuttal-redos/validation";
import {
  DEFAULT_DUE_DAYS,
  type NewRedoRound,
  type RebuttalRedo,
  type RedoBoardResponse,
  type RedoUpdate,
} from "@debate-ai/practice-rounds/src/rebuttal-redos/types";

type Db = Awaited<ReturnType<typeof getDBFromContext>>;

/** Where every redo notification sends its reader. */
export const REBUTTAL_REDOS_LINK = "/practice/debates?section=drills#rebuttal-redos";

const ASSIGNMENT_MAX_TOKENS = 1500;
const DAY_SECONDS = 24 * 60 * 60;

/** The signed-in person, as the redo routes need them. */
export interface RedoViewer {
  id: string;
  name: string;
  email: string;
  isAnonymous: boolean;
}

const toSeconds = (value: Date | null | undefined): number | null => (value ? Math.floor(value.getTime() / 1000) : null);

export async function getRedoViewer(db: Db, userId: string): Promise<RedoViewer | null> {
  const [row] = await db
    .select({ id: user.id, name: user.name, email: user.email, isAnonymous: user.isAnonymous })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  if (!row) return null;
  return { id: row.id, name: row.name, email: row.email, isAnonymous: Boolean(row.isAnonymous) };
}

export async function getRedoRow(db: Db, id: string): Promise<RebuttalRedoRow | null> {
  const [row] = await db.select().from(rebuttalRedos).where(eq(rebuttalRedos.id, id)).limit(1);
  return row ?? null;
}

/** Whether the viewer is this redo's judge, its debater, or neither. */
export function viewerRoleFor(row: RebuttalRedoRow, viewerId: string): "judge" | "student" | null {
  if (row.judgeId === viewerId) return "judge";
  if (row.studentId === viewerId) return "student";
  return null;
}

async function namesFor(db: Db, ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return new Map();
  const rows = await db.select({ id: user.id, name: user.name }).from(user).where(inArray(user.id, unique));
  return new Map(rows.map((row: { id: string; name: string }) => [row.id, row.name]));
}

function fiatFields(row: RebuttalRedoRow) {
  return {
    status: isRedoStatus(row.status) ? row.status : "draft",
    submittedAt: toSeconds(row.submittedAt),
    dueAt: toSeconds(row.dueAt),
    rating: row.rating ?? null,
  } as const;
}

/** One stored row in the page's wire format. */
export function rowToRedo(row: RebuttalRedoRow, names: Map<string, string>, viewerId: string): RebuttalRedo {
  const fiat = fiatFields(row);
  return {
    id: row.id,
    roundKey: row.roundKey,
    roundTitle: row.roundTitle,
    format: isChallengeFormat(row.format) ? row.format : "policy",
    judge: { id: row.judgeId, name: names.get(row.judgeId) ?? "Judge" },
    student: {
      email: row.studentEmail,
      id: row.studentId ?? null,
      name: (row.studentId && names.get(row.studentId)) || row.studentEmail.split("@")[0] || row.studentEmail,
    },
    side: isRedoSide(row.side) ? row.side : "aff",
    speech: row.speech,
    aiInstructions: row.aiInstructions,
    judgeInstructions: row.judgeInstructions,
    timeLimitSeconds: row.timeLimitSeconds,
    dueAt: fiat.dueAt,
    status: fiat.status,
    submissionText: row.submissionText,
    hasAudio: Boolean(row.audioKey),
    submittedAt: fiat.submittedAt,
    feedback: row.feedback,
    rating: fiat.rating,
    reviewedAt: toSeconds(row.reviewedAt),
    fiatPoints: fiatPointsFor(fiat),
    createdAt: toSeconds(row.createdAt) ?? 0,
    updatedAt: toSeconds(row.updatedAt) ?? 0,
    viewerRole: row.judgeId === viewerId ? "judge" : "student",
  };
}

export async function redoViews(db: Db, rows: RebuttalRedoRow[], viewerId: string): Promise<RebuttalRedo[]> {
  const names = await namesFor(db, rows.flatMap((row) => [row.judgeId, row.studentId ?? ""]));
  return rows.map((row) => rowToRedo(row, names, viewerId));
}

/** Links redos written for this viewer's email to their account. */
export async function claimRedosByEmail(db: Db, viewer: RedoViewer): Promise<void> {
  if (viewer.isAnonymous || !viewer.email) return;
  await db
    .update(rebuttalRedos)
    .set({ studentId: viewer.id })
    .where(and(isNull(rebuttalRedos.studentId), sql`lower(${rebuttalRedos.studentEmail}) = ${viewer.email.toLowerCase()}`));
}

/** The viewer's board: what they were assigned, what they judge, and their fiat points. */
export async function loadRedoBoard(db: Db, viewer: RedoViewer): Promise<RedoBoardResponse> {
  await claimRedosByEmail(db, viewer);
  const [assignedRows, judgingRows] = await Promise.all([
    db
      .select()
      .from(rebuttalRedos)
      .where(and(eq(rebuttalRedos.studentId, viewer.id), inArray(rebuttalRedos.status, ["assigned", "submitted", "reviewed"])))
      .orderBy(desc(rebuttalRedos.updatedAt))
      .limit(200),
    db.select().from(rebuttalRedos).where(eq(rebuttalRedos.judgeId, viewer.id)).orderBy(desc(rebuttalRedos.createdAt)).limit(300),
  ]);
  const views = await redoViews(db, [...assignedRows, ...judgingRows], viewer.id);
  const assignments = views.slice(0, assignedRows.length).map((redo) => ({ ...redo, viewerRole: "student" as const }));
  const judging = views.slice(assignedRows.length);
  return {
    viewer: { id: viewer.id, name: viewer.name, email: viewer.email },
    assignments,
    judging,
    fiat: fiatSummary(assignedRows.map(fiatFields)),
  };
}

export function roundKeyFor(judgeId: string, roundId: string): string {
  return `${judgeId}:${roundId}`;
}

/**
 * Drafts one redo per debater on the round, with the model's assignment
 * (or the fallback). The judge's own email is never assigned. Returns the
 * existing rows, with `created: false`, when this judge already drafted
 * redos for the round.
 */
export async function draftRoundRedos(
  db: Db,
  viewer: RedoViewer,
  round: NewRedoRound,
  generate: ChallengeTextGenerator,
  nowSeconds: number,
): Promise<{ rows: RebuttalRedoRow[]; created: boolean } | { error: string }> {
  const roundKey = roundKeyFor(viewer.id, round.roundId);
  const existing = await db.select().from(rebuttalRedos).where(eq(rebuttalRedos.roundKey, roundKey));
  if (existing.length > 0) return { rows: existing, created: false };

  const self = viewer.email.toLowerCase();
  const seats = redoSeats(round.format, round.debaters).filter((seat) => seat.email.toLowerCase() !== self);
  if (seats.length === 0) return { error: "None of this round's debaters give a rebuttal you can assign." };

  const reply = await generate(redoAssignmentPrompt(round, seats), ASSIGNMENT_MAX_TOKENS);
  const written = parseRedoAssignments(reply);

  const accounts = await db
    .select({ id: user.id, email: user.email, isAnonymous: user.isAnonymous })
    .from(user)
    .where(inArray(sql`lower(${user.email})`, seats.map((seat) => seat.email.toLowerCase())));
  const idByEmail = new Map(
    accounts
      .filter((row: { isAnonymous: boolean | null }) => !row.isAnonymous)
      .map((row: { id: string; email: string }) => [row.email.toLowerCase(), row.id]),
  );

  const now = new Date(nowSeconds * 1000);
  const rows = seats.map((seat) => ({
    id: crypto.randomUUID(),
    roundKey,
    roundTitle: round.roundTitle,
    format: round.format,
    judgeId: viewer.id,
    studentEmail: seat.email,
    studentId: idByEmail.get(seat.email.toLowerCase()) ?? null,
    side: seat.side,
    speech: seat.speech,
    aiInstructions: written.get(seatLabel(seat)) ?? fallbackInstructions(seat),
    judgeInstructions: "",
    timeLimitSeconds: defaultRedoSeconds(round.format, seat.speech),
    dueAt: new Date((nowSeconds + DEFAULT_DUE_DAYS * DAY_SECONDS) * 1000),
    status: "draft",
    createdAt: now,
    updatedAt: now,
  }));
  await db.insert(rebuttalRedos).values(rows);
  const stored = await db.select().from(rebuttalRedos).where(eq(rebuttalRedos.roundKey, roundKey));
  return { rows: stored, created: true };
}

async function notify(db: Db, userId: string | null, title: string, body: string): Promise<void> {
  if (!userId) return;
  await db.insert(notifications).values({ userId, type: "rebuttal_redo", title, body, link: REBUTTAL_REDOS_LINK, createdAt: new Date() });
}

/**
 * Applies one move. Returns the updated row, or an error and status for a
 * move this person may not make now.
 */
export async function applyRedoUpdate(
  db: Db,
  row: RebuttalRedoRow,
  viewer: RedoViewer,
  update: RedoUpdate,
  nowSeconds: number,
): Promise<{ row: RebuttalRedoRow } | { error: string; status: number }> {
  const role = viewerRoleFor(row, viewer.id);
  if (!role) return { error: "Redo not found.", status: 404 };
  const status = isRedoStatus(row.status) ? row.status : "draft";
  if (!availableRedoMoves(status, role).includes(update.action)) {
    return { error: "That move isn't available on this redo right now.", status: 409 };
  }
  const now = new Date(nowSeconds * 1000);
  const changes: Partial<typeof rebuttalRedos.$inferInsert> = { updatedAt: now };

  switch (update.action) {
    case "edit":
      if (update.judgeInstructions !== undefined) changes.judgeInstructions = update.judgeInstructions.trim();
      if (update.timeLimitSeconds !== undefined) changes.timeLimitSeconds = update.timeLimitSeconds;
      if (update.dueInDays !== undefined) {
        changes.dueAt = update.dueInDays === null ? null : new Date((nowSeconds + update.dueInDays * DAY_SECONDS) * 1000);
      }
      break;
    case "assign":
      changes.status = "assigned";
      break;
    case "skip":
      changes.status = "skipped";
      break;
    case "submit":
      if (!update.submissionText && !row.audioKey) {
        return { error: "Record your redo or write its outline before turning it in.", status: 400 };
      }
      changes.status = "submitted";
      changes.submissionText = update.submissionText;
      changes.submittedAt = now;
      break;
    case "review":
      changes.status = "reviewed";
      changes.feedback = update.feedback;
      changes.rating = update.rating;
      changes.reviewedAt = now;
      break;
  }

  await db.update(rebuttalRedos).set(changes).where(eq(rebuttalRedos.id, row.id));
  const updated = (await getRedoRow(db, row.id))!;

  const title = row.roundTitle || "your last round";
  if (update.action === "assign") {
    await notify(db, row.studentId, `${viewer.name} assigned you a rebuttal redo`, `Redo your ${row.speech} from ${title}.`);
  } else if (update.action === "submit") {
    const who = row.studentEmail.split("@")[0];
    await notify(db, row.judgeId, `${viewer.name || who} turned in a rebuttal redo`, `Their ${row.speech} from ${title} is ready for your review.`);
  } else if (update.action === "review") {
    await notify(db, row.studentId, `${viewer.name} reviewed your rebuttal redo`, `Feedback and fiat points for your ${row.speech} from ${title}.`);
  }
  return { row: updated };
}

/** Records that the debater uploaded a recording for this redo. */
export async function setRedoAudio(db: Db, id: string, audioKey: string, nowSeconds: number): Promise<void> {
  await db.update(rebuttalRedos).set({ audioKey, updatedAt: new Date(nowSeconds * 1000) }).where(eq(rebuttalRedos.id, id));
}
