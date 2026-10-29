/**
 * @fileoverview Finds the rankings row behind a tournament entry.
 *
 * Tournament pairings and results name an entry by its code
 * (`"Harker LL"`) and, where the tournament publishes its field, by its
 * debaters (`"Le & Luo"`) and school. This module picks the datasets for the
 * entry's event — Public Forum entries are only looked up in the PF
 * rankings, and so on — and returns a row only when exactly one entry is a
 * confident match, so a tournament page never shows the wrong team's rating.
 * @module @debate-ai/rankings/tournament-lookup
 */

import { entryInitials, parseTeamLabel, schoolMatchScore } from "./team-lookup";
import type { RankingDatasetId, RankingEntry } from "./types";

/** The parts of a tournament event that say which format it is. */
export interface TournamentEventFormat {
  name?: string | null;
  abbr?: string | null;
  /** Tabroom's event type: `"debate"`, `"speech"`, `"congress"`, … */
  type?: string | null;
}

/** A tournament entry as pairings and results describe it. */
export interface TournamentEntryQuery {
  /** The entry code, e.g. `"Harker LL"`. */
  code?: string | null;
  /** The debaters, e.g. `"Le & Luo"` or `"Siddhartha Daswani"`. */
  name?: string | null;
  /** The entry's school, when the page carries it. */
  school?: string | null;
}

/** Event types that are never ranked. */
const UNRANKED_TYPES = new Set(["speech", "congress", "wudc", "wsdc", "mock_trial", "attendee"]);

/** Words in an event name or abbreviation that mark a college policy event. */
const COLLEGE_POLICY = /\b(ndt|ceda|adt|college|collegiate|university)\b/i;

/**
 * The current-season ranking datasets an event's entries can be found in:
 * one for Public Forum and Lincoln-Douglas, and for policy the high school
 * and college datasets unless the event says which. Empty for formats the
 * rankings don't cover (speech, congress, parli, worlds…).
 */
export function rankingDatasetsForEvent(event: TournamentEventFormat): RankingDatasetId[] {
  if (event.type && UNRANKED_TYPES.has(event.type.toLowerCase())) return [];
  const name = (event.name ?? "").toLowerCase();
  const abbr = (event.abbr ?? "").toUpperCase().replace(/[^A-Z]/g, " ");
  const policy = (): RankingDatasetId[] => {
    if (COLLEGE_POLICY.test(name) || COLLEGE_POLICY.test(abbr)) return ["cpd"];
    if (/\b(high school|hs|middle school|ms)\b/.test(name)) return ["hscx"];
    return ["hscx", "cpd"];
  };

  if (/public forum/.test(name)) return ["hspf"];
  if (/lincoln|douglas/.test(name)) return ["hsld"];
  if (/policy|cross[- ]?ex|\bndt\b|\bceda\b/.test(name)) return policy();
  // Abbreviations: "PF", "VPF", "JVLD", "CX-O", "NCX", "VPOL".
  if (/PF/.test(abbr) && !/LD|CX/.test(abbr)) return ["hspf"];
  if (/LD/.test(abbr) && !/PF|CX/.test(abbr)) return ["hsld"];
  if (/CX|POL|NDT|CEDA/.test(abbr)) return policy();
  return [];
}

/** Lower-case ASCII words, punctuation dropped. */
function words(text: string): string[] {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

/** Splits `"Le & Luo"`, `"Le/Luo"` or `"Le and Luo"` into its debaters. */
function debaters(name: string): string[] {
  return name.split(/\s*(?:&|\/|\+|,| and )\s*/i).map((p) => p.trim()).filter(Boolean);
}

/**
 * A comparable key for an entry's debaters: a team's last names, sorted so
 * either speaking order matches; a single debater's whole name.
 */
export function debaterNameKey(name: string | null | undefined): string {
  const parts = debaters(name ?? "");
  if (parts.length > 1) {
    return parts
      .map((p) => words(p).at(-1) ?? "")
      .sort()
      .join("&");
  }
  return words(name ?? "").join(" ");
}

/**
 * Debaters' last names as the rankings spell them: `"Falk & Sabnani"` for a
 * team, `"Daswani"` for a single debater.
 */
export function debaterLastNames(name: string): string {
  const parts = debaters(name);
  const last = (p: string) => p.trim().split(/\s+/).at(-1) ?? p;
  return parts.length > 1 ? parts.map(last).join(" & ") : last(name);
}

/** `"LL"` and `"LL"`, `"FS"` and `"SF"` compare equal: speaking order varies. */
const sortedLetters = (code: string): string => [...code].sort().join("");

/** The only element of `list`, or `null` when it has none or several. */
const only = <T>(list: readonly T[]): T | null => (list.length === 1 ? list[0] : null);

/**
 * The one rankings row a tournament entry refers to, or `null` when no row
 * matches or several do.
 *
 * The debaters' names are tried first: the same last names (or, for a single
 * debater, the same full name), narrowed by school when the query has one.
 * Failing that, the code is split into school and initials and matched like
 * a video label — the initials exactly, the school loosely — keeping only
 * the strongest school match, which must be unique.
 *
 * @param entries - One dataset's rows, or a past season's college table
 *   (anything with a school and a `Last & Last` name).
 * @param query - The entry's code, debater names and school.
 */
export function matchTournamentEntry<T extends Pick<RankingEntry, "name" | "school">>(
  entries: readonly T[],
  query: TournamentEntryQuery,
): T | null {
  const key = debaterNameKey(query.name);
  if (key && (key.includes("&") || key.includes(" "))) {
    const byName = entries.filter((entry) => debaterNameKey(entry.name) === key);
    const school = query.school ?? parseTeamLabel(query.code)?.school;
    if (byName.length > 0) {
      if (!school) return only(byName);
      return only(byName.filter((entry) => schoolMatchScore(school, entry.school) > 0));
    }
  }

  const label = parseTeamLabel(query.code);
  if (!label) return null;
  let bestScore = 0;
  let best: T[] = [];
  for (const entry of entries) {
    if (sortedLetters(entryInitials(entry.name)) !== sortedLetters(label.code)) continue;
    const score = Math.max(schoolMatchScore(label.school, entry.school), query.school ? schoolMatchScore(query.school, entry.school) : 0);
    if (score === 0 || score < bestScore) continue;
    if (score > bestScore) {
      bestScore = score;
      best = [];
    }
    best.push(entry);
  }
  return only(best);
}
