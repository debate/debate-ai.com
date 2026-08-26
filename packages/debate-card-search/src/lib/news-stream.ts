/**
 * @fileoverview News Stream — a lightweight, in-app changelog surfacing
 * recently shipped features across the whole product (not just the ones on
 * `/tools`), so a visitor can discover new functionality without reading
 * `TODO.md` themselves. Seeded from real entries already recorded as
 * "Completed" in `TODO.md`'s Tracker Status / Product Feature Ideas
 * sections — this module doesn't invent features, it just makes the ones
 * that already shipped visible in the product itself.
 *
 * Items carry a reverse-chronological `order` rank rather than a fabricated
 * calendar date: `TODO.md`'s log records *what* shipped and in what
 * sequence, not a wall-clock timestamp, so an invented date would be a
 * guess dressed up as fact. `NewsStreamPanel` renders items newest-first by
 * `order` instead.
 *
 * @module lib/news-stream
 */

export type NewsCategory = "editor" | "research" | "coaching" | "community" | "practice";

export const NEWS_CATEGORY_LABELS: Record<NewsCategory, string> = {
  editor: "Editor",
  research: "Research",
  coaching: "Coaching & Analytics",
  community: "Community & Progress",
  practice: "Prep & Practice",
};

export interface NewsItem {
  /** Stable id — used as the localStorage "read" key, so it must never change once shipped. */
  id: string;
  title: string;
  summary: string;
  category: NewsCategory;
  /** In-app route the update relates to, if any (e.g. "/reason-editor"). */
  href?: string;
  /** Reverse-chronological rank; higher sorts first. Unique per item. */
  order: number;
}

/** Newest first. Bump `order` past the current max when adding an item. */
export const NEWS_ITEMS: NewsItem[] = [
  {
    id: "news-stream-launch",
    title: "News Stream",
    summary: "A changelog of recently shipped features, right in the product — reachable from Settings and the Tools page, not just this list.",
    category: "community",
    href: "/news",
    order: 21,
  },
  {
    id: "reason-editor-menu-bar",
    title: "Reason Editor gets a Google Docs-style menu bar",
    summary: "File / Edit / Insert / Format / Tools / Help menus now sit above the toolbar, organizing every CardMirror-inspired command (condense, short cite, emphasis, move heading, send to speech, Verbatim .docx / .cmir import-export, AI tools) in one place.",
    category: "editor",
    href: "/reason-editor",
    order: 20,
  },
  {
    id: "global-command-palette",
    title: "Command palette (Ctrl/Cmd+Shift+Space)",
    summary: "A searchable command menu that jumps to any tool from anywhere in the app, and — while a Reason Editor document is open — runs its CardMirror editing commands too.",
    category: "editor",
    href: "/reason-editor",
    order: 19,
  },
  {
    id: "shared-flow-sync-server-transport",
    title: "Shared, AI-Generated Debate Flow — live sync transport",
    summary: "Flow edits now short-poll a server endpoint so teammates' concurrent flow edits reach each other's browsers, not just the same tab.",
    category: "coaching",
    href: "/debate",
    order: 18,
  },
  {
    id: "flow-annotations-spreadsheet-badges",
    title: "Flow Annotations show up on the flow grid",
    summary: "A per-cell badge on the flow spreadsheet now links straight to any annotation dropped on that argument, with a \"Jump to\" back into the recording.",
    category: "practice",
    href: "/annotations",
    order: 17,
  },
  {
    id: "cardmirror-send-to-speech-document",
    title: "Send selection to a speech document",
    summary: "Ctrl/Cmd+Shift+S (or the \"→Speech\" toolbar button) sends the current selection straight into a named, persisted speech document from inside the editor.",
    category: "editor",
    href: "/speech-documents",
    order: 16,
  },
  {
    id: "coaching-programs-member-practice-rounds",
    title: "Coaching Programs show member practice rounds",
    summary: "Each roster member's recorded practice round and feedback status now shows directly on their coaching program board.",
    category: "coaching",
    href: "/coaching-programs",
    order: 15,
  },
  {
    id: "pre-round-briefings-panel",
    title: "Pre-Round Briefings panel",
    summary: "Opponent scouting, judge tendencies, head-to-head record, and prep notes now compose into one briefing you can pull up before a round.",
    category: "practice",
    href: "/briefings",
    order: 14,
  },
  {
    id: "community-rating-reviewer-credibility",
    title: "Real reviewer-credibility weighting",
    summary: "An endorsement's weight on the Contributions Feed now comes from the endorsing reviewer's own contribution history, not a fixed placeholder.",
    category: "community",
    href: "/cards/contributions",
    order: 13,
  },
  {
    id: "argument-tree-type-suggestion",
    title: "Argument Tree suggests a tag for you",
    summary: "Tagging an argument's type in the flow grid now offers a one-click suggestion derived from the row's own content.",
    category: "practice",
    href: "/outline",
    order: 12,
  },
  {
    id: "expandable-heading-collapse-plugin",
    title: "Collapsible outline sections in the live document",
    summary: "Collapsing a heading in the outline nav now actually hides its content in the document, not just in the outline list.",
    category: "editor",
    href: "/reason-editor",
    order: 11,
  },
  {
    id: "coach-materials-document-upload",
    title: "Upload a document straight into Coach Materials",
    summary: ".docx / .txt / .md files now extract their text automatically when added to the team coach's grounding library.",
    category: "coaching",
    href: "/coach-materials",
    order: 10,
  },
  {
    id: "on-page-card-reuse-extension",
    title: "\"Already cut?\" browser extension",
    summary: "A toolbar-icon click checks the active tab's URL against the shared evidence library for an existing card before you cut a new one.",
    category: "research",
    href: "/cards/library",
    order: 9,
  },
  {
    id: "speech-transcript-dictation",
    title: "Dictate a transcript instead of pasting one",
    summary: "The Speech Transcript Summaries panel's transcript field now has a 🎤 Record button using the browser's own speech recognition.",
    category: "practice",
    href: "/summaries",
    order: 8,
  },
  {
    id: "ai-judge-decision-call",
    title: "Real AI judge decisions",
    summary: "AI Judge Decision now calls a live AI judge under your saved paradigm and the round's flow summary instead of a placeholder.",
    category: "coaching",
    href: "/judge-decision",
    order: 7,
  },
  {
    id: "outcomes-ai-counsel-panel",
    title: "AI counsel panel for response-outcome charts",
    summary: "A three-role (Policy / Kritik / Weighing) AI assessment now backs each exposed argument's likely response path and clash point.",
    category: "coaching",
    href: "/outcomes",
    order: 6,
  },
  {
    id: "versus-ai-regenerate-speech",
    title: "Regenerate the AI's last speech",
    summary: "Didn't like the AI opponent's last speech in Online Debate Versus AI? Regenerate just that one instead of restarting the round.",
    category: "practice",
    href: "/versus-ai",
    order: 5,
  },
  {
    id: "word-count-dictation",
    title: "Dictate a word-count speech",
    summary: "Every speech textarea on Word-Count Speeches now has a 🎤 Record button for hands-free drafting.",
    category: "practice",
    href: "/word-count",
    order: 4,
  },
  {
    id: "standings-custom-points-table",
    title: "Bring your own qualification points table",
    summary: "CX NDCA Standings now lets you save your circuit's own points table instead of using the illustrative default.",
    category: "coaching",
    href: "/standings",
    order: 3,
  },
  {
    id: "progress-cross-tab-live-update",
    title: "Progress panels update live across tabs",
    summary: "Progress, Research Progress, and Quest Streaks now refresh automatically when a contribution lands in another open tab.",
    category: "community",
    href: "/cards/progress",
    order: 2,
  },
  {
    id: "tools-page-launch",
    title: "One Tools page for everything",
    summary: "Every workspace, research, and practice tool now has a single directory to browse from.",
    category: "community",
    href: "/tools",
    order: 1,
  },
];

/** Newest first. */
export function sortNewsItemsByRecency(items: readonly NewsItem[]): NewsItem[] {
  return [...items].sort((a, b) => b.order - a.order);
}

export function filterNewsItemsByCategory(
  items: readonly NewsItem[],
  category: NewsCategory | "all",
): NewsItem[] {
  if (category === "all") return [...items];
  return items.filter((item) => item.category === category);
}

export function isNewsItemUnread(item: NewsItem, readIds: ReadonlySet<string>): boolean {
  return !readIds.has(item.id);
}

export function countUnreadNewsItems(items: readonly NewsItem[], readIds: ReadonlySet<string>): number {
  return items.reduce((count, item) => count + (isNewsItemUnread(item, readIds) ? 1 : 0), 0);
}

/** Looks up the most recent news item for a given in-app route, if any —
 *  used to render an "Updated" badge on that tool's card outside this
 *  feature's own panel. */
export function findLatestNewsItemForHref(items: readonly NewsItem[], href: string): NewsItem | undefined {
  return sortNewsItemsByRecency(items.filter((item) => item.href === href))[0];
}
