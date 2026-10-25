/**
 * @fileoverview Pure data for the app-wide features page (`/practice/features`).
 *
 * The app ships roughly fifty distinct surfaces, but nothing lists them all:
 * the global dock exposes four destinations plus a long, flat Settings menu;
 * `/research` and `/coaching` tab across the panels of one package each, but
 * none of them mention the core workspaces (card search, the flow
 * spreadsheet, the video archive, the Reason editor) or the rankings and
 * standings surfaces at all, so a new debater has no single page that
 * outlines what the app actually does.
 *
 * `APP_FEATURES` is that outline: every user-facing surface's title,
 * one-line description, route, category, and — where one exists — its
 * long-form doc under `packages/debate-help-docs/content/docs/features/`. Titles and descriptions are taken
 * from each route's own page metadata (or its feature doc's opening lines),
 * so this catalog reads the same as the page a reader lands on after
 * clicking through.
 *
 * This is the single canonical copy: the live `/practice/features` page
 * (`lib/ui/features/FeaturesPanel`) reads from here instead of keeping a
 * hand-synced fork.
 *
 * Like other pure catalog/directory modules in the app, this module is pure: it has no store of its own, because every entry links to a
 * surface that already persists (or doesn't need to persist) its own state.
 *
 * @module feature-catalog
 */

/**
 * Where the feature docs are served from by default: same origin as the app
 * (`/docs/features/<name>`, extension stripped) — the live `/practice/features` page's
 * own docs site (the app mounts `debate-help-docs` at `app/docs`, which
 * renders `packages/debate-help-docs/content/docs/features/<name>.mdx`
 * there). Renderers with no docs site of their own to link into
 * (News Stream's spotlights, say) pass {@link GITHUB_DOCS_BASE_URL} to
 * {@link featureDocUrl} instead.
 */
const DEFAULT_DOCS_BASE_URL = "/docs/features";

/** Docs base URL for a renderer with no in-app docs site to link into. */
export const GITHUB_DOCS_BASE_URL = "https://github.com/debate/debate-ai.com/blob/master/docs/features";

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
  | "documents";

/** Display order and label for each category, broadest surfaces first. */
export const FEATURE_CATEGORY_LABELS: Record<FeatureCategory, string> = {
  workspaces: "Core Workspaces",
  evidence: "Evidence & Research",
  collaboration: "Team Collaboration",
  round: "Flowing & Round Analysis",
  intelligence: "Pre-Round Intelligence",
  practice: "Practice & Coaching",
  recognition: "Recognition & Progress",
  documents: "Documents",
};

/** One line under each category heading explaining what the group is for. */
export const FEATURE_CATEGORY_DESCRIPTIONS: Record<FeatureCategory, string> = {
  workspaces: "The main destinations — everything else is reachable from one of these.",
  evidence: "Find, cut, score, review, and organize the cards a squad runs.",
  collaboration: "Shared prep spaces, note handoffs, and coach-run team programs.",
  round: "Turn a flowed round into outlines, summaries, annotations, and exposure charts.",
  intelligence: "What you know about the opponent and judge before the round starts.",
  practice: "Practice rounds, drills, and AI coaching between tournaments.",
  recognition: "Quests, streaks, awards, unlocks, and standings that reward contributing research.",
  documents: "Research documents, the card editor, speech docs, and the shared Google Drive folder of PDF guides.",
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
  /** File name under `packages/debate-help-docs/content/docs/features/`, when a long-form doc exists. */
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
    tags: ["learn", "lectures", "rounds", "youtube", "archive", "@debate-ai/videos"],
    doc: "video-library.md",
  },
  {
    id: "card-search",
    title: "Card Search",
    description:
      "Full-text search across tagged, annotated evidence cards, with highlight, underline, and plain reading modes",
    href: "/research/cards",
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
    tags: ["fiat", "flow", "spreadsheet", "timer", "round", "@debate-ai/round"],
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
    href: "/coaching",
    category: "workspaces",
    tags: ["hub", "coach", "flow sync"],
  },
  // ── Evidence & research ────────────────────────────────────────────────
  {
    id: "shared-evidence-library",
    title: "Shared Evidence Library",
    description: "Search cut cards and reusable analytic blocks by keyword, citation, or argument",
    href: "/research/cards/library",
    category: "evidence",
    doc: "evidence-library.md",
    tags: ["repository", "submit", "tf-idf", "search index"],
  },
  {
    id: "common-argument-library",
    title: "Common Argument Library",
    description: "Browse shared research organized into topic folders, case areas, and tag-based collections",
    href: "/research/cards/argument-library",
    category: "evidence",
    tags: ["folders", "case areas", "tags", "blocks"],
    doc: "argument-library-collections.md",
  },
  {
    id: "file-market",
    title: "File Market",
    description: "Sell your research files or buy other debaters'; every file's table of contents is a free preview, and buying unlocks the cards",
    href: "/research/market",
    category: "evidence",
    doc: "file-market.md",
    tags: ["sell", "buy", "wallet", "stripe", "preview", "table of contents"],
  },
  {
    id: "llm-card-scoring",
    title: "LLM Card Scoring",
    description: "Score cards for relevance, clarity, uniqueness, evidence quality, and usability",
    href: "/research/cards/scoring",
    category: "evidence",
    doc: "llm-card-scoring.md",
    tags: ["ai", "duplicate", "ranking", "quality"],
  },
  {
    id: "revision-incentives",
    title: "Revision Incentives",
    description:
      "Contributors ranked by reward points earned improving weak cards, strengthening citations, and refreshing stale evidence",
    href: "/research/cards/revisions",
    category: "evidence",
    doc: "revision-incentives.md",
    tags: ["rewards", "stale", "citations"],
  },
  {
    id: "research-progress",
    title: "Research Progress",
    description: "Each contributor's contribution history and per-topic task completion",
    href: "/coaching/progress",
    category: "evidence",
    doc: "research-progress-tracking.md",
    tags: ["tracking", "completion"],
  },

  // ── Team collaboration ─────────────────────────────────────────────────
  {
    id: "team-research",
    title: "Team Research",
    description:
      "Topic coverage, the collaboration prep room, review queue, task inbox, contributions feed and team brainstorm board, one tab each on a single page",
    href: "/research/team",
    category: "collaboration",
    doc: "team-research.md",
    tags: ["coverage", "gaps", "prep room", "peer review", "tasks", "routing", "feed", "endorse", "brainstorm", "ideas"],
  },
  {
    id: "team-collaboration-mode",
    title: "Team Collaboration Mode",
    description: "Leave live prep notes on a shared topic sprint, grouped by topic",
    href: "/research/cards/collaboration",
    category: "collaboration",
    doc: "team-collaboration-mode.md",
    tags: ["sprint notes", "assign"],
  },
  {
    id: "contacts",
    title: "Contacts",
    description:
      "Account-linked contacts list with requests and blocking, online presence, and live co-editing cards shared straight to a contact's account",
    href: "/contacts",
    category: "collaboration",
    doc: "contacts.md",
    tags: ["friends", "share", "block", "presence"],
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
    href: "/coaching?section=programs",
    category: "collaboration",
    doc: "coaching-programs.md",
    tags: ["squad", "roster", "program", "board"],
  },
  {
    id: "team-calendar",
    title: "Team Calendar",
    description:
      "A month calendar per coaching group: research tasks and assignments with deadlines and assignees, plus virtual tournaments only that group enters",
    href: "/coaching?section=calendar",
    category: "collaboration",
    doc: "team-calendar.md",
    tags: ["calendar", "deadlines", "todo", "assignments", "schedule", "tournament"],
  },
  {
    id: "coach-materials",
    title: "Coach Materials",
    description: "Upload grounding materials for the team coach AI and preview which ones answer a question",
    href: "/coaching?section=materials",
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
    id: "prep-workspace",
    title: "Prep Workspace",
    description:
      "Pre-round briefings, scout-to-strategy case rankings, opponent team profiles, judge profiles, prep notes, practice partners and practice drills, one tab each on a single page",
    href: "/practice/prep",
    category: "intelligence",
    doc: "prep-workspace.md",
    tags: ["briefings", "scouting", "opponents", "judges", "case choice", "prep notes", "matchup"],
  },
  {
    id: "ai-judge-decision",
    title: "AI Judge Decision",
    description: "AI-generated round decisions under a round's saved judge paradigm and flow summary",
    href: "/practice/judge-decision",
    category: "intelligence",
    tags: ["rfd", "ballot", "decision"],
  },

  // ── Practice & coaching ────────────────────────────────────────────────
  {
    id: "practice-partners",
    title: "Practice Partners",
    description: "Challenge other debaters to a virtual practice round, or volunteer to debate or judge in the styles you're comfortable with",
    href: "/practice/prep?section=partners",
    category: "practice",
    doc: "practice-partners.md",
    tags: ["challenge", "volunteer", "judge", "matchmaking"],
  },
  {
    id: "prediction-markets",
    title: "Prediction Markets",
    description: "Bet play-money points on who wins a debate, who wins a tournament, and whose team rating goes up",
    href: "/practice/predictions",
    category: "practice",
    doc: "prediction-markets.md",
    tags: ["betting", "forecast", "points", "rankings", "tournaments"],
  },
  {
    id: "practice-vs-ai",
    title: "Practice vs AI",
    description: "Choose a difficulty, topic and opponent; the AI preps cards, cases and an argument summary, then debates you in a timed round",
    href: "/practice/versus-ai",
    category: "practice",
    doc: "practice-vs-ai.md",
    tags: ["speeches", "bot", "persona", "judge", "simulation", "prep", "difficulty"],
  },
  {
    id: "ai-coach-mode",
    title: "AI Coach Mode",
    description: "Extension, refutation, collapse, and weighing prompts generated from each round's flow",
    href: "/coaching?section=ai-coach",
    category: "practice",
    doc: "coaching-sessions.md",
    tags: ["feedback", "prompts", "weighing"],
  },
  {
    id: "practice-drills",
    title: "Practice Drills",
    description: "Quick practice drills generated from each round's flow",
    href: "/practice/prep?section=drills",
    category: "practice",
    doc: "drill-sets.md",
    tags: ["overview", "frontline", "cross-ex", "collapse"],
  },

  // ── Recognition & progress ─────────────────────────────────────────────
  {
    id: "contribution-leaderboard",
    title: "Contribution Leaderboard",
    description: "Ranked contributors by helpfulness score, tier, badges, and quest streak",
    href: "/coaching/leaderboard",
    category: "recognition",
    doc: "contribution-leaderboard.md",
    tags: ["ranking", "score"],
  },
  {
    id: "contributor-awards",
    title: "Top Contributor Awards",
    description: "Category winners for best evidence finder, best explainer, and more, by helpfulness score",
    href: "/research/cards/awards",
    category: "recognition",
    doc: "contributor-awards.md",
    tags: ["announce", "freeze", "categories"],
  },
  {
    id: "daily-best-card",
    title: "Daily Best Card Challenge",
    description: "Today's highest-helpfulness card, plus every past day's winner",
    href: "/research/cards/best-card",
    category: "recognition",
    doc: "daily-best-card.md",
    tags: ["winner", "vote", "daily"],
  },
  {
    id: "news-stream",
    title: "News & Forums",
    description: "Product updates, community announcements and forum threads — new features, Daily Best Card winners, Contributor Award standings, and the discussions moving fastest",
    href: "/news",
    category: "recognition",
    doc: "news-stream.md",
    tags: ["feed", "activity", "updates", "announcements", "forums", "discussion", "threads"],
  },
  {
    id: "daily-quests",
    title: "Daily Quests",
    description: 'Team goals like "find 5 solvency cards" — today\'s live progress against real contributions',
    href: "/research/cards/quests",
    category: "recognition",
    doc: "daily-quests.md",
    tags: ["goals", "targets", "missions"],
  },
  {
    id: "quest-streaks",
    title: "Quest Streaks",
    description: "Every contributor's daily-quest streak and the milestone badges it has earned",
    href: "/research/cards/streaks",
    category: "recognition",
    doc: "quest-streaks.md",
    tags: ["gamified", "badges", "streak"],
  },
  {
    id: "debater-level",
    title: "Debater Level",
    description: "Earn XP and level up by completing challenges like cutting 5 cards or redoing a rebuttal",
    href: "/research/team?section=level",
    category: "recognition",
    tags: ["gamified", "xp", "levels", "challenges"],
  },
  {
    id: "progress-unlocks",
    title: "Progress Unlocks",
    description: "Every contributor's unlock tier, badges, and the research-task skill level each tier grants",
    href: "/research/cards/progress",
    category: "recognition",
    doc: "progress-unlocks.md",
    tags: ["tiers", "levels", "unlock"],
  },
  {
    id: "group-challenges",
    title: "Group Challenges",
    description:
      "Create squad-scoped friendly challenges like completing a set of blocks or winning a rebuttal exercise",
    href: "/research/cards/group-challenges",
    category: "recognition",
    doc: "group-challenges.md",
    tags: ["standings", "wins", "roster"],
  },
  {
    id: "team-rankings",
    title: "Team Rankings",
    description: "Debate team rankings, leaderboard, and Elo ratings",
    href: "/coaching/rankings",
    category: "recognition",
    doc: "team-rankings.md",
    tags: ["elo", "toc", "bid list", "debatedrills"],
  },

  // ── Documents ──────────────────────────────────────────────────────────
  {
    id: "reason-docs",
    title: "Reason Docs",
    description: "The nested research-document tree — Research Editor for Annotated Summaries in Outline Notation",
    href: "/research/docs",
    category: "documents",
    doc: "reason-docs-sidebar.md",
    tags: ["docs", "documents", "notes", "outline", "topic starters", "my personal documents", "cmir", "file manager"],
  },
  {
    id: "reason-editor",
    title: "Reason Editor",
    description:
      "The rich-text card editor: a Google-Docs-style menu bar (File/Edit/Card/Format/Insert/AI/View/Tools/Workspace), a Ctrl/Cmd-P command palette that also jumps to other tools, Verbatim/Debate Editor-compatible shortcuts, an outline nav panel, and a send-to-speech-document command",
    href: "/reason-editor",
    category: "documents",
    doc: "legacy-verbatim-shortcuts.md",
    tags: ["verbatim", "debate editor", "tiptap", "editor", "docx", "reason-editor", "menu bar", "command palette", "workspace", "read mode"],
  },
  {
    id: "speech-documents",
    title: "Speech Documents",
    description: "History of evidence sent into the designated speech document from the Reason Editor",
    href: "/speech-documents",
    category: "documents",
    doc: "speech-document-target.md",
    tags: ["send to speech", "debate editor", "prosemirror"],
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

/** Options controlling how {@link featureDocUrl} resolves an entry's doc link. */
export interface FeatureDocUrlOptions {
  /**
   * Base URL to resolve `entry.doc` against.
   * Defaults to the live docs site's `/docs/features`.
   */
  baseUrl?: string;
  /**
   * Whether to drop `doc`'s `.md`/`.mdx` extension, matching the published
   * docs site's route (extensionless). Defaults to `true`.
   */
  stripExtension?: boolean;
}

/**
 * URL of an entry's long-form feature doc.
 *
 * `doc` names the source file (`drill-sets.md`) under
 * `packages/debate-help-docs/content/docs/features/`. By default this
 * resolves to the published, extensionless route on the app's own docs site
 * (`/docs/features/drill-sets`); pass `{ baseUrl: GITHUB_DOCS_BASE_URL,
 * stripExtension: false }` for a renderer with no docs site of its own to
 * link into instead.
 *
 * @param entry - The catalog entry.
 * @param options - See {@link FeatureDocUrlOptions}.
 * @returns The doc's URL, or `undefined` when the entry has no doc.
 */
export function featureDocUrl(entry: FeatureEntry, options: FeatureDocUrlOptions = {}): string | undefined {
  if (!entry.doc) return undefined;
  const baseUrl = options.baseUrl ?? DEFAULT_DOCS_BASE_URL;
  const stripExtension = options.stripExtension ?? true;
  const doc = stripExtension ? entry.doc.replace(/\.mdx?$/, "") : entry.doc;
  return `${baseUrl}/${doc}`;
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
