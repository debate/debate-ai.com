/**
 * @fileoverview Pure data for the app-wide features page (`/features`).
 *
 * The app ships roughly fifty distinct surfaces, but nothing lists them all:
 * the global dock exposes four destinations plus a long, flat Settings menu;
 * `/research` and `/coach` tab across the panels of one package each;
 * `/community-hub` covers only the crowdsourcing and pre-round/practice
 * spaces named under TODO.md's "Research Crowdsourcing Organizer Features"
 * heading. None of them mention the core workspaces (card search, the flow
 * spreadsheet, the video archive, the Reason editor) or the rankings and
 * standings surfaces at all, so a new debater has no single page that
 * outlines what the app actually does.
 *
 * `APP_FEATURES` is that outline: every user-facing surface's title,
 * one-line description, route, category, and — where one exists — its
 * long-form doc under `docs/features/`. Titles and descriptions are taken
 * from each route's own page metadata (or its feature doc's opening lines),
 * so this catalog reads the same as the page a reader lands on after
 * clicking through.
 *
 * Like `debate-card-search`'s narrower community-hub directory, this module
 * is pure: it has no store of its own, because every entry links to a
 * surface that already persists (or doesn't need to persist) its own state.
 *
 * @module features/feature-catalog
 */

/** Repository the feature docs are published from. */
const DOCS_BASE_URL = "https://github.com/debate/debate-ai.com/blob/master/docs/features";

/**
 * Groups the catalog by the job a debater is doing, rather than by the
 * package a surface happens to live in.
 */
export type FeatureCategory =
  | "workspaces"
  | "evidence"
  | "collaboration"
  | "round"
  | "intelligence"
  | "practice"
  | "recognition"
  | "standings";

/** Display order and label for each category, broadest surfaces first. */
export const FEATURE_CATEGORY_LABELS: Record<FeatureCategory, string> = {
  workspaces: "Core Workspaces",
  evidence: "Evidence & Research",
  collaboration: "Team Collaboration",
  round: "Flowing & Round Analysis",
  intelligence: "Pre-Round Intelligence",
  practice: "Practice & Coaching",
  recognition: "Recognition & Progress",
  standings: "Standings & Rankings",
};

/** One line under each category heading explaining what the group is for. */
export const FEATURE_CATEGORY_DESCRIPTIONS: Record<FeatureCategory, string> = {
  workspaces: "The main destinations — everything else is reachable from one of these.",
  evidence: "Find, cut, score, review, and organize the cards a squad runs.",
  collaboration: "Shared prep spaces, note handoffs, and coach-run team programs.",
  round: "Turn a flowed round into outlines, summaries, annotations, and exposure charts.",
  intelligence: "What you know about the opponent and judge before the round starts.",
  practice: "Practice rounds, drills, and AI coaching between tournaments.",
  recognition: "Quests, streaks, awards, and unlocks that reward contributing research.",
  standings: "Season results across tournaments, and community team rankings.",
};

/** One user-facing surface in the app. */
export interface FeatureEntry {
  /** Stable slug, unique across the catalog. */
  id: string;
  /** Surface name, as its own page titles itself. */
  title: string;
  /** One-line summary of what the surface does. */
  description: string;
  /** In-app route. */
  href: string;
  /** Which group the surface belongs to. */
  category: FeatureCategory;
  /** File name under `docs/features/`, when a long-form doc exists. */
  doc?: string;
  /**
   * Extra search terms that don't appear in the title or description —
   * package names, synonyms, and the jargon a debater would actually type.
   */
  tags?: string[];
}

/**
 * Every user-facing surface in the app, in category order.
 *
 * Sign-in (`/login`) is deliberately absent: it is a step on the way to a
 * feature rather than a feature, and it is already reachable from the dock's
 * Settings menu.
 */
export const APP_FEATURES: FeatureEntry[] = [
  // ── Core workspaces ────────────────────────────────────────────────────
  {
    id: "videos",
    title: "Video Archive & Lectures",
    description:
      "Thousands of recorded rounds and instructional videos, searchable by title, channel, year, or view count, with inline playback",
    href: "/videos",
    category: "workspaces",
    tags: ["learn", "lectures", "rounds", "youtube", "archive", "debate-videos"],
  },
  {
    id: "card-search",
    title: "Card Search",
    description:
      "Full-text search across tagged, annotated evidence cards, with highlight, underline, and plain reading modes",
    href: "/cards",
    category: "workspaces",
    tags: ["cards", "evidence", "highlight", "cut", "debate-card-search"],
  },
  {
    id: "debate-flow",
    title: "Debate Flow (FIAT)",
    description:
      "The multi-column flow spreadsheet: format-specific speech columns, inline editing, timers, and a shareable round URL",
    href: "/debate",
    category: "workspaces",
    tags: ["fiat", "flow", "spreadsheet", "timer", "round", "debate-round"],
  },
  {
    id: "reason-docs",
    title: "Reason Docs",
    description: "The nested research-document tree — Research Editor for Annotated Summaries in Outline Notation",
    href: "/doc",
    category: "workspaces",
    tags: ["docs", "documents", "notes", "outline"],
  },
  {
    id: "library",
    title: "My Library",
    description:
      "Every document, saved flow, and shared file linked to your account — open, rename, duplicate, share, upload DOCX/ZIP packs, and delete from one place; try it with the demo account",
    href: "/library",
    category: "workspaces",
    doc: "user-library.md",
    tags: ["library", "my files", "documents", "flows", "rounds", "shared files", "topic starter", "upload", "docx", "demo account", "demo"],
  },
  {
    id: "shared-files",
    title: "Shared Files",
    description:
      "The community file library — admin-curated Topic Starter evidence packs plus documents and DOCX uploads users publish; browse, open read-only in the Reason Editor, or save an editable copy",
    href: "/library?tab=shared",
    category: "collaboration",
    doc: "shared-files.md",
    tags: ["shared files", "topic starter", "topic starters", "evidence packs", "docx", "zip", "publish", "library"],
  },
  {
    id: "reason-editor",
    title: "Reason Editor",
    description:
      "The rich-text card editor: a Google-Docs-style menu bar (File/Edit/Card/Format/Insert/AI/View/Tools/Workspace), a Ctrl/Cmd-Shift-Space command palette that also jumps to other tools, Verbatim/Cardmirror-compatible shortcuts, an outline nav panel, and a send-to-speech-document command",
    href: "/reason-editor",
    category: "workspaces",
    doc: "legacy-verbatim-shortcuts.md",
    tags: ["verbatim", "cardmirror", "tiptap", "editor", "docx", "reason-editor", "menu bar", "command palette", "workspace"],
  },
  {
    id: "research-workspace",
    title: "Research Workspace",
    description:
      "Squad research hub tabbed across coverage, evidence library, task routing, quests, leaderboards, and peer review",
    href: "/research",
    category: "workspaces",
    tags: ["hub", "squad", "crowdsourcing"],
  },
  {
    id: "coach-workspace",
    title: "Coach Workspace",
    description:
      "Round coaching hub tabbed across the argument tree, flow summaries, coaching prompts, drills, scouting, briefings, and practice rounds",
    href: "/coach",
    category: "workspaces",
    tags: ["hub", "coach", "flow sync"],
  },
  {
    id: "community-research-hub",
    title: "Community Research Hub",
    description:
      "A searchable directory of every shared research, collaboration, and pre-round/practice space",
    href: "/community-hub",
    category: "workspaces",
    doc: "community-research-hub.md",
    tags: ["directory", "index"],
  },

  // ── Evidence & research ────────────────────────────────────────────────
  {
    id: "shared-evidence-library",
    title: "Shared Evidence Library",
    description: "Search cut cards and reusable analytic blocks by keyword, citation, or argument",
    href: "/cards/library",
    category: "evidence",
    doc: "evidence-library.md",
    tags: ["repository", "submit", "tf-idf", "search index"],
  },
  {
    id: "common-argument-library",
    title: "Common Argument Library",
    description: "Browse shared research organized into topic folders, case areas, and tag-based collections",
    href: "/cards/argument-library",
    category: "evidence",
    tags: ["folders", "case areas", "tags", "blocks"],
  },
  {
    id: "contributions-feed",
    title: "Contributions Feed",
    description: "Submit, like, save, and endorse the community's cards, summaries, highlights, and annotations",
    href: "/cards/contributions",
    category: "evidence",
    tags: ["feed", "endorse", "upvote", "helpfulness"],
  },
  {
    id: "llm-card-scoring",
    title: "LLM Card Scoring",
    description: "Score cards for relevance, clarity, uniqueness, evidence quality, and usability",
    href: "/cards/scoring",
    category: "evidence",
    doc: "llm-card-scoring.md",
    tags: ["ai", "duplicate", "ranking", "quality"],
  },
  {
    id: "review-queue",
    title: "Review Queue",
    description: "Move a submitted card through peer review — comment, request changes, approve, and publish",
    href: "/cards/reviews",
    category: "evidence",
    doc: "review-queue.md",
    tags: ["peer review", "approve", "publish", "reviewer tier"],
  },
  {
    id: "revision-incentives",
    title: "Revision Incentives",
    description:
      "Contributors ranked by reward points earned improving weak cards, strengthening citations, and refreshing stale evidence",
    href: "/cards/revisions",
    category: "evidence",
    doc: "revision-incentives.md",
    tags: ["rewards", "stale", "citations"],
  },
  {
    id: "topic-coverage-dashboard",
    title: "Topic Coverage Dashboard",
    description: "See which arguments are well-covered, which are missing, and where the team needs more work",
    href: "/cards/coverage",
    category: "evidence",
    doc: "topic-coverage-dashboard.md",
    tags: ["gaps", "checklist", "thin", "missing"],
  },
  {
    id: "research-progress",
    title: "Research Progress",
    description: "Each contributor's contribution history and per-topic task completion",
    href: "/cards/progress-tracking",
    category: "evidence",
    doc: "research-progress-tracking.md",
    tags: ["tracking", "completion"],
  },
  {
    id: "task-inbox",
    title: "Task Inbox",
    description: "Research tasks routed to contributors, grouped by topic",
    href: "/cards/inbox",
    category: "evidence",
    doc: "task-inbox.md",
    tags: ["assignments", "routing", "my tasks"],
  },

  // ── Team collaboration ─────────────────────────────────────────────────
  {
    id: "team-brainstorm-assist",
    title: "Team Brainstorm Assist",
    description: "Submit and upvote squad ideas for an argument block, grouped into boards by category",
    href: "/cards/brainstorm",
    category: "collaboration",
    doc: "brainstorm-board.md",
    tags: ["ai", "ideas", "impact framing", "frontlines", "turns"],
  },
  {
    id: "team-collaboration-mode",
    title: "Team Collaboration Mode",
    description: "Leave live prep notes on a shared topic sprint, grouped by topic",
    href: "/cards/collaboration",
    category: "collaboration",
    doc: "team-collaboration-mode.md",
    tags: ["sprint notes", "assign"],
  },
  {
    id: "collaboration-prep-room",
    title: "Collaboration Prep Room",
    description: "A topic's shared prep space: evidence, draft blocks, and routed research tasks",
    href: "/cards/prep-room",
    category: "collaboration",
    doc: "collaboration-prep-room.md",
    tags: ["prep", "drafts", "search"],
  },
  {
    id: "prep-notes",
    title: "Prep Notes",
    description: "Live prep notes across every flow, grouped by status, with handoff to a teammate",
    href: "/prep-notes",
    category: "collaboration",
    doc: "prep-notes.md",
    tags: ["strategy sync", "follow-up", "assign"],
  },
  {
    id: "notifications",
    title: "Notifications",
    description: "Assignee notifications for prep notes handed off to you as a task",
    href: "/notifications",
    category: "collaboration",
    tags: ["alerts", "handoff", "inbox"],
  },
  {
    id: "coaching-programs",
    title: "Coaching Programs",
    description:
      "Group coaching spaces scoped to a squad roster, each with its topic sprint, challenge standings, and generated drills",
    href: "/coaching-programs",
    category: "collaboration",
    doc: "coaching-programs.md",
    tags: ["squad", "roster", "program", "board"],
  },
  {
    id: "coach-materials",
    title: "Coach Materials",
    description: "Upload grounding materials for the team coach AI and preview which ones answer a question",
    href: "/coach-materials",
    category: "collaboration",
    doc: "coach-materials.md",
    tags: ["lectures", "camp", "docx", "rag", "q&a"],
  },

  // ── Flowing & round analysis ───────────────────────────────────────────
  {
    id: "argument-tree-outline",
    title: "Argument Tree Outline",
    description: "Filterable outline of each round's flow, grouped by heading",
    href: "/outline",
    category: "round",
    doc: "argument-tree-outline.md",
    tags: ["tree", "filters", "argument type", "contributor"],
  },
  {
    id: "speech-transcript-summaries",
    title: "Speech Transcript Summaries",
    description:
      "Per-argument summaries derived from each round's flow, with cross-exam questions and extension ideas",
    href: "/summaries",
    category: "round",
    doc: "flow-summaries.md",
    tags: ["ai", "transcript", "cross-ex", "extensions"],
  },
  {
    id: "flow-annotations",
    title: "Flow Annotations",
    description:
      "Drop timestamped flow annotations while watching a streamed or recorded round, and jump back to them",
    href: "/annotations",
    category: "round",
    doc: "flow-annotations.md",
    tags: ["video", "timestamp", "jump to", "flow-in-speech"],
  },
  {
    id: "response-outcome-charts",
    title: "AI Response-Outcome Charts",
    description: "Per-side exposure and the most vulnerable arguments in each round's flow",
    href: "/outcomes",
    category: "round",
    doc: "response-outcome-charts.md",
    tags: ["vulnerability", "what if", "counsel panel", "chart"],
  },
  {
    id: "speech-documents",
    title: "Speech Documents",
    description: "History of evidence sent into the designated speech document from the Reason Editor",
    href: "/speech-documents",
    category: "round",
    doc: "speech-document-target.md",
    tags: ["send to speech", "cardmirror", "prosemirror"],
  },
  {
    id: "word-count-speeches",
    title: "Word-Count Speeches",
    description: "Practice speeches bounded by a maximum word count instead of a time limit",
    href: "/word-count",
    category: "round",
    doc: "word-count-rounds.md",
    tags: ["format", "limit", "typed"],
  },

  // ── Pre-round intelligence ─────────────────────────────────────────────
  {
    id: "opponent-team-profiles",
    title: "Opponent Team Profiles",
    description:
      "Records, side-record tendencies, and common arguments/cases for every saved opponent scouting profile",
    href: "/opponents",
    category: "intelligence",
    doc: "opponent-team-profiles.md",
    tags: ["scouting", "aff", "neg", "record"],
  },
  {
    id: "judge-profiles",
    title: "Judge Profiles",
    description: "Side-vote bias, average speaker points, and tendencies for every saved judge profile",
    href: "/judges",
    category: "intelligence",
    doc: "judge-profiles.md",
    tags: ["speaks", "theory", "speed", "paradigm"],
  },
  {
    id: "pre-round-briefings",
    title: "Pre-Round Briefings",
    description: "Opponent scouting, judge tendencies, head-to-head record, and prep notes per round",
    href: "/briefings",
    category: "intelligence",
    doc: "pre-round-briefings.md",
    tags: ["matchup", "intelligence panel"],
  },
  {
    id: "scout-to-strategy",
    title: "Scout-to-Strategy",
    description:
      "Case-choice rankings, judge-adaptation notes, and matchup risk level from scouted opponent and judge data",
    href: "/strategy",
    category: "intelligence",
    doc: "scout-to-strategy.md",
    tags: ["risk", "case choice", "adaptation", "ai panel"],
  },
  {
    id: "judge-paradigm-picker",
    title: "Judge Paradigm Picker",
    description: "Pick a built-in or custom AI judge paradigm for a practice round",
    href: "/paradigms",
    category: "intelligence",
    doc: "judge-paradigm-selections.md",
    tags: ["flow", "lay", "policymaker", "kritikal", "educator"],
  },
  {
    id: "ai-judge-decision",
    title: "AI Judge Decision",
    description: "AI-generated round decisions under a round's saved judge paradigm and flow summary",
    href: "/judge-decision",
    category: "intelligence",
    tags: ["rfd", "ballot", "decision"],
  },

  // ── Practice & coaching ────────────────────────────────────────────────
  {
    id: "practice-round-simulator",
    title: "Practice Round Simulator",
    description: "Recreate a tournament round with a timer, judge paradigm, and AI opponent persona",
    href: "/practice-round",
    category: "practice",
    doc: "practice-round-simulator.md",
    tags: ["simulation", "format", "side"],
  },
  {
    id: "practice-vs-ai",
    title: "Practice vs AI",
    description: "Debate a full timed round against an AI opponent, then get a judged scorecard",
    href: "/versus-ai",
    category: "practice",
    doc: "practice-vs-ai.md",
    tags: ["speeches", "bot", "persona", "judge"],
  },
  {
    id: "opponent-persona-picker",
    title: "Opponent Persona Picker",
    description: "Pick the AI practice-opponent style for a session",
    href: "/practice-opponent",
    category: "practice",
    doc: "practice-opponent.md",
    tags: ["policy heavy", "kritik", "lay", "fast flow"],
  },
  {
    id: "ai-coach-mode",
    title: "AI Coach Mode",
    description: "Extension, refutation, collapse, and weighing prompts generated from each round's flow",
    href: "/coaching",
    category: "practice",
    doc: "coaching-sessions.md",
    tags: ["feedback", "prompts", "weighing"],
  },
  {
    id: "practice-drills",
    title: "Practice Drills",
    description: "Quick practice drills generated from each round's flow",
    href: "/drills",
    category: "practice",
    doc: "drill-sets.md",
    tags: ["overview", "frontline", "cross-ex", "collapse"],
  },

  // ── Recognition & progress ─────────────────────────────────────────────
  {
    id: "contribution-leaderboard",
    title: "Contribution Leaderboard",
    description: "Ranked contributors by helpfulness score, tier, badges, and quest streak",
    href: "/cards/leaderboard",
    category: "recognition",
    doc: "contribution-leaderboard.md",
    tags: ["ranking", "score"],
  },
  {
    id: "contributor-awards",
    title: "Top Contributor Awards",
    description: "Category winners for best evidence finder, best explainer, and more, by helpfulness score",
    href: "/cards/awards",
    category: "recognition",
    doc: "contributor-awards.md",
    tags: ["announce", "freeze", "categories"],
  },
  {
    id: "daily-best-card",
    title: "Daily Best Card Challenge",
    description: "Today's highest-helpfulness card, plus every past day's winner",
    href: "/cards/best-card",
    category: "recognition",
    doc: "daily-best-card.md",
    tags: ["winner", "vote", "daily"],
  },
  {
    id: "news-stream",
    title: "News Stream",
    description: "Product updates and community announcements — new features, Daily Best Card winners, and Contributor Award standings, in one feed",
    href: "/news",
    category: "recognition",
    doc: "news-stream.md",
    tags: ["feed", "activity", "updates", "announcements"],
  },
  {
    id: "daily-quests",
    title: "Daily Quests",
    description: 'Team goals like "find 5 solvency cards" — today\'s live progress against real contributions',
    href: "/cards/quests",
    category: "recognition",
    doc: "daily-quests.md",
    tags: ["goals", "targets", "missions"],
  },
  {
    id: "quest-streaks",
    title: "Quest Streaks",
    description: "Every contributor's daily-quest streak and the milestone badges it has earned",
    href: "/cards/streaks",
    category: "recognition",
    doc: "quest-streaks.md",
    tags: ["gamified", "badges", "streak"],
  },
  {
    id: "progress-unlocks",
    title: "Progress Unlocks",
    description: "Every contributor's unlock tier, badges, and the research-task skill level each tier grants",
    href: "/cards/progress",
    category: "recognition",
    doc: "progress-unlocks.md",
    tags: ["tiers", "levels", "unlock"],
  },
  {
    id: "group-challenges",
    title: "Group Challenges",
    description:
      "Create squad-scoped friendly challenges like completing a set of blocks or winning a rebuttal exercise",
    href: "/cards/group-challenges",
    category: "recognition",
    doc: "group-challenges.md",
    tags: ["standings", "wins", "roster"],
  },

  // ── Standings & rankings ───────────────────────────────────────────────
  {
    id: "team-rankings",
    title: "Team Rankings",
    description: "Debate team rankings, leaderboard, and Elo ratings",
    href: "/rank",
    category: "standings",
    doc: "team-rankings.md",
    tags: ["elo", "toc", "bid list", "debatedrills"],
  },
];

/** One category's label/description plus the entries filed under it. */
export interface FeatureSection {
  category: FeatureCategory;
  label: string;
  description: string;
  entries: FeatureEntry[];
}

const CATEGORY_ORDER = Object.keys(FEATURE_CATEGORY_LABELS) as FeatureCategory[];

/**
 * Groups `entries` into sections ordered by {@link FEATURE_CATEGORY_LABELS},
 * preserving each entry's relative order within its category and omitting
 * any category with no entries.
 *
 * @param entries - Features to group; defaults to the whole catalog.
 * @returns One section per non-empty category, in display order.
 */
export function buildFeatureSections(entries: FeatureEntry[] = APP_FEATURES): FeatureSection[] {
  const byCategory = new Map<FeatureCategory, FeatureEntry[]>();
  for (const entry of entries) {
    const group = byCategory.get(entry.category);
    if (group) {
      group.push(entry);
    } else {
      byCategory.set(entry.category, [entry]);
    }
  }

  return CATEGORY_ORDER.filter((category) => byCategory.has(category)).map((category) => ({
    category,
    label: FEATURE_CATEGORY_LABELS[category],
    description: FEATURE_CATEGORY_DESCRIPTIONS[category],
    entries: byCategory.get(category)!,
  }));
}

/**
 * Filters `entries` to those matching `query` on title, description, route,
 * or tags (case-insensitive, whitespace-trimmed), preserving original order.
 * An empty or whitespace-only query returns every entry unchanged.
 *
 * Matching tags as well as the visible text is what lets a debater find a
 * surface by the jargon they'd actually type — "elo", "rfd", "verbatim" —
 * none of which appear in the corresponding page's own description.
 *
 * @param entries - Features to filter.
 * @param query - Free-text search string.
 * @returns The matching subset of `entries`.
 */
export function searchFeatures(entries: FeatureEntry[], query: string): FeatureEntry[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return entries;
  return entries.filter((entry) =>
    [entry.title, entry.description, entry.href, ...(entry.tags ?? [])].some((field) =>
      field.toLowerCase().includes(needle),
    ),
  );
}

/**
 * Absolute URL of an entry's long-form feature doc.
 *
 * @param entry - The catalog entry.
 * @returns The doc's URL, or `undefined` when the entry has no doc.
 */
export function featureDocUrl(entry: FeatureEntry): string | undefined {
  return entry.doc ? `${DOCS_BASE_URL}/${entry.doc}` : undefined;
}

/**
 * Renders a short summary line for the page header, e.g.
 * "50 features across 8 categories: Core Workspaces (8), …".
 *
 * @param sections - Sections to summarize.
 * @returns A single plain-text line.
 */
export function buildFeatureCatalogSummaryText(sections: FeatureSection[]): string {
  const entryCount = sections.reduce((sum, section) => sum + section.entries.length, 0);
  const breakdown = sections.map((section) => `${section.label} (${section.entries.length})`).join(", ");
  return `${entryCount} feature${entryCount === 1 ? "" : "s"} across ${sections.length} categor${
    sections.length === 1 ? "y" : "ies"
  }: ${breakdown}`;
}
