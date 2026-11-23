/**
 * @fileoverview The pure rules of Rebuttal Redos: which rebuttal each debater
 * redoes, how to read that rebuttal off the judge's flow, which moves each
 * person may make on a redo, and the fiat points and badges a debater earns.
 *
 * No storage and no model calls — the app's `lib/rebuttal-redos/store.ts`
 * stores what these return.
 *
 * @module debate-practice-rounds/rebuttal-redos/rules
 */

import type { FiatBadge, FiatSummary, RedoFormat, RedoRoundDebater, RedoSide, RedoStatus } from "./types";

// ── Which rebuttal each debater redoes ──────────────────────────────────────

/**
 * The rebuttal each speaker position gives, by format and side: index 0 is
 * the first speaker, 1 the second. One-person formats list one speech.
 * In PF the first speaker gives Summary and the second Final Focus.
 */
const REBUTTALS_BY_POSITION: Record<RedoFormat, Record<RedoSide, string[]>> = {
  policy: { aff: ["1AR", "2AR"], neg: ["1NR", "2NR"] },
  ndt: { aff: ["1AR", "2AR"], neg: ["1NR", "2NR"] },
  ld: { aff: ["2AR"], neg: ["NR"] },
  pf: { aff: ["Summary", "Final Focus"], neg: ["Summary", "Final Focus"] },
  parli: { aff: ["PMR"], neg: ["LOR"] },
  worlds: { aff: ["Reply"], neg: ["Reply"] },
};

/** Default redo speech time per speech, in seconds; anything unlisted gets 4 minutes. */
const SPEECH_SECONDS: Record<string, number> = {
  "1AR": 300,
  "2AR": 300,
  "1NR": 300,
  "2NR": 300,
  NR: 360,
  Summary: 180,
  "Final Focus": 120,
  PMR: 300,
  LOR: 240,
  Reply: 240,
};

/** The rebuttal a debater in this seat redoes, or null when the seat gives none. */
export function rebuttalFor(format: RedoFormat, side: RedoSide, position: 0 | 1): string | null {
  return REBUTTALS_BY_POSITION[format]?.[side]?.[position] ?? null;
}

/** Default redo time for a speech, in seconds. */
export function defaultRedoSeconds(format: RedoFormat, speech: string): number {
  if (format === "ld" && speech === "2AR") return 180;
  return SPEECH_SECONDS[speech] ?? 240;
}

/** One redo to draft: a debater and the speech they redo. */
export interface RedoSeat {
  email: string;
  side: RedoSide;
  speech: string;
}

/**
 * Every debater on the round who gives a rebuttal, with that rebuttal —
 * blank and repeated emails dropped (case-insensitive, first one wins).
 */
export function redoSeats(format: RedoFormat, debaters: readonly RedoRoundDebater[]): RedoSeat[] {
  const seen = new Set<string>();
  const seats: RedoSeat[] = [];
  for (const debater of debaters) {
    const email = debater.email.trim();
    const key = email.toLowerCase();
    if (!email || seen.has(key)) continue;
    const speech = rebuttalFor(format, debater.side, debater.position);
    if (!speech) continue;
    seen.add(key);
    seats.push({ email, side: debater.side, speech });
  }
  return seats;
}

// ── Reading the round off the flow ──────────────────────────────────────────

/**
 * Guess a round's format from its flow's speech columns ("2NR" → policy,
 * "NR" → LD, "Final Focus"/"FF" → PF…). Policy when nothing matches, since
 * most rounds in the workspace are policy.
 */
export function inferRedoFormat(columns: readonly string[]): RedoFormat {
  const names = columns.map((column) => column.trim().toLowerCase());
  const has = (pattern: RegExp) => names.some((name) => pattern.test(name));
  if (has(/^(ff|final focus)\b/) || has(/^summ/)) return "pf";
  if (has(/^(pmr|lor|mg|mo)\b/)) return "parli";
  if (has(/^(pm|lo|dpm|dlo|reply)\b/)) return "worlds";
  if (has(/^(ac|nc)$/) || (has(/^nr$/) && !has(/^2nr$/))) return "ld";
  return "policy";
}

/** A flow row as the round workspace stores it (`@debate-ai/round`'s `Box`). */
export interface RedoFlowBox {
  content: string;
  children: RedoFlowBox[];
}

/** The slice of a round-workspace flow the extractor reads. */
export interface RedoFlow {
  columns: string[];
  children: RedoFlowBox[];
  speechDocs?: Record<string, string>;
}

function speechMatches(column: string, speech: string): boolean {
  const a = column.trim().toLowerCase();
  const b = speech.trim().toLowerCase();
  if (a === b) return true;
  if (b === "final focus") return a === "ff" || a.startsWith("final");
  if (b === "summary") return a.startsWith("summ");
  // "2NC/1NR" columns carry the 1NR.
  return a.split(/[/,&+]/).some((part) => part.trim() === b);
}

function rowsAtDepth(boxes: readonly RedoFlowBox[], depth: number, out: string[]): void {
  for (const box of boxes) {
    if (depth === 0) {
      const text = box.content.trim();
      if (text) out.push(text);
    } else {
      rowsAtDepth(box.children ?? [], depth - 1, out);
    }
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<(br|\/p|\/div|\/li|\/h\d)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

/**
 * What a speech said, from every flow in the round: the rows flowed in that
 * speech's column, then the speech doc if one was attached. Cut to `maxChars`.
 */
export function extractSpeechText(flows: readonly RedoFlow[], speech: string, maxChars = 4000): string {
  const parts: string[] = [];
  for (const flow of flows) {
    const index = flow.columns.findIndex((column) => speechMatches(column, speech));
    if (index < 0) continue;
    const rows: string[] = [];
    rowsAtDepth(flow.children ?? [], index, rows);
    if (rows.length > 0) parts.push(rows.map((row) => `- ${row}`).join("\n"));
    const docKey = Object.keys(flow.speechDocs ?? {}).find((key) => speechMatches(key, speech));
    const doc = docKey ? stripHtml(flow.speechDocs![docKey] ?? "") : "";
    if (doc) parts.push(doc);
  }
  const text = parts.join("\n").trim();
  return text.length > maxChars ? `${text.slice(0, maxChars - 1)}…` : text;
}

// ── Moves ───────────────────────────────────────────────────────────────────

export type RedoMove = "edit" | "assign" | "skip" | "submit" | "review";

/** The moves `role` may make on a redo in `status`. */
export function availableRedoMoves(status: RedoStatus, role: "judge" | "student"): RedoMove[] {
  if (role === "judge") {
    if (status === "draft") return ["edit", "assign", "skip"];
    if (status === "assigned") return ["edit", "skip"];
    if (status === "skipped") return ["edit", "assign"];
    if (status === "submitted" || status === "reviewed") return ["review"];
    return [];
  }
  // A debater may turn in a new take until the judge has reviewed it.
  if (status === "assigned" || status === "submitted") return ["submit"];
  return [];
}

// ── Fiat points and badges ──────────────────────────────────────────────────

/** Fiat points for turning a redo in. */
export const FIAT_SUBMIT_POINTS = 10;
/** Extra fiat points for turning it in by the due date. */
export const FIAT_ON_TIME_POINTS = 5;
/** Fiat points per star of the judge's rating. */
export const FIAT_POINTS_PER_STAR = 5;

/** The fields fiat points are counted from. */
export interface FiatRedo {
  status: RedoStatus;
  submittedAt: number | null;
  dueAt: number | null;
  rating: number | null;
}

/** Whether a redo was turned in by its due date (no due date counts as on time). */
export function submittedOnTime(redo: FiatRedo): boolean {
  if (redo.submittedAt === null) return false;
  return redo.dueAt === null || redo.submittedAt <= redo.dueAt;
}

/**
 * Fiat points one redo has paid: {@link FIAT_SUBMIT_POINTS} once turned in,
 * {@link FIAT_ON_TIME_POINTS} more if on time, and
 * {@link FIAT_POINTS_PER_STAR} per star once the judge rates it.
 */
export function fiatPointsFor(redo: FiatRedo): number {
  if (redo.status !== "submitted" && redo.status !== "reviewed") return 0;
  let points = FIAT_SUBMIT_POINTS;
  if (submittedOnTime(redo)) points += FIAT_ON_TIME_POINTS;
  if (redo.status === "reviewed" && redo.rating !== null) points += Math.max(0, Math.min(5, redo.rating)) * FIAT_POINTS_PER_STAR;
  return points;
}

interface BadgeDefinition {
  id: string;
  title: string;
  description: string;
  target: number;
  count: (stats: BadgeStats) => number;
}

interface BadgeStats {
  submitted: number;
  reviewed: number;
  onTime: number;
  fiveStars: number;
  points: number;
}

/** The fiat-point badges, in display order. */
export const FIAT_BADGES: readonly BadgeDefinition[] = [
  { id: "first-redo", title: "First Redo", description: "Turned in your first rebuttal redo.", target: 1, count: (s) => s.submitted },
  { id: "on-the-clock", title: "On the Clock", description: "Turned in 5 redos by their due date.", target: 5, count: (s) => s.onTime },
  { id: "comeback", title: "Comeback", description: "Had 5 redos reviewed by a judge.", target: 5, count: (s) => s.reviewed },
  { id: "judges-pick", title: "Judge's Pick", description: "A judge rated one of your redos 5 stars.", target: 1, count: (s) => s.fiveStars },
  { id: "rebuttal-rebuilt", title: "Rebuttal Rebuilt", description: "Had 20 redos reviewed by a judge.", target: 20, count: (s) => s.reviewed },
  { id: "fiat-500", title: "Fiat 500", description: "Earned 500 fiat points.", target: 500, count: (s) => s.points },
];

/** A debater's fiat points and badges, counted from every redo they were assigned. */
export function fiatSummary(redos: readonly FiatRedo[]): FiatSummary {
  const stats: BadgeStats = { submitted: 0, reviewed: 0, onTime: 0, fiveStars: 0, points: 0 };
  for (const redo of redos) {
    if (redo.status !== "submitted" && redo.status !== "reviewed") continue;
    stats.submitted += 1;
    if (submittedOnTime(redo)) stats.onTime += 1;
    if (redo.status === "reviewed") {
      stats.reviewed += 1;
      if (redo.rating === 5) stats.fiveStars += 1;
    }
    stats.points += fiatPointsFor(redo);
  }
  const badges: FiatBadge[] = FIAT_BADGES.map((badge) => {
    const progress = badge.count(stats);
    return {
      id: badge.id,
      title: badge.title,
      description: badge.description,
      earned: progress >= badge.target,
      progress: Math.min(progress, badge.target),
      target: badge.target,
    };
  });
  return { points: stats.points, submitted: stats.submitted, reviewed: stats.reviewed, badges };
}
