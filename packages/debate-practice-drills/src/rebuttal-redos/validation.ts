/**
 * @fileoverview Reads untrusted request bodies for Rebuttal Redos.
 *
 * @module debate-practice-rounds/rebuttal-redos/validation
 */

import { isChallengeFormat } from "../debate-challenges/validation";
import {
  MAX_JUDGE_TEXT,
  MAX_REDO_SECONDS,
  MAX_SPEECH_SOURCE,
  MAX_SUBMISSION_TEXT,
  MIN_REDO_SECONDS,
  REDO_STATUSES,
  type NewRedoRound,
  type RedoRoundDebater,
  type RedoSide,
  type RedoStatus,
  type RedoUpdate,
} from "./types";

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

const fail = (error: string): Parsed<never> => ({ ok: false, error });

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isRedoSide(value: unknown): value is RedoSide {
  return value === "aff" || value === "neg";
}

export function isRedoStatus(value: unknown): value is RedoStatus {
  return typeof value === "string" && (REDO_STATUSES as readonly string[]).includes(value);
}

/** Reads the body of `POST /api/rebuttal-redos`. */
export function parseNewRedoRound(payload: unknown): Parsed<NewRedoRound> {
  if (!payload || typeof payload !== "object") return fail("Invalid round.");
  const body = payload as Record<string, unknown>;
  const roundId = typeof body.roundId === "string" || typeof body.roundId === "number" ? String(body.roundId).trim() : "";
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(roundId)) return fail("Pick a round.");
  if (!isChallengeFormat(body.format)) return fail("Pick the round's format.");
  const winner = body.winner === null || body.winner === undefined ? null : body.winner;
  if (winner !== null && !isRedoSide(winner)) return fail("The winner must be aff or neg.");
  if (!Array.isArray(body.debaters)) return fail("The round has no debaters.");
  const debaters: RedoRoundDebater[] = [];
  for (const raw of body.debaters.slice(0, 8)) {
    if (!raw || typeof raw !== "object") continue;
    const { email, side, position } = raw as Record<string, unknown>;
    if (typeof email !== "string" || !EMAIL.test(email.trim())) continue;
    if (!isRedoSide(side) || (position !== 0 && position !== 1)) continue;
    debaters.push({ email: email.trim().slice(0, 254), side, position });
  }
  if (debaters.length === 0) return fail("Add the debaters' emails to the round first, so the redos reach them.");
  const speeches: Record<string, string> = {};
  if (body.speeches && typeof body.speeches === "object") {
    for (const [key, value] of Object.entries(body.speeches as Record<string, unknown>).slice(0, 16)) {
      if (typeof value === "string") speeches[key.slice(0, 40)] = value.slice(0, MAX_SPEECH_SOURCE);
    }
  }
  return {
    ok: true,
    value: {
      roundId,
      roundTitle: typeof body.roundTitle === "string" ? body.roundTitle.trim().slice(0, 200) : "",
      format: body.format,
      winner,
      debaters,
      speeches,
      judgeNotes: typeof body.judgeNotes === "string" ? body.judgeNotes.slice(0, MAX_JUDGE_TEXT) : "",
    },
  };
}

/** Reads the body of `PATCH /api/rebuttal-redos/[id]`. */
export function parseRedoUpdate(payload: unknown): Parsed<RedoUpdate> {
  if (!payload || typeof payload !== "object") return fail("Invalid update.");
  const body = payload as Record<string, unknown>;
  switch (body.action) {
    case "edit": {
      const update: Extract<RedoUpdate, { action: "edit" }> = { action: "edit" };
      if (body.judgeInstructions !== undefined) {
        if (typeof body.judgeInstructions !== "string") return fail("Instructions must be text.");
        if (body.judgeInstructions.length > MAX_JUDGE_TEXT) return fail(`Keep instructions under ${MAX_JUDGE_TEXT} characters.`);
        update.judgeInstructions = body.judgeInstructions;
      }
      if (body.timeLimitSeconds !== undefined) {
        const seconds = Number(body.timeLimitSeconds);
        if (!Number.isInteger(seconds) || seconds < MIN_REDO_SECONDS || seconds > MAX_REDO_SECONDS) {
          return fail("Pick a speech time between 1 and 9 minutes.");
        }
        update.timeLimitSeconds = seconds;
      }
      if (body.dueInDays !== undefined) {
        if (body.dueInDays === null) update.dueInDays = null;
        else {
          const days = Number(body.dueInDays);
          if (!Number.isInteger(days) || days < 1 || days > 60) return fail("Pick a due date 1 to 60 days out.");
          update.dueInDays = days;
        }
      }
      return { ok: true, value: update };
    }
    case "assign":
    case "skip":
      return { ok: true, value: { action: body.action } };
    case "submit": {
      const text = typeof body.submissionText === "string" ? body.submissionText.trim() : "";
      if (text.length > MAX_SUBMISSION_TEXT) return fail(`Keep the outline under ${MAX_SUBMISSION_TEXT} characters.`);
      return { ok: true, value: { action: "submit", submissionText: text } };
    }
    case "review": {
      const feedback = typeof body.feedback === "string" ? body.feedback.trim() : "";
      if (!feedback) return fail("Write some feedback for the debater.");
      if (feedback.length > MAX_JUDGE_TEXT) return fail(`Keep feedback under ${MAX_JUDGE_TEXT} characters.`);
      const rating = Number(body.rating);
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) return fail("Rate the redo from 1 to 5 stars.");
      return { ok: true, value: { action: "review", feedback, rating } };
    }
    default:
      return fail("Unknown action.");
  }
}
