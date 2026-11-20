/**
 * @fileoverview The rules of a rebuttal drill — pairing, who may do what, and
 * when a drill goes to the judge. The one copy of them: the API runs these
 * against the stored row and writes what they return, and the page runs
 * {@link availableDrillMoves} to decide which buttons to draw.
 *
 * Both rebuttals are written independently (each side redoes its own last
 * rebuttal of the same video), so there are no turns: either side may turn
 * theirs in at any point once they are in the drill — even while still
 * waiting for a partner, so nobody's practice waits on someone else.
 *
 * Pure: no database, no clock (every function takes `nowSeconds`), no names.
 *
 * @module debate-practice-rounds/rebuttal-playlists/rules
 */

import { otherSide } from "../debate-challenges/types";
import {
  AI_PARTNER_ID,
  MAX_COACH_USES,
  MAX_REBUTTAL_LENGTH,
  MIN_REBUTTAL_LENGTH,
  PARTNER_WAIT_SECONDS,
  type DrillSide,
  type RebuttalDrillAction,
  type RebuttalDrillStatus,
} from "./types";

/** The parts of a drill the rules read and write. */
export interface DrillState {
  status: RebuttalDrillStatus;
  creatorId: string;
  creatorSide: DrillSide;
  /** An account id, {@link AI_PARTNER_ID}, or `null` while waiting for a partner. */
  partnerId: string | null;
  creatorText: string;
  partnerText: string;
  creatorCoachUses: number;
  partnerCoachUses: number;
  winnerSide: DrillSide | null;
  /** Unix seconds. */
  createdAt: number;
  completedAt: number | null;
}

export type DrillMoveResult =
  | {
      ok: true;
      next: DrillState;
      /** Human debaters who should hear about it — never the actor, never the AI. */
      notify: string[];
    }
  | { ok: false; status: 400 | 403 | 409 | 429; error: string };

const forbidden = (error: string): DrillMoveResult => ({ ok: false, status: 403, error });
const conflict = (error: string): DrillMoveResult => ({ ok: false, status: 409, error });

export const DRILL_ACTIONS: readonly RebuttalDrillAction[] = ["submit", "coach", "use_ai", "cancel"];

export function isVsAi(state: Pick<DrillState, "partnerId">): boolean {
  return state.partnerId === AI_PARTNER_ID;
}

/** The side `playerId` redoes, or `null` when they are not in the drill. */
export function drillSideOf(state: DrillState, playerId: string): DrillSide | null {
  if (playerId === state.creatorId) return state.creatorSide;
  if (state.partnerId !== null && playerId === state.partnerId) return otherSide(state.creatorSide);
  return null;
}

/** Who holds `side`: an account id, {@link AI_PARTNER_ID}, or `null` when nobody yet. */
export function seatHolder(state: DrillState, side: DrillSide): string | null {
  return side === state.creatorSide ? state.creatorId : state.partnerId;
}

/** The rebuttal given for `side` so far ("" when none). */
export function seatText(state: DrillState, side: DrillSide): string {
  return side === state.creatorSide ? state.creatorText : state.partnerText;
}

/** Coach requests used on `side`. */
export function seatCoachUses(state: DrillState, side: DrillSide): number {
  return side === state.creatorSide ? state.creatorCoachUses : state.partnerCoachUses;
}

/** Why a rebuttal would be refused, or `null` when it is fine. */
export function rebuttalError(text: unknown): string | null {
  if (typeof text !== "string") return "Write your rebuttal first.";
  const trimmed = text.trim();
  if (trimmed.length < MIN_REBUTTAL_LENGTH) return `A rebuttal needs at least ${MIN_REBUTTAL_LENGTH} characters.`;
  if (trimmed.length > MAX_REBUTTAL_LENGTH) {
    return `A rebuttal can be at most ${MAX_REBUTTAL_LENGTH.toLocaleString("en-US")} characters.`;
  }
  return null;
}

/** A fresh drill: waiting for a partner, or paired with the AI straight away. */
export function createDrill(
  input: { creatorId: string; side: DrillSide; vsAi: boolean },
  nowSeconds: number,
): DrillState {
  return {
    status: input.vsAi ? "writing" : "waiting",
    creatorId: input.creatorId,
    creatorSide: input.side,
    partnerId: input.vsAi ? AI_PARTNER_ID : null,
    creatorText: "",
    partnerText: "",
    creatorCoachUses: 0,
    partnerCoachUses: 0,
    winnerSide: null,
    createdAt: nowSeconds,
    completedAt: null,
  };
}

/**
 * Whether `joinerId` may take the open side of this drill to redo `side`: it
 * is still waiting, was started by someone else, is open on exactly that side,
 * and has not sat longer than {@link PARTNER_WAIT_SECONDS}.
 */
export function canJoinDrill(state: DrillState, joinerId: string, side: DrillSide, nowSeconds: number): boolean {
  return (
    state.status === "waiting" &&
    state.partnerId === null &&
    state.creatorId !== joinerId &&
    side === otherSide(state.creatorSide) &&
    nowSeconds - state.createdAt < PARTNER_WAIT_SECONDS
  );
}

/** Seats `joinerId` on the open side. If the starter already turned theirs in, the drill waits only on the joiner. */
export function joinDrill(state: DrillState, joinerId: string): DrillState {
  return { ...state, partnerId: joinerId, status: "writing" };
}

/**
 * Picks the drill a new debater should join: the oldest joinable one, skipping
 * anyone in `blocked`. Pairing first-come-first-served keeps the longest
 * waiter from being starved by newer ones.
 */
export function pickPartnerDrill<T extends { state: DrillState }>(
  candidates: readonly T[],
  joinerId: string,
  side: DrillSide,
  nowSeconds: number,
  blocked: ReadonlySet<string> = new Set(),
): T | null {
  const open = candidates
    .filter((entry) => canJoinDrill(entry.state, joinerId, side, nowSeconds) && !blocked.has(entry.state.creatorId))
    .sort((a, b) => a.state.createdAt - b.state.createdAt);
  return open[0] ?? null;
}

/** Puts `text` on `side` and sends the drill to the judge when both rebuttals are in. */
function withRebuttal(state: DrillState, side: DrillSide, text: string): DrillState {
  const next =
    side === state.creatorSide ? { ...state, creatorText: text.trim() } : { ...state, partnerText: text.trim() };
  const bothIn = next.creatorText !== "" && next.partnerText !== "" && next.partnerId !== null;
  return bothIn ? { ...next, status: "judging" } : next;
}

const open = (state: DrillState) => state.status === "waiting" || state.status === "writing";

/** The humans in a drill other than `actorId`. */
function audience(state: DrillState, actorId: string): string[] {
  return [state.creatorId, state.partnerId].filter(
    (id): id is string => typeof id === "string" && id !== actorId && id !== AI_PARTNER_ID,
  );
}

/**
 * Applies one move by one debater.
 *
 * - `submit` — turns in the actor's rebuttal (once). The second one in sends the drill to the judge.
 * - `coach` — spends one of the side's {@link MAX_COACH_USES} coach requests on a draft (the route asks the model).
 * - `use_ai` — the starter stops waiting and takes the AI as their partner.
 * - `cancel` — the starter withdraws a drill nobody has joined. Their rebuttal, if any, is dropped with it.
 */
export function applyDrillMove(
  state: DrillState,
  actorId: string,
  action: RebuttalDrillAction,
  nowSeconds: number,
  text?: string,
): DrillMoveResult {
  const side = drillSideOf(state, actorId);
  if (!side) return forbidden("You are not in this drill.");

  switch (action) {
    case "submit": {
      if (!open(state)) return conflict("This drill is over.");
      if (seatText(state, side)) return conflict("You already turned in your rebuttal.");
      const error = rebuttalError(text);
      if (error) return { ok: false, status: 400, error };
      const next = withRebuttal(state, side, text!);
      return { ok: true, next, notify: next.status === "judging" ? audience(state, actorId) : [] };
    }

    case "coach": {
      if (!open(state)) return conflict("This drill is over.");
      if (seatText(state, side)) return conflict("Your rebuttal is already in.");
      if (typeof text !== "string" || text.trim().length < 20) {
        return { ok: false, status: 400, error: "Write a little of your rebuttal first, then ask the coach." };
      }
      if (text.trim().length > MAX_REBUTTAL_LENGTH) return { ok: false, status: 400, error: "That draft is too long." };
      if (seatCoachUses(state, side) >= MAX_COACH_USES) {
        return { ok: false, status: 429, error: `You've used all ${MAX_COACH_USES} coach requests on this drill.` };
      }
      const next =
        side === state.creatorSide
          ? { ...state, creatorCoachUses: state.creatorCoachUses + 1 }
          : { ...state, partnerCoachUses: state.partnerCoachUses + 1 };
      return { ok: true, next, notify: [] };
    }

    case "use_ai": {
      if (actorId !== state.creatorId) return forbidden("Only the debater who started the drill can switch to the AI.");
      if (state.status !== "waiting") return conflict("A partner already took the other side.");
      return { ok: true, next: { ...state, partnerId: AI_PARTNER_ID, status: "writing" }, notify: [] };
    }

    case "cancel": {
      if (actorId !== state.creatorId) return forbidden("Only the debater who started the drill can cancel it.");
      if (state.status !== "waiting") return conflict("Once a partner joins, the drill can't be cancelled.");
      return { ok: true, next: { ...state, status: "cancelled", completedAt: nowSeconds }, notify: [] };
    }
  }
}

/** The moves `viewerId` may make right now, in {@link DRILL_ACTIONS} order (text-taking moves checked with a placeholder). */
export function availableDrillMoves(state: DrillState, viewerId: string, nowSeconds: number): RebuttalDrillAction[] {
  const placeholder = "x".repeat(MIN_REBUTTAL_LENGTH);
  return DRILL_ACTIONS.filter((action) => applyDrillMove(state, viewerId, action, nowSeconds, placeholder).ok);
}

/** Whether the AI partner still owes its rebuttal. */
export function aiOwesRebuttal(state: DrillState): boolean {
  return isVsAi(state) && state.partnerText === "" && open(state);
}

/** The AI partner's rebuttal. */
export function applyAiRebuttal(state: DrillState, text: string): DrillState | null {
  if (!aiOwesRebuttal(state) || !text.trim()) return null;
  return withRebuttal(state, otherSide(state.creatorSide), text);
}

/** The judge's decision on a drill with both rebuttals in. */
export function applyDrillDecision(state: DrillState, winnerSide: DrillSide, nowSeconds: number): DrillState | null {
  if (state.status !== "judging") return null;
  return { ...state, status: "complete", winnerSide, completedAt: nowSeconds };
}
