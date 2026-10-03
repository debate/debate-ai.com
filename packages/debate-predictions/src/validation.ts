/**
 * @fileoverview Parses what the create, bet and resolve routes receive, and
 * the one rule for who may settle a market by hand.
 *
 * Each parser returns `{ ok: true, value }` or `{ ok: false, error }` with a
 * message fit to show the reader, so a route never builds its own.
 *
 * @module debate-predictions/validation
 */

import { MARKET_KINDS, MAX_OUTCOMES, MIN_STAKE } from "./types";
import type { ArgumentSettlement, ArgumentWager, MarketKind, MarketOutcome, MarketSource, MarketStatus, NewBet, NewMarket, ResolveRequest } from "./types";

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

export const TITLE_MAX = 140;
export const DESCRIPTION_MAX = 1000;
export const OUTCOME_LABEL_MAX = 80;
export const NOTE_MAX = 300;
/** Betting must stay open at least this long after creation. */
export const MIN_OPEN_SECONDS = 5 * 60;
/** And close within a year. */
export const MAX_OPEN_SECONDS = 365 * 24 * 60 * 60;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalId(value: unknown): number | null | undefined {
  if (value === undefined || value === null || value === "") return null;
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : undefined;
}

/** A parsed create request: the market minus what the server fills in. */
export interface ParsedNewMarket {
  kind: MarketKind;
  title: string;
  description: string;
  /** Manual outcome labels, already de-duplicated; empty when the source supplies them. */
  outcomes: string[];
  closesAt: number;
  tabroomPanelId: number | null;
  tabroomEventId: number | null;
  rating: { dataset: string; hash: string } | null;
}

/** Validates a create request against `now` (Unix seconds). */
export function parseNewMarket(payload: unknown, now: number): Parsed<ParsedNewMarket> {
  if (!isRecord(payload)) return fail("Send the market as a JSON object.");
  const input = payload as Partial<NewMarket> & Record<string, unknown>;

  if (!MARKET_KINDS.includes(input.kind as MarketKind)) return fail("Pick a market type: debate, tournament or rating.");
  const kind = input.kind as MarketKind;

  const title = typeof input.title === "string" ? input.title.trim().replace(/\s+/g, " ") : "";
  if (title.length < 3) return fail("Give the market a title.");
  if (title.length > TITLE_MAX) return fail(`Keep the title under ${TITLE_MAX} characters.`);

  const description = typeof input.description === "string" ? input.description.trim() : "";
  if (description.length > DESCRIPTION_MAX) return fail(`Keep the description under ${DESCRIPTION_MAX} characters.`);

  const closesAt = Number(input.closesAt);
  if (!Number.isFinite(closesAt)) return fail("Pick when betting closes.");
  if (closesAt < now + MIN_OPEN_SECONDS) return fail("Betting has to stay open for at least five minutes.");
  if (closesAt > now + MAX_OPEN_SECONDS) return fail("Betting has to close within a year.");

  const tabroomPanelId = optionalId(input.tabroomPanelId);
  const tabroomEventId = optionalId(input.tabroomEventId);
  if (tabroomPanelId === undefined) return fail("That round id isn't valid.");
  if (tabroomEventId === undefined) return fail("That event id isn't valid.");

  let rating: ParsedNewMarket["rating"] = null;
  if (kind === "rating") {
    const raw = input.rating;
    if (!isRecord(raw) || typeof raw.dataset !== "string" || typeof raw.hash !== "string" || !raw.dataset || !raw.hash) {
      return fail("Pick the team whose rating the market is about.");
    }
    if (!/^[a-z_]{2,20}$/.test(raw.dataset) || !/^[0-9a-f]{16,128}$/i.test(raw.hash)) {
      return fail("That rankings entry isn't valid.");
    }
    rating = { dataset: raw.dataset, hash: raw.hash.toLowerCase() };
  }

  const linked = (kind === "debate" && tabroomPanelId !== null) || (kind === "tournament" && tabroomEventId !== null);
  let outcomes: string[] = [];
  if (kind !== "rating" && !linked) {
    if (!Array.isArray(input.outcomes)) return fail("List the outcomes people can bet on.");
    const seen = new Set<string>();
    for (const raw of input.outcomes) {
      if (typeof raw !== "string") return fail("Every outcome needs a name.");
      const label = raw.trim().replace(/\s+/g, " ");
      if (!label) continue;
      if (label.length > OUTCOME_LABEL_MAX) return fail(`Keep each outcome under ${OUTCOME_LABEL_MAX} characters.`);
      const key = label.toLowerCase();
      if (seen.has(key)) return fail(`"${label}" is listed twice.`);
      seen.add(key);
      outcomes.push(label);
    }
    if (kind === "debate" && outcomes.length !== 2) return fail("A debate market needs exactly two sides.");
    if (outcomes.length < 2) return fail("List at least two outcomes.");
    if (outcomes.length > MAX_OUTCOMES) return fail(`List at most ${MAX_OUTCOMES} outcomes.`);
  }

  return {
    ok: true,
    value: {
      kind,
      title,
      description,
      outcomes,
      closesAt: Math.floor(closesAt),
      tabroomPanelId: kind === "debate" ? tabroomPanelId : null,
      tabroomEventId: kind === "tournament" ? tabroomEventId : null,
      rating,
    },
  };
}

/** Outcome ids for hand-written labels: `o1`, `o2`, … */
export function manualOutcomes(labels: readonly string[]): MarketOutcome[] {
  return labels.map((label, index) => ({ id: `o${index + 1}`, label }));
}

/** Validates a bet against the market's outcomes and the bettor's balance. */
export function parseNewBet(payload: unknown, outcomes: readonly MarketOutcome[], balance: number): Parsed<NewBet> {
  if (!isRecord(payload)) return fail("Send the bet as a JSON object.");
  const outcomeId = payload.outcomeId;
  if (typeof outcomeId !== "string" || !outcomes.some((o) => o.id === outcomeId)) {
    return fail("Pick an outcome to bet on.");
  }
  const stake = Number(payload.stake);
  if (!Number.isInteger(stake) || stake < MIN_STAKE) return fail("Stake a whole number of points, at least 1.");
  if (stake > balance) return fail(`You only have ${balance} points.`);
  return { ok: true, value: { outcomeId, stake } };
}

/** Validates a manual resolution: an outcome id, or `null` to void. */
export function parseResolve(payload: unknown, outcomes: readonly MarketOutcome[]): Parsed<ResolveRequest> {
  if (!isRecord(payload)) return fail("Send the result as a JSON object.");
  const outcomeId = payload.outcomeId ?? null;
  if (outcomeId !== null && (typeof outcomeId !== "string" || !outcomes.some((o) => o.id === outcomeId))) {
    return fail("Pick the outcome that happened, or void the market.");
  }
  const note = typeof payload.note === "string" ? payload.note.trim().slice(0, NOTE_MAX) : "";
  return { ok: true, value: { outcomeId, note } };
}

/**
 * Who may settle a market by hand.
 *
 * - Moderators and admins, always — that is how a linked market whose data
 *   never arrives gets settled or voided.
 * - The creator of a `manual` market, but only while they hold no position
 *   in it: someone with points riding on a result does not get to call it.
 *
 * Linked (`tabroom-*`) and `rating` markets otherwise settle themselves.
 */
export function canResolveMarket(input: {
  status: MarketStatus;
  source: MarketSource;
  isCreator: boolean;
  isStaff: boolean;
  holdsPosition: boolean;
}): boolean {
  if (input.status !== "open") return false;
  if (input.isStaff) return true;
  return input.source.type === "manual" && input.isCreator && !input.holdsPosition;
}

/** Reads a stored `source` column back, falling back to `manual` for anything unreadable. */
export function readStoredSource(raw: string | null | undefined): MarketSource {
  if (!raw) return { type: "manual" };
  try {
    const value = JSON.parse(raw) as MarketSource;
    if (isRecord(value) && typeof value.type === "string") return value;
  } catch {
    // Fall through: an unreadable source settles by hand.
  }
  return { type: "manual" };
}

/** Reads a stored JSON array, or `fallback` for anything unreadable. */
export function readStoredArray<T>(raw: string | null | undefined, fallback: T[] = []): T[] {
  if (!raw) return fallback;
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? (value as T[]) : fallback;
  } catch {
    return fallback;
  }
}

const ROUND_ID = /^[\w.-]{1,80}$/;

function parseArgumentRef(input: Record<string, unknown>): Parsed<{ roundId: string; rowIndex: number; speech: string }> {
  const roundId = typeof input.roundId === "string" ? input.roundId : "";
  if (!ROUND_ID.test(roundId)) return fail("Save the round first so the argument has a round to belong to.");
  const rowIndex = Number(input.rowIndex);
  if (!Number.isInteger(rowIndex) || rowIndex < 0 || rowIndex > 10_000) return fail("That argument isn't on the flow.");
  const speech = typeof input.speech === "string" ? input.speech.trim() : "";
  if (!speech || speech.length > 20) return fail("Say which speech the argument was made in.");
  return { ok: true, value: { roundId, rowIndex, speech } };
}

function parseArgumentOutcome(value: unknown): "extended" | "dropped" | null {
  return value === "extended" || value === "dropped" ? value : null;
}

/** Validates a wager on a flowed argument. */
export function parseArgumentWager(payload: unknown): Parsed<ArgumentWager> {
  if (!isRecord(payload)) return fail("Send the wager as a JSON object.");
  const ref = parseArgumentRef(payload);
  if (!ref.ok) return ref;
  const outcomeId = parseArgumentOutcome(payload.outcomeId);
  if (!outcomeId) return fail("Pick extended or not extended.");
  const stake = Number(payload.stake);
  if (!Number.isInteger(stake) || stake < MIN_STAKE) return fail("Stake a whole number of points, at least 1.");
  const text = typeof payload.text === "string" ? payload.text.trim().replace(/\s+/g, " ").slice(0, 120) : "";
  if (!text) return fail("That argument is empty.");
  return { ok: true, value: { ...ref.value, text, outcomeId, stake } };
}

/** Validates a settlement of an argument market. */
export function parseArgumentSettlement(payload: unknown): Parsed<ArgumentSettlement> {
  if (!isRecord(payload)) return fail("Send the result as a JSON object.");
  const ref = parseArgumentRef(payload);
  if (!ref.ok) return ref;
  const outcomeId = parseArgumentOutcome(payload.outcomeId);
  if (!outcomeId) return fail("Pick extended or not extended.");
  return { ok: true, value: { ...ref.value, outcomeId } };
}

/**
 * Who may settle an argument market from the flow: a moderator, or anyone who
 * holds no position in it — the players have points riding on the answer.
 * The server cannot tell who was in the round, so this is a guard against the
 * wagerers calling their own bets, not against an outsider.
 */
export function canSettleArgument(input: { status: MarketStatus; isStaff: boolean; holdsPosition: boolean }): boolean {
  return input.status === "open" && (input.isStaff || !input.holdsPosition);
}
