/**
 * @fileoverview Last-name suggestions for the card search's author filter.
 *
 * The corpus has no author column, so the last names come from the start of
 * each card's short cite (`Chilton 18` → `Chilton`), counted over a prefix
 * range of `idx_debate_cards_cite_nocase` — the same range the filter itself
 * matches with — so every suggestion is a name that finds cards.
 *
 * @module lib/search/card-authors
 */

import { sql } from "drizzle-orm";
import { COMMON_SURNAMES } from "@debate-ai/card-parser/src/human-name/common-names";
import { authorCondition } from "./debate-card-search";
import { debateCards } from "@/lib/database/schema";

/** Fewest typed letters a suggestion is looked up for; one letter spans the corpus. */
export const MIN_AUTHOR_PREFIX = 2;

/** Cite leaders pulled per request before they are merged and ranked. */
const CANDIDATE_LIMIT = 200;

type RawDB = { all<T>(query: ReturnType<typeof sql>): Promise<T[]> };

/**
 * Reads the last name off the first word of a short cite.
 *
 * @param token - First whitespace-delimited word of a cite.
 * @returns The name without trailing punctuation, or `null` when the word is
 *   not a plausible surname (a year, a lone initial, an abbreviation).
 */
export function lastNameFromCiteToken(token: string): string | null {
  const name = token.replace(/[,.;:]+$/, "");
  return /^\p{L}[\p{L}'’-]+$/u.test(name) ? name : null;
}

/**
 * Merges cite leaders that differ only in case or punctuation, summing their
 * card counts, and ranks the names by how many cards carry them.
 *
 * @param rows - First words of cites with the number of cards beginning with each.
 * @param limit - Most names to return.
 * @returns Display names, most-carded first; the most common spelling of each.
 */
export function rankLastNames(rows: { token: string; cards: number }[], limit: number): string[] {
  const merged = new Map<string, { total: number; best: string; bestCards: number }>();
  for (const { token, cards } of rows) {
    const name = lastNameFromCiteToken(token);
    if (!name) continue;
    const key = name.toLowerCase();
    const entry = merged.get(key) ?? { total: 0, best: name, bestCards: 0 };
    entry.total += cards;
    if (cards > entry.bestCards) {
      entry.best = name;
      entry.bestCards = cards;
    }
    merged.set(key, entry);
  }
  return [...merged.values()]
    .sort((a, b) => b.total - a.total || a.best.localeCompare(b.best))
    .slice(0, limit)
    .map((entry) => entry.best);
}

/**
 * Common surnames starting with `prefix`, capitalised. The stand-in when the
 * corpus cannot be read in time, so the filter still completes names.
 */
export function commonSurnamesStartingWith(prefix: string, limit: number): string[] {
  const lower = prefix.toLowerCase();
  return COMMON_SURNAMES.filter((name) => name.startsWith(lower))
    .slice(0, limit)
    .map((name) => name.charAt(0).toUpperCase() + name.slice(1));
}

/**
 * Last names in the corpus that start with `prefix`, most-carded first.
 *
 * @param db - The D1/SQLite database.
 * @param prefix - What the user has typed of the last name.
 * @param limit - Most names to return.
 * @returns Names, or `[]` when `prefix` is shorter than {@link MIN_AUTHOR_PREFIX}.
 */
export async function suggestAuthorLastNames(db: unknown, prefix: string, limit: number): Promise<string[]> {
  const typed = prefix.trim();
  if (typed.length < MIN_AUTHOR_PREFIX) return [];
  const rows = await (db as RawDB).all<{ token: string; cards: number }>(sql`
    SELECT substr(${debateCards.cite}, 1, instr(${debateCards.cite} || ' ', ' ') - 1) AS token,
           COUNT(*) AS cards
    FROM ${debateCards}
    WHERE ${authorCondition(typed)}
    GROUP BY token
    ORDER BY cards DESC
    LIMIT ${CANDIDATE_LIMIT}
  `);
  return rankLastNames(rows, limit);
}
