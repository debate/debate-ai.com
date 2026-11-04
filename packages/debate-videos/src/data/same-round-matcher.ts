/**
 * @fileoverview Finds videos that are the same debate round — the same round
 * uploaded by two channels, a round split into "Part 1" / "Part 2", or one
 * upload per speech ("1AC and 1NC", "2NC", "2NR", "Decision") — from the round
 * metadata every row already carries, so they can share one stacked playlist.
 *
 * The description-link rule in `video-stacks.ts` only catches videos whose
 * uploader linked them together. Most same-round uploads never do: Exodus
 * Files posts a final as seven speech videos, CEDADebate splits a round across
 * several uploads with identical titles, and Lincoln Garrett re-uploads whole
 * NDT rounds months after the streams. This module pairs those by what they
 * are rather than by what they link to.
 *
 * **Two videos are the same round when all of these hold:**
 *
 * 1. Both teams match, in either order (aff/neg is often swapped or missing
 *    between uploads). Teams match on their trailing entry code ("GS", "LL")
 *    plus a compatible school ("Berkeley SW" = "Cal Berkeley SW"); a name with
 *    no short code has to match in full.
 * 2. The round is the same level (`R8`, `QUARTERS`, …) — read from
 *    `roundLevel`, else from the title. Two rows whose round cannot be read
 *    only match when they list the teams on the same sides and were published
 *    within {@link UNKNOWN_ROUND_WINDOW_MS} of each other, since the same two
 *    teams can meet twice in a tournament.
 * 3. The tournaments agree: their names share a word once years and filler
 *    are removed ("NDT 2021" ~ "2021 NDT"), or one of them is unknown.
 * 4. Same competition season, or published within
 *    {@link SAME_ROUND_PUBLISH_WINDOW_MS} of each other.
 * 5. Same debate style, when both rows know it.
 *
 * Kept free of SQL and React so the rule runs the same in the JSON seed, the
 * live-table recompute job and the tests.
 * @module data/same-round-matcher
 */

import { standardizeRoundLevel, type StandardRoundLevel } from "./round-level";

/** The round metadata the matcher reads. Every field is optional. */
export interface SameRoundFields {
  videoId: string;
  title?: string | null;
  style?: number | null;
  tournament?: string | null;
  roundLevel?: string | null;
  affTeam?: string | null;
  negTeam?: string | null;
  seasonYear?: number | null;
  publishedMs?: number | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Publish gap that still counts as one round when the seasons disagree or are unknown. */
export const SAME_ROUND_PUBLISH_WINDOW_MS = 60 * DAY_MS;

/** Publish gap within which two rows of unreadable round level may still pair. */
export const UNKNOWN_ROUND_WINDOW_MS = 7 * DAY_MS;

/** Words that say nothing about which tournament a name refers to. */
const TOURNAMENT_FILLER = new Set([
  "the",
  "of",
  "at",
  "and",
  "round",
  "rd",
  "debate",
  "debates",
  "tournament",
  "invitational",
  "invite",
  "nationals",
  "nats",
  "national",
  "championship",
  "championships",
  "finals",
  "final",
  "semis",
  "quarters",
  "octos",
  "doubles",
  "elims",
  "prelims",
  "policy",
  "college",
  "high",
  "school",
]);

/** Words a school name can carry or drop without becoming another school. */
const SCHOOL_FILLER = new Set(["the", "of", "university", "univ", "college", "u", "school", "high", "hs"]);

function words(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

/** A team name split into its school words and its trailing entry code. */
export interface TeamKey {
  /** Trailing entry code ("gs", "ll") or, for a code-less name, the last word. */
  code: string;
  /** Remaining words, filler removed. */
  school: string[];
  /** Whether {@link TeamKey.code} looks like an entry code (1–3 letters). */
  hasCode: boolean;
}

/**
 * Normalizes a team label for matching: lower-cased, side markers ("(Aff)"),
 * judge credits ("Judge: Nic Nave") and punctuation removed.
 *
 * @returns The team key, or `null` when nothing usable is left.
 */
export function teamKey(team: string | null | undefined): TeamKey | null {
  if (!team) return null;
  const cleaned = team
    .replace(/\bjudge\s*:.*$/i, "")
    .replace(/\((?:aff|neg|affirmative|negative|pro|con)\)/gi, "")
    .replace(/\b(?:aff|neg)\s*:/gi, "");
  const parts = words(cleaned).filter((word) => !["aff", "neg", "affirmative", "negative"].includes(word));
  if (parts.length === 0) return null;
  const code = parts[parts.length - 1];
  return {
    code,
    hasCode: /^[a-z]{1,3}$/.test(code),
    school: parts.slice(0, -1).filter((word) => !SCHOOL_FILLER.has(word)),
  };
}

/**
 * Whether two team labels name the same entry.
 *
 * Codes must agree. A real entry code then needs the schools to be
 * compatible — one's words contained in the other's — so "Berkeley SW"
 * matches "Cal Berkeley SW" but "Kansas BR" never matches "Emory BR". A label
 * with no short code must agree word for word.
 */
export function sameTeam(a: TeamKey | null, b: TeamKey | null): boolean {
  if (!a || !b || a.code !== b.code) return false;
  const aSchool = a.school.join(" ");
  const bSchool = b.school.join(" ");
  if (aSchool === bSchool) return true;
  if (!a.hasCode) return false;
  if (a.school.length === 0 || b.school.length === 0) return false;
  const [shorter, longer] = a.school.length <= b.school.length ? [a.school, b.school] : [b.school, a.school];
  const pool = new Set(longer);
  return shorter.every((word) => pool.has(word));
}

/** Tournament words that identify it, years and filler removed. */
export function tournamentWords(tournament: string | null | undefined): Set<string> {
  if (!tournament) return new Set();
  return new Set(
    words(tournament).filter((word) => !/^\d+$/.test(word) && !/^r\d+$/.test(word) && !TOURNAMENT_FILLER.has(word)),
  );
}

/** The round level of a row: its `roundLevel` column, else read from its title. */
export function roundLevelOf(row: SameRoundFields): StandardRoundLevel {
  const fromColumn = standardizeRoundLevel(row.roundLevel);
  if (fromColumn !== "UNKNOWN") return fromColumn;
  return standardizeRoundLevel(row.title);
}

interface Prepared {
  id: string;
  aff: TeamKey;
  neg: TeamKey;
  round: StandardRoundLevel;
  tournament: Set<string>;
  style: number | null;
  season: number;
  publishedMs: number;
}

function prepare(row: SameRoundFields): Prepared | null {
  const aff = teamKey(row.affTeam);
  const neg = teamKey(row.negTeam);
  if (!aff || !neg) return null;
  return {
    id: row.videoId,
    aff,
    neg,
    round: roundLevelOf(row),
    tournament: tournamentWords(row.tournament),
    style: row.style ?? null,
    season: row.seasonYear ?? 0,
    publishedMs: row.publishedMs ?? 0,
  };
}

function publishGap(a: Prepared, b: Prepared): number {
  if (a.publishedMs <= 0 || b.publishedMs <= 0) return Number.POSITIVE_INFINITY;
  return Math.abs(a.publishedMs - b.publishedMs);
}

function sameRound(a: Prepared, b: Prepared): boolean {
  if (a.style !== null && b.style !== null && a.style !== b.style) return false;

  const sameSides = sameTeam(a.aff, b.aff) && sameTeam(a.neg, b.neg);
  const swappedSides = sameTeam(a.aff, b.neg) && sameTeam(a.neg, b.aff);
  if (!sameSides && !swappedSides) return false;

  const gap = publishGap(a, b);
  if (a.round === "UNKNOWN" || b.round === "UNKNOWN") {
    // Without a round level the side order is the only thing telling two
    // meetings apart ("Kansas BR vs Berkeley SW" and "Berkeley SW vs Kansas
    // BR", uploaded the same day, are two rounds), so it has to agree.
    if (a.round !== b.round || !sameSides || gap > UNKNOWN_ROUND_WINDOW_MS) return false;
  } else if (a.round !== b.round) {
    return false;
  }

  if (a.tournament.size > 0 && b.tournament.size > 0) {
    let shared = false;
    for (const word of a.tournament) if (b.tournament.has(word)) shared = true;
    if (!shared) return false;
  }

  const sameSeason = a.season > 0 && a.season === b.season;
  return sameSeason || gap <= SAME_ROUND_PUBLISH_WINDOW_MS;
}

/**
 * Pairs of rows that record the same round.
 *
 * Rows are bucketed by their two team codes first, so only rows that could
 * possibly match are compared — the library is compared in near-linear time
 * rather than every row against every other.
 *
 * @param rows - Every row in the library; rows without both teams are skipped.
 * @returns `[videoId, videoId]` pairs, each pair once.
 */
export function findSameRoundPairs(rows: SameRoundFields[]): Array<[string, string]> {
  const buckets = new Map<string, Prepared[]>();
  for (const row of rows) {
    const prepared = prepare(row);
    if (!prepared) continue;
    const key = [prepared.aff.code, prepared.neg.code].sort().join("|");
    const bucket = buckets.get(key);
    if (bucket) bucket.push(prepared);
    else buckets.set(key, [prepared]);
  }

  const pairs: Array<[string, string]> = [];
  for (const bucket of buckets.values()) {
    for (let i = 0; i < bucket.length; i++) {
      for (let j = i + 1; j < bucket.length; j++) {
        if (bucket[i].id !== bucket[j].id && sameRound(bucket[i], bucket[j])) {
          pairs.push([bucket[i].id, bucket[j].id]);
        }
      }
    }
  }
  return pairs;
}

/** Speech names in debate order, so a stack of per-speech uploads plays in order. */
const SPEECH_ORDER: Array<[RegExp, number, string]> = [
  [/\b1ac\b/i, 1, "1AC"],
  [/\b1nc\b/i, 2, "1NC"],
  [/\b2ac\b/i, 3, "2AC"],
  [/\b2nc\b/i, 4, "2NC"],
  [/\b1nr\b/i, 5, "1NR"],
  [/\b1ar\b/i, 6, "1AR"],
  [/\b2nr\b/i, 7, "2NR"],
  [/\b2ar\b/i, 8, "2AR"],
  [/\bconstructives?\b/i, 1, "Constructive"],
  [/\brebuttals?\b/i, 3, "Rebuttal"],
  [/\bsummary\b/i, 5, "Summary"],
  [/\bfinal focus\b/i, 7, "Final Focus"],
];

const DECISION_PATTERN = /\b(?:rfd|decision|disclosure|oral critique)\b/i;
const PART_PATTERN = /\b(?:part|pt\.?|video)\s*(\d{1,2})\b|\((\d{1,2})\s*\/\s*\d{1,2}\)/i;

/**
 * What one upload covers of its round, read from its title: a speech, a
 * numbered part, the decision, or (`order: 0`, no label) the whole round.
 *
 * "(with complete 2AR)" describes a full round, so parenthetical asides are
 * ignored before speeches are looked for.
 */
export function roundPartOf(title: string | null | undefined): { order: number; label: string | null } {
  if (!title) return { order: 0, label: null };
  const text = title.replace(/\(with [^)]*\)/gi, " ");
  if (DECISION_PATTERN.test(text)) return { order: 100, label: "Decision" };
  const part = PART_PATTERN.exec(text);
  if (part) {
    const n = Number(part[1] ?? part[2]);
    return { order: 10 + n, label: `Part ${n}` };
  }
  for (const [pattern, order, label] of SPEECH_ORDER) {
    if (pattern.test(text)) return { order: 10 + order, label };
  }
  return { order: 0, label: null };
}
