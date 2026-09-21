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
 * All distinct reorderings of a string's characters, as arrays, including
 * the input order itself.
 */
function permutationsOf(chars: readonly string[]): string[][] {
  if (chars.length <= 1) return [[...chars]];
  const result: string[][] = [];
  for (let i = 0; i < chars.length; i++) {
    const rest = [...chars.slice(0, i), ...chars.slice(i + 1)];
    for (const tail of permutationsOf(rest)) {
      result.push([chars[i]!, ...tail]);
    }
  }
  return result;
}

/**
 * For PF team names ending in a 2-or-3-letter initials block, like
 * "Strake Jesuit MS" or "Strake Jesuit MJS", every other ordering of that
 * block — "Strake Jesuit SM", or the other five orderings of "MJS" — since
 * partners' initials are not always listed in the same order between the two
 * sources. Returns `[]` when the name doesn't end in such a block.
 */
export function trailingInitialsVariants(normalized: string): string[] {
  const match = normalized.match(/^(.+\s)([a-z]{2,3})$/);
  if (!match) return [];
  const prefix = match[1]!;
  const block = match[2]!;

  const seen = new Set<string>([block]);
  const variants: string[] = [];
  for (const perm of permutationsOf(block.split(""))) {
    const candidate = perm.join("");
    if (seen.has(candidate)) continue;
    seen.add(candidate);
    variants.push(`${prefix}${candidate}`);
  }
  return variants;
}

/**
 * Merge DebateDrills Elo ratings into TOC bid list entries by team name.
 * 1. Direct normalized match
 * 2. For LD: append student initials, then direct match
 * 3. For PF: try every other ordering of a trailing 2-or-3-letter initials
 *    block
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

    // 2. For PF, try every other ordering of the trailing initials block
    // (e.g. "school ms" -> "school sm", or "school mjs" -> its five
    // other orderings) before giving up on an Elo match.
    if (eloData === undefined && division === "VPF") {
      for (const variant of trailingInitialsVariants(key)) {
        eloData = eloMap.get(variant);
        if (eloData !== undefined) break;
      }
    }

    return eloData !== undefined
      ? { ...entry, debateElo: eloData.elo, eloRank: eloData.rank }
      : entry;
  });
}
