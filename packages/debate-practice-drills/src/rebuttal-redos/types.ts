/**
 * @fileoverview Wire types for Rebuttal Redos — after a round, the judge
 * hands each debater an AI-drafted assignment to redo their last rebuttal,
 * adds their own instructions, and reviews the recorded redo days later.
 * Finished redos earn fiat points and badges (`rules.ts`).
 *
 * The app's `lib/rebuttal-redos/` stores these in `rebuttal_redos`; this file
 * is the shape both sides agree on.
 *
 * @module debate-practice-rounds/rebuttal-redos/types
 */

import type { ChallengeFormat, ChallengeSide } from "../debate-challenges/types";

export type RedoFormat = ChallengeFormat;
export type RedoSide = ChallengeSide;

/**
 * - `draft` — the AI wrote it; only the judge sees it, and can edit or skip it.
 * - `assigned` — the judge sent it; the debater records their redo.
 * - `submitted` — the debater turned it in; waiting for the judge.
 * - `reviewed` — the judge left feedback; fiat points are paid.
 * - `skipped` — the judge decided this debater doesn't get this redo.
 */
export type RedoStatus = "draft" | "assigned" | "submitted" | "reviewed" | "skipped";

export const REDO_STATUSES: readonly RedoStatus[] = ["draft", "assigned", "submitted", "reviewed", "skipped"];

/** One debater's rebuttal redo, as the API returns it. */
export interface RebuttalRedo {
  id: string;
  /** `<judgeId>:<round id>` — one judge's redos for one round share it. */
  roundKey: string;
  roundTitle: string;
  format: RedoFormat;
  judge: { id: string; name: string };
  student: { email: string; id: string | null; name: string };
  side: RedoSide;
  /** "2NR", "1AR", "Final Focus"… */
  speech: string;
  /** The AI's assignment: what to fix and how to run the redo. */
  aiInstructions: string;
  /** The judge's own comments for this debater (may be empty). */
  judgeInstructions: string;
  /** Speech time for the redo, in seconds. */
  timeLimitSeconds: number;
  /** When the judge would like it back, unix seconds (null = no due date). */
  dueAt: number | null;
  status: RedoStatus;
  /** The debater's outline or transcript of the redo. */
  submissionText: string;
  /** Whether a recording was uploaded. */
  hasAudio: boolean;
  submittedAt: number | null;
  feedback: string;
  /** The judge's 1–5 rating, once reviewed. */
  rating: number | null;
  reviewedAt: number | null;
  /** Fiat points this redo has paid so far. */
  fiatPoints: number;
  createdAt: number;
  updatedAt: number;
  /** Which side of the redo the viewer is on. */
  viewerRole: "judge" | "student";
}

/** A fiat-point badge: earned or not, with progress toward it. */
export interface FiatBadge {
  id: string;
  title: string;
  description: string;
  earned: boolean;
  progress: number;
  target: number;
}

/** A debater's fiat-point standing, counted from their redos. */
export interface FiatSummary {
  points: number;
  submitted: number;
  reviewed: number;
  badges: FiatBadge[];
}

/** `GET /api/rebuttal-redos`. */
export interface RedoBoardResponse {
  viewer: { id: string; name: string; email: string };
  /** Redos the viewer was assigned (never drafts or skipped ones). */
  assignments: RebuttalRedo[];
  /** Redos the viewer wrote as judge, every status. */
  judging: RebuttalRedo[];
  fiat: FiatSummary;
}

/** One debater on the round, as the generate call sends them. */
export interface RedoRoundDebater {
  email: string;
  side: RedoSide;
  /** 0 = first speaker on that side, 1 = second. */
  position: 0 | 1;
}

/** `POST /api/rebuttal-redos` — draft redos for one round the viewer judged. */
export interface NewRedoRound {
  /** The round's local id in the judge's round store. */
  roundId: string;
  roundTitle: string;
  format: RedoFormat;
  winner: RedoSide | null;
  debaters: RedoRoundDebater[];
  /** What each rebuttal said, from the flow and speech docs, keyed by seat label ("Neg 2NR", see `seatLabel`). */
  speeches: Record<string, string>;
  /** The judge's ballot / RFD notes, if any. */
  judgeNotes: string;
}

/** `PATCH /api/rebuttal-redos/:id` bodies. */
export type RedoUpdate =
  | { action: "edit"; judgeInstructions?: string; timeLimitSeconds?: number; dueInDays?: number | null }
  | { action: "assign" }
  | { action: "skip" }
  | { action: "submit"; submissionText: string }
  | { action: "review"; feedback: string; rating: number };

/** Longest judge comment / feedback, in characters. */
export const MAX_JUDGE_TEXT = 4000;
/** Longest submitted outline / transcript, in characters. */
export const MAX_SUBMISSION_TEXT = 12000;
/** Longest text kept per flowed speech for the AI prompt. */
export const MAX_SPEECH_SOURCE = 4000;
/** Redo speech time bounds, in seconds. */
export const MIN_REDO_SECONDS = 60;
export const MAX_REDO_SECONDS = 9 * 60;
/** Days a new assignment is due in, unless the judge changes it. */
export const DEFAULT_DUE_DAYS = 7;
