/**
 * @fileoverview What the site prints for a team wherever it names one: the
 * school, then the debaters. The school is shown as its logo when the site
 * has one (the UI decides that) and otherwise by name; the debaters are their
 * last names when a rankings row or tournament field names them, and
 * otherwise the initials of the team's code (`"Harker LL"` → `"LL"`).
 * @module @debate-ai/rankings/team-display
 */

import { parseTeamLabel } from "./team-lookup";
import { debaterLastNames } from "./tournament-lookup";

/** The two parts of a team's label. Either can be missing. */
export interface TeamDisplayParts {
  /** The school as the best source spells it. */
  school: string | null;
  /** `"Le & Luo"` (or `"Daswani"` in LD) when known, else initials like `"LL"`. */
  debaters: string | null;
}

/** What is known about a team: its code, and where found, its school and debaters. */
export interface TeamDisplayInput {
  /** A video's aff/neg label or a tournament code, e.g. `"Harker LL"`. */
  label?: string | null;
  /** The school, e.g. from the team's rankings row. Preferred over the label's. */
  school?: string | null;
  /** The debaters' names, e.g. `"Le & Luo"` or `"Siddhartha Daswani"`. */
  name?: string | null;
}

/**
 * Splits a team into the school and debaters the site shows for it. A label
 * with no trailing initials (`"Boston College"`) is taken to name only the
 * school.
 */
export function teamDisplayParts({ label, school, name }: TeamDisplayInput): TeamDisplayParts {
  const cleanLabel = label?.trim().replace(/\s+/g, " ") || null;
  const parsed = parseTeamLabel(cleanLabel);
  const cleanName = name?.trim() || null;
  return {
    school: school?.trim() || parsed?.school || (parsed ? null : cleanLabel),
    debaters: cleanName ? debaterLastNames(cleanName) : (parsed?.code ?? null),
  };
}
