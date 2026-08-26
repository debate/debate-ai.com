/**
 * @fileoverview Pure data + types for the News Stream — a unified activity
 * feed of product updates and community announcements, reachable from the
 * Tools page, the app dock's "All Features"/"All Tools" menu, the Reason
 * Editor's Workspace menu, and the quick card search palette's `t` prefix.
 *
 * Product updates are a hand-maintained static list (`PRODUCT_NEWS`) — add
 * one entry per shipped feature/tool worth surfacing. Community
 * announcements are derived from the app's existing per-feature
 * "announcement" stores (`state/dailyBestCardAnnouncements.ts`,
 * `state/contributorAwardAnnouncements.ts`) by `state/newsStream.ts`, which
 * composes this module's types with those stores' already-persisted data
 * rather than introducing a second, competing source of truth for the same
 * events.
 *
 * @module lib/news-stream
 */

/** Which of the feed's sources a `NewsItem` came from. */
export type NewsCategory = "product" | "daily-best-card" | "awards" | "community";

/** Display order and label for each category, in the feed's filter tabs. */
export const NEWS_CATEGORY_LABELS: Record<NewsCategory, string> = {
  product: "Product Updates",
  "daily-best-card": "Daily Best Card",
  awards: "Contributor Awards",
  community: "Community",
};

/** One entry in the News Stream feed. */
export interface NewsItem {
  /** Stable id, unique across the feed — announcement-derived items key off
   *  their source announcement's own identity (e.g. its `dayKey`) so the
   *  same event never posts twice. */
  id: string;
  category: NewsCategory;
  title: string;
  body: string;
  /** Epoch milliseconds (UTC), same convention as `daily-best-card.ts`. */
  timestamp: number;
  /** In-app route this item is about, if any — rendered as a "View" link. */
  href?: string;
}

/**
 * Hand-maintained product-update announcements, newest first. There is no
 * build step that auto-generates these from commits or `TODO.md` — a
 * shipped feature worth surfacing to users gets an entry added here by
 * hand, the same way `feature-catalog.ts`'s `APP_FEATURES` is maintained.
 */
export const PRODUCT_NEWS: NewsItem[] = [
  {
    id: "product-news-stream-coaching-sessions",
    category: "product",
    title: "News Stream now posts new AI Coach Mode sessions",
    body: "The Community side of the feed now posts a coaching session the moment it's generated for a round at /coaching — same as prep notes, Argument Library submissions, streak milestones, challenge completions, and Revision Incentives standings, closing the last open Community source.",
    timestamp: Date.parse("2026-08-26T04:00:00Z"),
    href: "/news",
  },
  {
    id: "product-news-stream-argument-library",
    category: "product",
    title: "News Stream now posts new Argument Library submissions",
    body: "The Community side of the feed now posts a card or analytic block the moment it's submitted and live in the shared repository at /cards/library — same as prep notes, streak milestones, challenge completions, and Revision Incentives standings.",
    timestamp: Date.parse("2026-08-26T03:00:00Z"),
    href: "/news",
  },
  {
    id: "product-news-stream-sprint-notes",
    category: "product",
    title: "News Stream now posts Team Collaboration Mode prep notes",
    body: "The Community side of the feed now posts a note the moment anyone logs it on a topic sprint at /cards/collaboration — no separate announce step, the same way streak milestones, challenge completions, and Revision Incentives standings already work.",
    timestamp: Date.parse("2026-08-26T02:00:00Z"),
    href: "/news",
  },
  {
    id: "product-news-stream-community-categories",
    category: "product",
    title: "News Stream now covers streaks, challenges, and revisions",
    body: "The Community side of the feed used to only post Daily Best Card and Contributor Awards announcements. It now also posts a contributor's quest-streak milestone the day they earn it, a group challenge the moment it's completed, and each day's top Revision Incentives earner.",
    timestamp: Date.parse("2026-08-26T01:00:00Z"),
    href: "/news",
  },
  {
    id: "product-news-stream-launch",
    category: "product",
    title: "News Stream launched",
    body: "A single feed for product updates and community announcements — Daily Best Card winners and Contributor Award standings now post here automatically as they're announced, alongside hand-picked feature updates.",
    timestamp: Date.parse("2026-08-26T00:00:00Z"),
    href: "/news",
  },
  {
    id: "product-editor-workspace-menu",
    category: "product",
    title: "Jump to any tool from inside the Reason Editor",
    body: "The editor's top menu bar has a new Workspace dropdown linking straight to Coach Workspace, Evidence Library, News Stream, and more — no need to leave your document to switch tools.",
    timestamp: Date.parse("2026-08-26T00:00:00Z"),
    href: "/reason-editor",
  },
  {
    id: "product-editor-tool-search",
    category: "product",
    title: "Search Everything can now find tools too",
    body: "Ctrl/Cmd-Shift-Space's command palette has a new t prefix — type \"t coach\" or \"t judge\" to jump straight to a workspace tool without opening the Tools page first.",
    timestamp: Date.parse("2026-08-26T00:00:00Z"),
    href: "/tools",
  },
];

/** Sorts newest-first — the feed's one display order. */
export function sortNewsFeed(items: NewsItem[]): NewsItem[] {
  return [...items].sort((a, b) => b.timestamp - a.timestamp);
}
