/**
 * @fileoverview Pure data + types for the News Stream — the activity feed on
 * the News tab of `/news`.
 *
 * The feed is deliberately narrow: new rounds, new files (caselist uploads
 * and Argument Library cards), forum activity, and the teams and schools the
 * viewer follows. It used to also post hand-written product updates, a
 * "Tool spotlight" for every catalog entry, Daily Best Card and Contributor
 * Awards standings, quest streaks, group challenges, revision incentives and
 * prep notes — most of which read as UI-change noise, so they were dropped.
 *
 * Argument Library cards are posted as one digest per day rather than one
 * item per card, with each card's label cleaned of the path separators and
 * Verbatim markers (`<<<PARAGRAPH BREAKS END>>>`) imported block names carry
 * — see {@link cleanArgBlockLabel}.
 *
 * @module lib/news-stream
 */

/** Which of the feed's sources a `NewsItem` came from. */
export type NewsCategory = "rounds" | "files" | "forums" | "following" | "coaching";

/** Label for each category, in the feed's filter tabs and item badges. */
export const NEWS_CATEGORY_LABELS: Record<NewsCategory, string> = {
  rounds: "Rounds",
  files: "Files",
  forums: "Forums",
  following: "Following",
  coaching: "Coaching",
};

/** One entry in the News Stream feed. */
export interface NewsItem {
  /** Stable id, unique across the feed, so the same event never posts twice. */
  id: string;
  category: NewsCategory;
  title: string;
  body: string;
  /** Epoch milliseconds (UTC). */
  timestamp: number;
  /** In-app route this item is about, if any — rendered as a "View" link. */
  href?: string;
}

/** Sorts newest-first — the feed's one display order. */
export function sortNewsFeed(items: NewsItem[]): NewsItem[] {
  return [...items].sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * A readable label for an Argument Library block name.
 *
 * Block names imported from Verbatim files are heading paths such as
 * `1AC---Single-Payer---AW > Crisis Management---1AC > <<<PARAGRAPH BREAKS END>>>`:
 * `>` separates heading levels, `---` stands in for spaces around a dash,
 * and `<<<…>>>` are the template's own markers. This drops the markers,
 * collapses the separators, and drops a heading level that repeats one
 * already shown (the trailing `1AC`).
 *
 * @param argBlock - The entry's raw block name.
 * @returns The cleaned label, or `"Untitled block"` when nothing is left.
 */
export function cleanArgBlockLabel(argBlock: string): string {
  const seen = new Set<string>();
  const parts: string[] = [];
  for (const level of argBlock.replace(/<<<[^>]*>>>/g, " ").split(/\s*>\s*/)) {
    const words = level
      .split(/-{2,}/)
      .map((word) => word.replace(/\s+/g, " ").trim())
      .filter((word) => word.length > 0 && !seen.has(word.toLowerCase()));
    for (const word of words) seen.add(word.toLowerCase());
    if (words.length > 0) parts.push(words.join(" "));
  }
  return parts.join(" › ") || "Untitled block";
}
