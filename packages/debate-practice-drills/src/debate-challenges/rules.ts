/**
 * @fileoverview The rules of an Online Challenge — who speaks next, what each
 * debater may do, and what a missed response window does. The one copy of
 * them: `PATCH /api/debate-challenges/[id]` runs {@link applyChallengeMove}
 * against the stored row and writes what it returns, and the board runs
 * {@link availableMoves} to decide which buttons to draw.
 *
 * Pure: no database, no clock (every function takes `nowSeconds`), no names.
 *
 * @module debate-practice-rounds/debate-challenges/rules
 */

import {
  AI_OPPONENT_ID,
  MAX_SPEECH_LENGTH,
  MIN_SPEECH_LENGTH,
  RESPONSE_WINDOW_SECONDS,
  SPEECH_ORDER,
  otherSide,
  type ChallengeSide,
  type ChallengeSpeech,
  type DebateChallengeStatus,
  type DecisionMethod,
} from "./types";

/** The parts of a challenge the rules read and write. */
export interface ChallengeRoundState {
  status: DebateChallengeStatus;
  challengerId: string;
  /** An account id, or {@link AI_OPPONENT_ID}. */
  opponentId: string;
  challengerSide: ChallengeSide;
  speeches: ChallengeSpeech[];
  /** Unix seconds, or `null` when no one is on the clock. */
  deadlineAt: number | null;
  winnerSide: ChallengeSide | null;
  decisionMethod: DecisionMethod | null;
  completedAt: number | null;
}

/** A move a debater makes. Collecting a reward is not a move; the route handles it. */
export type ChallengeMove = "speak" | "decline" | "cancel" | "concede";

export const CHALLENGE_MOVES: readonly ChallengeMove[] = ["speak", "decline", "cancel", "concede"];

export type ChallengeMoveResult =
  | {
      ok: true;
      next: ChallengeRoundState;
      /** Human debaters who should hear about it — never the actor, never the AI. */
      notify: string[];
    }
  | { ok: false; status: 400 | 403 | 409; error: string };

const forbidden = (error: string): ChallengeMoveResult => ({ ok: false, status: 403, error });
const conflict = (error: string): ChallengeMoveResult => ({ ok: false, status: 409, error });

/** Whether the challenge is against the AI. */
export function isVsAi(state: Pick<ChallengeRoundState, "opponentId">): boolean {
  return state.opponentId === AI_OPPONENT_ID;
}

/** The side `playerId` debates, or `null` when they are not in the challenge. */
export function sideOf(state: ChallengeRoundState, playerId: string): ChallengeSide | null {
  if (playerId === state.challengerId) return state.challengerSide;
  if (playerId === state.opponentId) return otherSide(state.challengerSide);
  return null;
}

/** Who debates `side`. */
export function playerFor(state: ChallengeRoundState, side: ChallengeSide): string {
  return side === state.challengerSide ? state.challengerId : state.opponentId;
}

/** The next speech of the round, or `null` once all four are in. */
export function nextSpeech(state: Pick<ChallengeRoundState, "speeches">): (typeof SPEECH_ORDER)[number] | null {
  return SPEECH_ORDER[state.speeches.length] ?? null;
}

/** Whose speech is next, or `null` when the round is not waiting on anyone. */
export function turnOf(state: ChallengeRoundState): string | null {
  if (state.status !== "pending" && state.status !== "active") return null;
  const next = nextSpeech(state);
  return next ? playerFor(state, next.side) : null;
}

/** Why a speech would be refused, or `null` when it is fine. */
export function speechError(text: unknown): string | null {
  if (typeof text !== "string") return "Write your speech first.";
  const trimmed = text.trim();
  if (trimmed.length < MIN_SPEECH_LENGTH) return `A speech needs at least ${MIN_SPEECH_LENGTH} characters.`;
  if (trimmed.length > MAX_SPEECH_LENGTH) return `A speech can be at most ${MAX_SPEECH_LENGTH.toLocaleString("en-US")} characters.`;
  return null;
}

/** The humans in a challenge other than `actorId`, each once. */
function audience(state: ChallengeRoundState, actorId: string | null): string[] {
  return [state.challengerId, state.opponentId].filter(
    (id, index, all) => id !== actorId && id !== AI_OPPONENT_ID && all.indexOf(id) === index,
  );
}

/**
 * A fresh challenge. An Aff challenger's opening speech goes out with it (the
 * opponent has something to answer); a Neg challenger waits on the opponent's
 * constructive.
 */
export function createChallengeRound(
  input: { challengerId: string; opponentId: string; challengerSide: ChallengeSide; openingSpeech?: string },
  nowSeconds: number,
): { ok: true; state: ChallengeRoundState } | { ok: false; error: string } {
  const speeches: ChallengeSpeech[] = [];
  if (input.challengerSide === "aff") {
    const error = speechError(input.openingSpeech);
    if (error) return { ok: false, error: `Your opening speech: ${error.charAt(0).toLowerCase()}${error.slice(1)}` };
    speeches.push({ side: "aff", authorId: input.challengerId, text: input.openingSpeech!.trim(), submittedAt: nowSeconds });
  }
  return {
    ok: true,
    state: {
      status: "pending",
      challengerId: input.challengerId,
      opponentId: input.opponentId,
      challengerSide: input.challengerSide,
      speeches,
      deadlineAt: nowSeconds + RESPONSE_WINDOW_SECONDS,
      winnerSide: null,
      decisionMethod: null,
      completedAt: null,
    },
  };
}

/** Appends one speech by whoever's turn it is (the AI included) and moves the round on. */
function withSpeech(state: ChallengeRoundState, authorId: string, text: string, nowSeconds: number): ChallengeRoundState {
  const next = nextSpeech(state)!;
  const speeches = [
    ...state.speeches,
    { side: next.side, authorId: authorId === AI_OPPONENT_ID ? null : authorId, text: text.trim(), submittedAt: nowSeconds },
  ];
  const done = speeches.length >= SPEECH_ORDER.length;
  return {
    ...state,
    speeches,
    status: done ? "judging" : "active",
    deadlineAt: done ? null : nowSeconds + RESPONSE_WINDOW_SECONDS,
  };
}

/**
 * Applies one move by one debater.
 *
 * - `speak` — whoever's turn it is gives the next speech. The opponent's first
 *   speech is how they accept. The fourth speech sends the round to the judge.
 * - `decline` — the opponent turns a pending challenge down.
 * - `cancel` — the challenger withdraws a challenge nobody has answered.
 * - `concede` — either debater gives an active round to the other side.
 */
export function applyChallengeMove(
  state: ChallengeRoundState,
  actorId: string,
  move: ChallengeMove,
  nowSeconds: number,
  text?: string,
): ChallengeMoveResult {
  const side = sideOf(state, actorId);
  if (!side) return forbidden("You are not debating in this challenge.");

  switch (move) {
    case "speak": {
      if (state.status !== "pending" && state.status !== "active") return conflict("This round is over.");
      if (turnOf(state) !== actorId) return conflict("It isn't your turn to speak.");
      const error = speechError(text);
      if (error) return { ok: false, status: 400, error };
      return { ok: true, next: withSpeech(state, actorId, text!, nowSeconds), notify: audience(state, actorId) };
    }

    case "decline": {
      if (actorId !== state.opponentId) return forbidden("Only the debater who was challenged can decline.");
      if (state.status !== "pending") return conflict("This challenge has already been answered.");
      return {
        ok: true,
        next: { ...state, status: "declined", deadlineAt: null, completedAt: nowSeconds },
        notify: audience(state, actorId),
      };
    }

    case "cancel": {
      if (actorId !== state.challengerId) return forbidden("Only the challenger can withdraw a challenge.");
      if (state.status !== "pending") return conflict("Once answered, a round can only be conceded.");
      return {
        ok: true,
        next: { ...state, status: "cancelled", deadlineAt: null, completedAt: nowSeconds },
        notify: audience(state, actorId),
      };
    }

    case "concede": {
      if (state.status !== "active") return conflict("Only a round in progress can be conceded.");
      return {
        ok: true,
        next: {
          ...state,
          status: "complete",
          winnerSide: otherSide(side),
          decisionMethod: "concession",
          deadlineAt: null,
          completedAt: nowSeconds,
        },
        notify: audience(state, actorId),
      };
    }
  }
}

/** The moves `viewerId` may make right now, in {@link CHALLENGE_MOVES} order (`speak` checked without text). */
export function availableMoves(state: ChallengeRoundState, viewerId: string, nowSeconds: number): ChallengeMove[] {
  const placeholder = "x".repeat(MIN_SPEECH_LENGTH);
  return CHALLENGE_MOVES.filter(
    (move) => applyChallengeMove(state, viewerId, move, nowSeconds, placeholder).ok,
  );
}

/** The AI's speech, given when the AI is on turn. */
export function applyAiSpeech(state: ChallengeRoundState, text: string, nowSeconds: number): ChallengeRoundState | null {
  if (!isVsAi(state) || turnOf(state) !== AI_OPPONENT_ID || !text.trim()) return null;
  return withSpeech(state, AI_OPPONENT_ID, text, nowSeconds);
}

/** The judge's decision on a round with all four speeches in. */
export function applyJudgeDecision(
  state: ChallengeRoundState,
  winnerSide: ChallengeSide,
  nowSeconds: number,
): ChallengeRoundState | null {
  if (state.status !== "judging") return null;
  return { ...state, status: "complete", winnerSide, decisionMethod: "judge", deadlineAt: null, completedAt: nowSeconds };
}

/**
 * What a closed response window does, or `null` when nothing is overdue.
 *
 * A pending challenge expires with no result: the opponent never agreed to
 * debate. An active round is forfeited by whoever was on the clock. The AI is
 * never on the clock — its speeches are written the moment it is its turn, and
 * one that failed is retried rather than forfeited.
 */
export function settleOverdue(state: ChallengeRoundState, nowSeconds: number): ChallengeRoundState | null {
  if (state.deadlineAt === null || nowSeconds < state.deadlineAt) return null;
  const turn = turnOf(state);
  if (!turn || turn === AI_OPPONENT_ID) return null;
  if (state.status === "pending") {
    return { ...state, status: "expired", deadlineAt: null, completedAt: nowSeconds };
  }
  const late = sideOf(state, turn)!;
  return {
    ...state,
    status: "complete",
    winnerSide: otherSide(late),
    decisionMethod: "forfeit",
    deadlineAt: null,
    completedAt: nowSeconds,
  };
}
