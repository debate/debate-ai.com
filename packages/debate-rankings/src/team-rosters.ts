/**
 * @fileoverview Hand-kept rosters for teams the data sources name wrongly or
 * not at all. A round video or Extinction.GG code only gives a team's school
 * and initials (`"Iowa AP"`); when no rankings row names its debaters the
 * site would show just `"AP"`, and a two-word surname (`"Anderson
 * McElligott"`) is cut to its last word by the usual last-name rule. A roster
 * here supplies the debaters' full names and the surnames to show.
 * @module @debate-ai/rankings/team-rosters
 */

import { normalizeSchool } from "./team-lookup";

/** One team whose debaters the site should always name this way. */
export interface TeamRoster {
  /** Spellings of the school the sources use, e.g. `"Iowa"`, `"University of Iowa"`. */
  schools: string[];
  /** Upper-case initials in the team's code, e.g. `"AP"`. */
  code: string;
  /** Full names, in code order. */
  debaters: string[];
  /** Surnames as shown on a team label, in the same order. */
  lastNames: string[];
}

/** Known rosters. Add a team here when its label or profile names it wrongly. */
export const TEAM_ROSTERS: readonly TeamRoster[] = [
  {
    schools: ["Iowa", "University of Iowa"],
    code: "AP",
    debaters: ["Spencer Anderson McElligott", "Grey Parfenoff"],
    lastNames: ["Anderson McElligott", "Parfenoff"],
  },
];

/** Lower-case ASCII words of `text`. */
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

/** `"AP"` and `"PA"` name the same pair: speaking order varies. */
const sortedLetters = (code: string): string => [...code.toUpperCase()].sort().join("");

/** What is known about a team when looking up its roster. */
export interface TeamRosterQuery {
  school?: string | null;
  /** Initials from a team code, e.g. `"AP"`. */
  code?: string | null;
  /** Debater names from a rankings row, e.g. `"Parfenoff & McElligott"`. */
  name?: string | null;
}

/**
 * The hand-kept roster for a team, or `null`. The school must be one of the
 * roster's spellings (after the usual normalizing, so `"Iowa State"` is not
 * `"Iowa"`), and then either the code's letters match or every debater's
 * final surname word appears in `name`.
 */
export function findTeamRoster({ school, code, name }: TeamRosterQuery): TeamRoster | null {
  const normalized = school?.trim() ? normalizeSchool(school) : "";
  if (!normalized) return null;
  const nameWords = new Set(words(name ?? ""));
  for (const roster of TEAM_ROSTERS) {
    if (!roster.schools.some((s) => normalizeSchool(s) === normalized)) continue;
    if (code?.trim() && sortedLetters(code.trim()) === sortedLetters(roster.code)) return roster;
    if (nameWords.size > 0 && roster.debaters.every((d) => nameWords.has(words(d).at(-1) ?? ""))) {
      return roster;
    }
  }
  return null;
}

/** `"Anderson McElligott & Parfenoff"`: the roster as a rankings `name`. */
export function rosterLastNames(roster: TeamRoster): string {
  return roster.lastNames.join(" & ");
}
