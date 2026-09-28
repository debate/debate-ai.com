/**
 * @fileoverview Request validation for the Practice Partners API.
 *
 * Every option a profile or challenge can carry is checked against the lists
 * in `debate-webview/lib/practice-partners/types.ts` — the same lists the form
 * draws its chips from — so the board can never be handed a style it has no
 * label for. Nothing here talks to the database: whether the named opponent is
 * actually open to challenges is the route's question, since it needs a query.
 *
 * @module lib/practice-partners/validation
 */

import {
  DEFAULT_PRACTICE_PROFILE,
  MAX_AVAILABILITY_LENGTH,
  MAX_CHALLENGE_MESSAGE_LENGTH,
  MAX_PROFILE_NOTE_LENGTH,
  MAX_TOPIC_LENGTH,
  PRACTICE_FORMATS,
  PRACTICE_LEVELS,
  PRACTICE_SPEEDS,
  PRACTICE_STYLES,
  type PracticeFormat,
  type PracticeLevel,
  type PracticePreferences,
  type PracticeProfileInput,
  type PracticeSpeed,
  type PracticeStyle,
} from "debate-webview/lib/practice-partners/types";
import type { Parsed } from "@/lib/comments/validation";

export type { Parsed };

/** How far ahead a challenge may propose a round: one season. */
const MAX_PROPOSAL_AHEAD_SECONDS = 180 * 24 * 60 * 60;
/**
 * How far in the past a proposed time may be. Not zero: a debater filling in
 * "tonight at 7" at 6:59 should not be told their round is in the past because
 * the request took a second to arrive.
 */
const PROPOSAL_GRACE_SECONDS = 60 * 60;

const ids = (options: readonly { id: string }[]) => new Set(options.map((option) => option.id));
const FORMAT_IDS = ids(PRACTICE_FORMATS);
const STYLE_IDS = ids(PRACTICE_STYLES);
const SPEED_IDS = ids(PRACTICE_SPEEDS);
const LEVEL_IDS = ids(PRACTICE_LEVELS);

export function isPracticeFormat(value: unknown): value is PracticeFormat {
  return typeof value === "string" && FORMAT_IDS.has(value);
}

/** A list of ids from one option set, de-duplicated, or the first unknown one. */
function parseIdList<T extends string>(raw: unknown, known: Set<string>, what: string): Parsed<T[]> {
  if (raw === undefined || raw === null) return { ok: true, value: [] };
  if (!Array.isArray(raw)) return { ok: false, error: `${what} must be a list.` };
  const unknown = raw.find((item) => typeof item !== "string" || !known.has(item));
  if (unknown !== undefined) return { ok: false, error: `Unknown ${what.toLowerCase()}: ${String(unknown)}.` };
  return { ok: true, value: [...new Set(raw as T[])] };
}

function parseText(raw: unknown, max: number, what: string): Parsed<string> {
  if (raw === undefined || raw === null) return { ok: true, value: "" };
  if (typeof raw !== "string") return { ok: false, error: `${what} must be text.` };
  const value = raw.trim();
  if (value.length > max) return { ok: false, error: `${what} is limited to ${max} characters.` };
  return { ok: true, value };
}

/**
 * Reads a practice profile. At least one format is required once either role
 * is on — a volunteer with no format is someone nobody can schedule — but a
 * profile with both roles off may be saved half-filled, since it is only a
 * draft of preferences until it is switched on.
 */
export function parseProfile(raw: unknown): Parsed<PracticeProfileInput> {
  const body = (raw ?? {}) as Record<string, unknown>;

  const asCompetitor = body.asCompetitor === true;
  const asJudge = body.asJudge === true;

  const formats = parseIdList<PracticeFormat>(body.formats, FORMAT_IDS, "Formats");
  if (!formats.ok) return formats;
  const styles = parseIdList<PracticeStyle>(body.styles, STYLE_IDS, "Styles");
  if (!styles.ok) return styles;

  if (typeof body.speed !== "string" || !SPEED_IDS.has(body.speed)) {
    return { ok: false, error: "Pick a speed you're comfortable with." };
  }
  if (typeof body.level !== "string" || !LEVEL_IDS.has(body.level)) {
    return { ok: false, error: "Pick your experience level." };
  }

  const availability = parseText(body.availability, MAX_AVAILABILITY_LENGTH, "Availability");
  if (!availability.ok) return availability;
  const note = parseText(body.note, MAX_PROFILE_NOTE_LENGTH, "Your note");
  if (!note.ok) return note;

  if ((asCompetitor || asJudge) && formats.value.length === 0) {
    return { ok: false, error: "Pick at least one format so people know what to challenge you to." };
  }

  return {
    ok: true,
    value: {
      asCompetitor,
      asJudge,
      formats: formats.value,
      styles: styles.value,
      speed: body.speed as PracticeSpeed,
      level: body.level as PracticeLevel,
      availability: availability.value,
      note: note.value,
    },
  };
}

/**
 * Reads the stored `preferences` JSON back into shape.
 *
 * Lenient where {@link parseProfile} is strict: a row written before an option
 * was retired must still render, so unknown ids are dropped and a bad field
 * falls back to its default rather than failing the whole board.
 */
export function readStoredPreferences(json: string): PracticePreferences {
  let raw: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(json);
    if (parsed && typeof parsed === "object") raw = parsed as Record<string, unknown>;
  } catch {
    // Fall through to the defaults.
  }
  const list = <T extends string>(value: unknown, known: Set<string>): T[] =>
    Array.isArray(value) ? [...new Set(value.filter((item): item is T => typeof item === "string" && known.has(item)))] : [];
  const text = (value: unknown) => (typeof value === "string" ? value : "");

  return {
    formats: list<PracticeFormat>(raw.formats, FORMAT_IDS),
    styles: list<PracticeStyle>(raw.styles, STYLE_IDS),
    speed: typeof raw.speed === "string" && SPEED_IDS.has(raw.speed) ? (raw.speed as PracticeSpeed) : DEFAULT_PRACTICE_PROFILE.speed,
    level: typeof raw.level === "string" && LEVEL_IDS.has(raw.level) ? (raw.level as PracticeLevel) : DEFAULT_PRACTICE_PROFILE.level,
    availability: text(raw.availability),
    note: text(raw.note),
  };
}

/** The preferences half of a profile, as the JSON the table stores. */
export function storedPreferences(profile: PracticePreferences): string {
  const { formats, styles, speed, level, availability, note } = profile;
  return JSON.stringify({ formats, styles, speed, level, availability, note });
}

/** A challenge as the route receives it, validated but not yet checked against the database. */
export interface ParsedChallenge {
  opponentId: string;
  judgeId: string | null;
  format: PracticeFormat;
  topic: string;
  message: string;
  /** Unix seconds, or `null`. */
  proposedAt: number | null;
}

/**
 * Reads a new challenge.
 *
 * @param nowSeconds - The server's clock, passed in so the time window is testable.
 */
export function parseNewChallenge(raw: unknown, nowSeconds: number): Parsed<ParsedChallenge> {
  const body = (raw ?? {}) as Record<string, unknown>;

  if (typeof body.opponentId !== "string" || body.opponentId.length === 0) {
    return { ok: false, error: "Pick someone to challenge." };
  }
  const judgeId =
    body.judgeId === undefined || body.judgeId === null || body.judgeId === "" ? null : body.judgeId;
  if (judgeId !== null && typeof judgeId !== "string") {
    return { ok: false, error: "That judge could not be found." };
  }
  if (judgeId !== null && (judgeId === body.opponentId)) {
    return { ok: false, error: "Your opponent can't also judge the round." };
  }

  if (!isPracticeFormat(body.format)) {
    return { ok: false, error: "Pick a format for the round." };
  }

  const topic = parseText(body.topic, MAX_TOPIC_LENGTH, "The resolution");
  if (!topic.ok) return topic;
  if (topic.value.length === 0) {
    return { ok: false, error: "Name the resolution (or “open” to decide together)." };
  }

  const message = parseText(body.message, MAX_CHALLENGE_MESSAGE_LENGTH, "Your message");
  if (!message.ok) return message;

  let proposedAt: number | null = null;
  if (body.proposedAt !== undefined && body.proposedAt !== null && body.proposedAt !== "") {
    const value = Number(body.proposedAt);
    if (!Number.isInteger(value)) {
      return { ok: false, error: "That start time could not be read." };
    }
    if (value < nowSeconds - PROPOSAL_GRACE_SECONDS) {
      return { ok: false, error: "Pick a start time that hasn't passed." };
    }
    if (value > nowSeconds + MAX_PROPOSAL_AHEAD_SECONDS) {
      return { ok: false, error: "Pick a start time within the next six months." };
    }
    proposedAt = value;
  }

  return {
    ok: true,
    value: { opponentId: body.opponentId, judgeId, format: body.format, topic: topic.value, message: message.value, proposedAt },
  };
}

/** The UUIDs the API mints, checked before an id costs a query. */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseChallengeId(raw: unknown): Parsed<string> {
  if (typeof raw !== "string" || !UUID_PATTERN.test(raw)) {
    return { ok: false, error: "That is not a practice challenge." };
  }
  return { ok: true, value: raw.toLowerCase() };
}

/**
 * The webcam room code for a challenge: `practice-` and the first block of its
 * id. Eight hex characters is 4 billion rooms — plenty for a room that only
 * matters while three people are in it — and short enough to read aloud.
 */
export function roomIdForChallenge(challengeId: string): string {
  return `practice-${challengeId.slice(0, 8).toLowerCase()}`;
}
