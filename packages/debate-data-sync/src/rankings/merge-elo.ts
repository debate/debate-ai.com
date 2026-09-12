/**
 * Merges DebateDrills Elo ratings into TOC bid list leaderboard rows.
 *
 * The two sources name the same team differently — TOC lists the school plus a
 * separate `students` field, DebateDrills folds debater initials into the team
 * name — so the join is a series of increasingly forgiving key attempts rather
 * than a lookup.
 *
 * Lives here rather than in the `/api/leaderboard` route that calls it: the
 * rankings sources are this package's domain, and as route-local helpers these
 * rules had no test coverage at all.
 */

import { LeaderboardEntry } from "./sync-rankings-debatedrills";

/**
 * Normalize a team name for fuzzy matching:
 * lowercase, strip punctuation/extra spaces, collapse whitespace.
 */
export function normalizeTeamName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extract initials from a student name.
 */
export function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .map((w) => w[0].toUpperCase())
    .join("");
}

/**
 * For PF team names like "Strake Jesuit MS", swap the trailing initials
 * to also try "Strake Jesuit SM". Returns null if no trailing initials found.
 */
export function swapTrailingInitials(normalized: string): string | null {
  const match = normalized.match(/^(.+\s)([a-z])([a-z])$/);
  if (!match) return null;
  return `${match[1]}${match[3]}${match[2]}`;
}

/**
 * Merge DebateDrills Elo ratings into TOC bid list entries by team name.
 * 1. Direct normalized match
 * 2. For LD: append student initials, then direct match
 * 3. For PF: try swapped trailing initials
 *
 * Entries with no Elo match are returned unchanged, so a partial or empty
 * DebateDrills dataset degrades to a bid-list-only leaderboard rather than
 * dropping rows.
 */
export function mergeElo(
  tocEntries: LeaderboardEntry[],
  drillsEntries: LeaderboardEntry[],
  division: string,
): LeaderboardEntry[] {
  // Build exact-match map with both Elo score and rank
  const eloMap = new Map<
    string,
    { elo: number | string; rank: number | string }
  >();
  for (const entry of drillsEntries) {
    if (entry.debateElo !== undefined) {
      eloMap.set(normalizeTeamName(entry.teamName), {
        elo: entry.debateElo,
        rank: entry.eloRank ?? entry.rank,
      });
    }
  }

  return tocEntries.map((entry) => {
    let key = normalizeTeamName(entry.teamName);

    // For LD, append student initials to match DebateDrills naming convention
    if (division === "VLD" && entry.students) {
      const initials = getInitials(entry.students);
      if (initials) {
        key = normalizeTeamName(`${entry.teamName} ${initials}`);
      }
    }

    // 1. Try direct match
    let eloData = eloMap.get(key);

    // 2. For PF, try swapped trailing initials (e.g. "school ms" -> "school sm")
    if (eloData === undefined && division === "VPF") {
      const swapped = swapTrailingInitials(key);
      if (swapped) {
        eloData = eloMap.get(swapped);
      }
    }

    return eloData !== undefined
      ? { ...entry, debateElo: eloData.elo, eloRank: eloData.rank }
      : entry;
  });
}
