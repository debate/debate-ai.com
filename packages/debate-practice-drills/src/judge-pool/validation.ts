/**
 * @fileoverview Request validation and the hire-request rules for the Judge
 * Pool API.
 *
 * Like `../practice-partners/validation.ts`, every option is checked against
 * the same lists the form draws from (`./types.ts`, `./season-calendar.ts`),
 * and nothing here talks to the database — whether the judge named on a hire
 * request is listed for that weekend is the route's question.
 *
 * @module debate-practice-rounds/judge-pool/validation
 */

import { PRACTICE_FORMATS, type PracticeFormat } from "../practice-partners/types";
import type { Parsed } from "../practice-partners/validation";
import { isSeasonWeekend, isUpcomingWeekend } from "./season-calendar";
import {
  MAX_HIRE_MESSAGE_LENGTH,
  MAX_JUDGE_STATES,
  MAX_JUDGE_WEEKENDS,
  MAX_OFFER_LENGTH,
  MAX_PHILOSOPHY_LENGTH,
  MAX_TOURNAMENT_NAME_LENGTH,
  US_STATES,
  type HireAction,
  type HireStatus,
  type JudgeListingInput,
  type NewHireRequest,
  type UsState,
} from "./types";

export type { Parsed };

const STATE_IDS = new Set<string>(US_STATES.map((state) => state.id));
const FORMAT_IDS = new Set<string>(PRACTICE_FORMATS.map((format) => format.id));

export function isUsState(value: unknown): value is UsState {
  return typeof value === "string" && STATE_IDS.has(value);
}

function parseText(raw: unknown, max: number, what: string): Parsed<string> {
  if (raw === undefined || raw === null) return { ok: true, value: "" };
  if (typeof raw !== "string") return { ok: false, error: `${what} must be text.` };
  const value = raw.trim();
  if (value.length > max) return { ok: false, error: `${what} is limited to ${max} characters.` };
  return { ok: true, value };
}

function parseList(raw: unknown, what: string): Parsed<string[]> {
  if (raw === undefined || raw === null) return { ok: true, value: [] };
  if (!Array.isArray(raw) || raw.some((item) => typeof item !== "string")) {
    return { ok: false, error: `${what} must be a list.` };
  }
  return { ok: true, value: [...new Set(raw as string[])] };
}

/**
 * Reads a judge listing.
 *
 * @param today - ISO day on the server, so "upcoming" is testable. Weekends
 *   that have already passed are refused: the list is "when you can judge",
 *   and a weekend in the past only clutters the pool.
 */
export function parseJudgeListing(raw: unknown, today: string): Parsed<JudgeListingInput> {
  const body = (raw ?? {}) as Record<string, unknown>;
  const active = body.active !== false;

  const weekends = parseList(body.weekends, "Weekends");
  if (!weekends.ok) return weekends;
  const unknownWeekend = weekends.value.find((key) => !isSeasonWeekend(key));
  if (unknownWeekend !== undefined) return { ok: false, error: `${unknownWeekend} is not a weekend on the circuit calendar.` };
  if (weekends.value.some((key) => !isUpcomingWeekend(key, today))) {
    return { ok: false, error: "Pick weekends that haven't happened yet." };
  }
  if (weekends.value.length > MAX_JUDGE_WEEKENDS) {
    return { ok: false, error: `Pick up to ${MAX_JUDGE_WEEKENDS} weekends.` };
  }

  const states = parseList(body.states, "States");
  if (!states.ok) return states;
  const unknownState = states.value.find((id) => !STATE_IDS.has(id));
  if (unknownState !== undefined) return { ok: false, error: `Unknown state: ${unknownState}.` };
  if (states.value.length > MAX_JUDGE_STATES) {
    return { ok: false, error: `List up to ${MAX_JUDGE_STATES} states.` };
  }

  const formats = parseList(body.formats, "Formats");
  if (!formats.ok) return formats;
  const unknownFormat = formats.value.find((id) => !FORMAT_IDS.has(id));
  if (unknownFormat !== undefined) return { ok: false, error: `Unknown format: ${unknownFormat}.` };

  const philosophy = parseText(body.philosophy, MAX_PHILOSOPHY_LENGTH, "Your judge philosophy");
  if (!philosophy.ok) return philosophy;

  if (active) {
    if (weekends.value.length === 0) return { ok: false, error: "Pick at least one weekend you can judge." };
    if (states.value.length === 0) return { ok: false, error: "Pick the state you're in." };
    if (formats.value.length === 0) return { ok: false, error: "Pick at least one format you judge." };
  }

  return {
    ok: true,
    value: {
      active,
      weekends: [...weekends.value].sort(),
      states: states.value as UsState[],
      canTravel: body.canTravel === true,
      formats: formats.value as PracticeFormat[],
      philosophy: philosophy.value,
    },
  };
}

/** The listing's list columns as stored, read back leniently: unknown ids are dropped. */
export function readStoredList<T extends string>(json: string | null, known: (value: unknown) => value is T): T[] {
  try {
    const parsed: unknown = JSON.parse(json ?? "[]");
    return Array.isArray(parsed) ? [...new Set(parsed.filter(known))] : [];
  } catch {
    return [];
  }
}

export function isPracticeFormatId(value: unknown): value is PracticeFormat {
  return typeof value === "string" && FORMAT_IDS.has(value);
}

/** Reads a new hire request. */
export function parseHireRequest(raw: unknown, today: string): Parsed<NewHireRequest> {
  const body = (raw ?? {}) as Record<string, unknown>;
  if (typeof body.judgeId !== "string" || body.judgeId.length === 0) {
    return { ok: false, error: "Pick a judge to hire." };
  }
  if (!isSeasonWeekend(body.weekend) || !isUpcomingWeekend(body.weekend, today)) {
    return { ok: false, error: "Pick one of the judge's upcoming weekends." };
  }
  const tournamentName = parseText(body.tournamentName, MAX_TOURNAMENT_NAME_LENGTH, "The tournament name");
  if (!tournamentName.ok) return tournamentName;
  if (tournamentName.value.length === 0) return { ok: false, error: "Name the tournament you're hiring for." };
  const offer = parseText(body.offer, MAX_OFFER_LENGTH, "The pay offer");
  if (!offer.ok) return offer;
  const message = parseText(body.message, MAX_HIRE_MESSAGE_LENGTH, "Your message");
  if (!message.ok) return message;
  return {
    ok: true,
    value: {
      judgeId: body.judgeId,
      weekend: body.weekend,
      tournamentName: tournamentName.value,
      offer: offer.value,
      message: message.value,
    },
  };
}

const HIRE_ACTIONS = new Set<string>(["accept", "decline", "cancel"]);

export function parseHireAction(raw: unknown): Parsed<HireAction> {
  const action = (raw as { action?: unknown } | null)?.action;
  if (typeof action !== "string" || !HIRE_ACTIONS.has(action)) return { ok: false, error: "Unknown action." };
  return { ok: true, value: action as HireAction };
}

/** The UUIDs the API mints, checked before an id costs a query. */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseHireId(raw: unknown): Parsed<string> {
  if (typeof raw !== "string" || !UUID_PATTERN.test(raw)) return { ok: false, error: "That is not a hire request." };
  return { ok: true, value: raw.toLowerCase() };
}

/** The parts of a hire request its rules read. */
export interface HireState {
  status: HireStatus;
  organizerId: string;
  judgeId: string;
}

export type HireActionResult =
  | { ok: true; status: HireStatus }
  | { ok: false; code: 403 | 409; error: string };

/**
 * Who may do what to a hire request. The PATCH route enforces it and the
 * board reads it (through {@link availableHireActions}) to pick its buttons.
 *
 * - The judge accepts or declines a pending request.
 * - The organizer cancels a pending request; either side cancels an accepted one.
 */
export function applyHireAction(state: HireState, viewerId: string, action: HireAction): HireActionResult {
  const isJudge = viewerId === state.judgeId;
  const isOrganizer = viewerId === state.organizerId;
  if (!isJudge && !isOrganizer) return { ok: false, code: 403, error: "That hire request isn't yours." };

  switch (action) {
    case "accept":
    case "decline":
      if (!isJudge) return { ok: false, code: 403, error: "Only the judge can answer a hire request." };
      if (state.status !== "pending") return { ok: false, code: 409, error: "That request has already been answered." };
      return { ok: true, status: action === "accept" ? "accepted" : "declined" };
    case "cancel":
      if (state.status === "pending" && isOrganizer) return { ok: true, status: "cancelled" };
      if (state.status === "accepted") return { ok: true, status: "cancelled" };
      if (state.status === "pending") return { ok: false, code: 403, error: "Decline the request instead." };
      return { ok: false, code: 409, error: "That request is already closed." };
  }
}

/** The actions `viewerId` may take on a request right now. */
export function availableHireActions(state: HireState, viewerId: string): HireAction[] {
  return (["accept", "decline", "cancel"] as const).filter((action) => applyHireAction(state, viewerId, action).ok);
}
