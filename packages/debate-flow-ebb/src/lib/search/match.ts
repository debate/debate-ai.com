/**
 * Order-independent multi-token substring matching with tiered ranking -
 * the palette's one matching engine, ported from cardmirror's file search.
 * "Block search style", not edit-distance fuzz: every query token must
 * appear somewhere, in any order.
 */

/** Does `tok` begin at a word boundary anywhere in `text` (both lowercased)?
 *  "war" is a word-start of "at: warming" but not of "software". */
function startsAtWordBoundary(text: string, tok: string): boolean {
    for (let i = text.indexOf(tok); i >= 0; i = text.indexOf(tok, i + 1)) {
        if (i === 0 || !/[a-z0-9]/.test(text[i - 1])) return true;
    }
    return false;
}

/** Relevance tier for a candidate, or null when it doesn't match every token.
 *  Lower is better. Tiers key off the PRIMARY field (a command's label, a
 *  cell's text); a match that only lands in the SECONDARY field (a cell's
 *  sheet/column) is the weakest tier, so a primary hit always outranks it.
 *    0 exact - 1 prefix - 2 word-start - 3 substring - 4 secondary-only */
function matchTier(
    primary: string,
    secondary: string,
    tokens: readonly string[],
    q: string,
    t0: string,
): number | null {
    const p = primary.toLowerCase();
    const hay = secondary ? `${p} ${secondary.toLowerCase()}` : p;
    if (!tokens.every((tok) => hay.includes(tok))) return null;
    if (p === q) return 0;
    if (p.startsWith(q)) return 1;
    if (tokens.every((tok) => p.includes(tok))) return startsAtWordBoundary(p, t0) ? 2 : 3;
    return 4;
}

/** Order-independent multi-token AND-match, ranked by relevance tier
 *  (exact, prefix, word-start, substring, secondary-only), ties broken by
 *  `tiebreak`. A stable no-op tiebreak (`() => 0`) preserves input order. An
 *  empty query returns everything, ordered only by the tiebreak. */
export function rank<T>(
    items: readonly T[],
    query: string,
    primary: (t: T) => string,
    secondary: (t: T) => string,
    tiebreak: (a: T, b: T) => number,
): T[] {
    const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return [...items].sort(tiebreak);
    const q = tokens.join(" ");
    const t0 = tokens[0];
    return items
        .map((item) => ({ item, tier: matchTier(primary(item), secondary(item), tokens, q, t0) }))
        .filter((r): r is { item: T; tier: number } => r.tier !== null)
        .sort((a, b) => a.tier - b.tier || tiebreak(a.item, b.item))
        .map((r) => r.item);
}
