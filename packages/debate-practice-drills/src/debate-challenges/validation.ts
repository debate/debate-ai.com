/**
 * @fileoverview Reads untrusted request bodies and stored JSON for Online
 * Challenges. Everything off the option lists in `./types.ts` is refused, so
 * the API never stores a value the board cannot show.
 *
 * @module debate-practice-rounds/debate-challenges/validation
 */

import {
  AI_LEVELS,
  AI_OPPONENT_ID,
  CHALLENGE_FORMATS,
  MAX_CHALLENGE_NOTE_LENGTH,
  MAX_CHALLENGE_TOPIC_LENGTH,
  type AiLevel,
  type ChallengeFormat,
  type ChallengeSide,
  type ChallengeSpeech,
  type DebateChallengeAction,
  type NewDebateChallenge,
} from "./types";

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

const fail = (error: string): Parsed<never> => ({ ok: false, error });

export function isChallengeFormat(value: unknown): value is ChallengeFormat {
  return typeof value === "string" && CHALLENGE_FORMATS.some((format) => format.id === value);
}

export function isAiLevel(value: unknown): value is AiLevel {
  return typeof value === "string" && AI_LEVELS.some((level) => level.id === value);
}

export function isChallengeSide(value: unknown): value is ChallengeSide {
  return value === "aff" || value === "neg";
}

/** A new challenge, normalized: trimmed strings, `aiLevel` set only against the AI. */
export interface ParsedNewChallenge {
  opponentId: string;
  vsAi: boolean;
  aiLevel: AiLevel | null;
  format: ChallengeFormat;
  topic: string;
  side: ChallengeSide;
  speech: string;
  note: string;
}

/** Reads the body of `POST /api/debate-challenges`. The opening speech itself is checked by `rules.ts`. */
export function parseNewDebateChallenge(payload: unknown): Parsed<ParsedNewChallenge> {
  if (!payload || typeof payload !== "object") return fail("Invalid challenge.");
  const body = payload as Partial<Record<keyof NewDebateChallenge, unknown>>;

  if (typeof body.opponentId !== "string" || !body.opponentId.trim()) return fail("Pick who to challenge.");
  const opponentId = body.opponentId.trim();
  const vsAi = opponentId === AI_OPPONENT_ID;

  if (!isChallengeFormat(body.format)) return fail("Pick a format.");
  if (!isChallengeSide(body.side)) return fail("Pick a side.");

  if (typeof body.topic !== "string" || !body.topic.trim()) return fail("Pick or write a resolution.");
  const topic = body.topic.trim().replace(/\s+/g, " ");
  if (topic.length > MAX_CHALLENGE_TOPIC_LENGTH) {
    return fail(`The resolution can be at most ${MAX_CHALLENGE_TOPIC_LENGTH} characters.`);
  }

  const note = typeof body.note === "string" ? body.note.trim() : "";
  if (note.length > MAX_CHALLENGE_NOTE_LENGTH) return fail(`The note can be at most ${MAX_CHALLENGE_NOTE_LENGTH} characters.`);

  let aiLevel: AiLevel | null = null;
  if (vsAi) {
    if (body.aiLevel !== undefined && !isAiLevel(body.aiLevel)) return fail("Pick an AI level.");
    aiLevel = (body.aiLevel as AiLevel | undefined) ?? "varsity";
  }

  return {
    ok: true,
    value: {
      opponentId,
      vsAi,
      aiLevel,
      format: body.format,
      topic,
      side: body.side,
      speech: typeof body.speech === "string" ? body.speech : "",
      note,
    },
  };
}

const ACTIONS: readonly DebateChallengeAction[] = ["speak", "decline", "cancel", "concede", "claim"];

/** Reads the body of `PATCH /api/debate-challenges/[id]`. */
export function parseChallengeUpdate(payload: unknown): Parsed<{ action: DebateChallengeAction; text: string }> {
  if (!payload || typeof payload !== "object") return fail("Invalid update.");
  const { action, text } = payload as { action?: unknown; text?: unknown };
  if (typeof action !== "string" || !(ACTIONS as readonly string[]).includes(action)) return fail("Unknown action.");
  return { ok: true, value: { action: action as DebateChallengeAction, text: typeof text === "string" ? text : "" } };
}

/** The stored `speeches` JSON as speeches; anything malformed is dropped. */
export function readStoredSpeeches(raw: string | null | undefined): ChallengeSpeech[] {
  if (!raw) return [];
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry): ChallengeSpeech[] => {
    if (!entry || typeof entry !== "object") return [];
    const { side, authorId, text, submittedAt } = entry as Record<string, unknown>;
    if (!isChallengeSide(side) || typeof text !== "string" || typeof submittedAt !== "number") return [];
    return [{ side, authorId: typeof authorId === "string" ? authorId : null, text, submittedAt }];
  });
}
