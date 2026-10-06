/**
 * @fileoverview Finds the rankings row behind a round video's team label.
 *
 * Videos name a team the way tabroom codes do — school plus initials
 * (`"Harker LL"`, `"William Fremd IB"`, `"MBA HL"`) — while the rankings
 * spell the school in full (`"Strake Jesuit College Prep"`) and list the
 * debaters by name (`"Falk & Sabnani"`, or `"Siddhartha Daswani"` in LD).
 * This module bridges the two: it matches the school loosely and the
 * initials exactly, so a hit is the same entry and not merely the same school.
 * @module @debate/rankings-adapter/team-lookup
 */

import type { RankingEntry } from "./upstream";

/** A video team label split into its school and its code. */
export interface TeamLabel {
  school: string;
  /** Upper-case initials, e.g. `"LL"`. */
  code: string;
}

/**
 * Tokens that some sources add to a school name and others leave off, so
 * `"Bellarmine College Prep"` and `"Bellarmine"` compare equal.
 */
const FILLER_TOKENS = new Set([
  "independent",
  "independents",
  "independant",
  "unaffiliated",
  "hs",
  "high",
  "school",
  "college",
  "prep",
  "preparatory",
  "academy",
  "acad",
  "the",
  "of",
]);

/**
 * Circuit shorthand that no rule derives from the full name. Keys and values
 * are normalized school names.
 */
const SCHOOL_ALIASES: Record<string, string> = {
  gbn: "glenbrook north",
  gbs: "glenbrook south",
  bcc: "bethesda chevy chase",
  hw: "harvard westlake",
  sj: "strake jesuit",
  msj: "mission san jose",
  "ut dallas": "utd",
  "long beach": "csu long beach",
  "cal state long beach": "csu long beach",
  usc: "southern california",
  "missouri state": "mostate",
  cal: "uc berkeley",
  berkeley: "uc berkeley",
};

/** Lower-case ASCII words of `text`, punctuation dropped. */
function words(text: string): string[] {
  return (text ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    // "Russellville HS - Russellville, AR": the part after " - " is a city.
    .replace(/\s+-\s+.*$/, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

/** The school's significant words, filler dropped. */
function schoolTokens(school: string): string[] {
  const all = words(school);
  const kept = all.filter((w) => !FILLER_TOKENS.has(w));
  return kept.length > 0 ? kept : all;
}

/** Normalized school name, with a known shorthand expanded. */
export function normalizeSchool(school: string): string {
  const joined = schoolTokens(school).join(" ");
  return SCHOOL_ALIASES[joined] ?? joined;
}

/** First letters of every word of `school`, filler included (`"MBA"`). */
function acronym(school: string): string {
  return words(school)
    .map((w) => w[0])
    .join("");
}

/**
 * How well two school names agree: 3 for the same name, 2 when one is the
 * other's acronym, 1 when one name's words all appear in the other
 * (`"Fremd"` in `"William Fremd"`), 0 for no match.
 */
export function schoolMatchScore(a: string, b: string): number {
  const na = normalizeSchool(a);
  const nb = normalizeSchool(b);
  if (!na || !nb) return 0;
  if (na === nb) return 3;

  const compactA = na.replace(/ /g, "");
  const compactB = nb.replace(/ /g, "");
  if (compactA === compactB) return 3;
  if (
    (!na.includes(" ") && na.length >= 2 && na === acronym(b)) ||
    (!nb.includes(" ") && nb.length >= 2 && nb === acronym(a))
  ) {
    return 2;
  }

  const ta = na.split(" ");
  const tb = nb.split(" ");
  const [short, long] = ta.length <= tb.length ? [ta, new Set(tb)] : [tb, new Set(ta)];
  // A single short word ("St") is too weak to stand for a whole school.
  if (short.length === 1 && short[0].length < 4) return 0;
  return short.every((w) => long.has(w)) ? 1 : 0;
}

/**
 * Splits a video team label into school and code. The code is the trailing
 * run of one to four capital letters; a label without one (`"SMU"`,
 * `"Boston College"`) names only a school and yields `null`.
 */
export function parseTeamLabel(label: string | null | undefined): TeamLabel | null {
  const trimmed = (label ?? "").trim().replace(/\s+/g, " ");
  const match = /^(.+?)\s+([A-Z]{1,4})$/.exec(trimmed);
  if (!match) return null;
  return { school: match[1], code: match[2] };
}

/**
 * Initials of a rankings entry name. A team (`"Falk & Sabnani"`) takes the
 * first letter of each last name; a single debater (`"Siddhartha Daswani"`)
 * the first letters of the first and last name.
 */
export function entryInitials(name: string): string {
  const parts = name.split(/\s*(?:&|\/|,| and )\s*/i).filter(Boolean);
  if (parts.length > 1) {
    return parts.map((p) => words(p).at(-1)?.[0] ?? "").join("").toUpperCase();
  }
  const w = words(name);
  if (w.length === 0) return "";
  if (w.length === 1) return w[0][0].toUpperCase();
  return (w[0][0] + w[w.length - 1][0]).toUpperCase();
}

/** `code` and `initials` name the same people, in either order. */
function initialsMatch(code: string, initials: string): boolean {
  if (code.length !== initials.length) return false;
  if (code === initials) return true;
  return [...code].sort().join("") === [...initials].sort().join("");
}

/**
 * The rankings entry a video team label refers to, or `null` when none
 * matches. Among several entries with the right initials, the closest school
 * match wins, then an exact initials order, then the better rank.
 *
 * @param entries - One dataset's rows.
 * @param label - A video's aff or neg team, e.g. `"Harker LL"`.
 */
export function findTeamRanking(
  entries: readonly RankingEntry[],
  label: string | null | undefined,
): RankingEntry | null {
  const parsed = parseTeamLabel(label);
  if (!parsed) return null;

  let best: { entry: RankingEntry; score: number } | null = null;
  for (const entry of entries) {
    const initials = entryInitials(entry.name);
    if (!initialsMatch(parsed.code, initials)) continue;
    const schoolScore = schoolMatchScore(parsed.school, entry.school);
    if (schoolScore === 0) continue;
    const score = schoolScore * 2 + (parsed.code === initials ? 1 : 0);
    if (!best || score > best.score || (score === best.score && entry.rank < best.entry.rank)) {
      best = { entry, score };
    }
  }
  return best?.entry ?? null;
}

/** Most phrases one profile's video search sends, keeping the SQL small. */
const MAX_SEARCH_NAMES = 12;

/**
 * Phrases a round video's team label or title is likely to use for `school`,
 * longest first. Videos write schools the short way (`"Gunn LL"`, `"SJ FS"`),
 * so besides the full name this drops trailing filler (`"Gunn HS
 * Independent"` → `"gunn"`), cuts at the first filler word (`"Carrollton
 * School of the Sacred Heart"` → `"carrollton"`) and adds known circuit
 * shorthand (`"Glenbrook North"` → `"gbn"`). Phrases are lower-case words
 * joined by single spaces.
 *
 * @param school - School as the rankings spell it.
 */
export function schoolSearchNames(school: string): string[] {
  const all = words((school ?? "").replace(/\([^)]*\)/g, " "));
  // A name made only of filler ("College Prep") is the name itself.
  if (all.every((w) => FILLER_TOKENS.has(w))) return all.length ? [all.join(" ")] : [];
  let start = 0;
  while (start < all.length - 1 && FILLER_TOKENS.has(all[start])) start += 1;
  const core = all.slice(start);
  if (core.length === 0) return [];

  const names = new Set<string>([core.join(" ")]);
  let end = core.length;
  while (end > 1 && FILLER_TOKENS.has(core[end - 1])) end -= 1;
  names.add(core.slice(0, end).join(" "));
  const firstFiller = core.findIndex((w) => FILLER_TOKENS.has(w));
  if (firstFiller > 0) names.add(core.slice(0, firstFiller).join(" "));

  const normalized = normalizeSchool(school);
  if (normalized) names.add(normalized);
  for (const [short, full] of Object.entries(SCHOOL_ALIASES)) {
    if (full === normalized && !short.includes(" ")) names.add(short);
  }

  return [...names]
    .filter((name) => name.length >= 2)
    .sort((a, b) => b.length - a.length)
    .slice(0, MAX_SEARCH_NAMES);
}

/**
 * Phrases a round video uses for one ranked team: each of
 * {@link schoolSearchNames} followed by the team's initials, in either order
 * (`"strake jesuit fs"`, `"sj sf"`), so the search finds that team and not
 * the rest of its school. A single debater (LD) also matches by full name.
 *
 * @param entry - The rankings row: its school and its name.
 */
export function teamSearchNames(entry: { school: string; name: string }): string[] {
  const code = entryInitials(entry.name).toLowerCase();
  if (!code) return schoolSearchNames(entry.school);
  const codes = [...new Set([code, [...code].reverse().join("")])];
  const names = schoolSearchNames(entry.school).flatMap((school) =>
    codes.map((c) => `${school} ${c}`),
  );
  const isSingleDebater = !/&|\/|,| and /i.test(entry.name);
  const fullName = words(entry.name).join(" ");
  if (isSingleDebater && fullName.includes(" ")) names.unshift(fullName);
  return names.slice(0, MAX_SEARCH_NAMES);
}
