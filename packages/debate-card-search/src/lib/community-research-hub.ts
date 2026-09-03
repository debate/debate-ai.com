/**
 * @fileoverview Pure directory data for the "Community Research Hub" idea in
 * TODO.md's Research Crowdsourcing Organizer Features list ("A shared space
 * where debaters contribute cards, evidence, and summaries to a common
 * argument pool"). Every sibling bullet under that same heading already
 * shipped its own panel and route (Shared Evidence Library, Contribution
 * Leaderboard, Team Brainstorm Assist, and so on), and `/research`'s
 * `ResearchHub` already ties the card-search-side panels together — but
 * nothing lists every one of those spaces, including the round/practice
 * side ones `ResearchHub` doesn't cover (Opponent/Judge Profiles, AI Coach
 * Mode, Practice Round Simulator, AI Drill Generator), in one directory a
 * debater can browse or search. `COMMUNITY_RESEARCH_HUB_ENTRIES` is that
 * directory: a static registry of every space's title, one-line
 * description, and route, grouped into categories.
 *
 * This module only builds and filters that directory — it has no
 * localStorage store of its own, since every entry just links to a space
 * that already persists (or doesn't need to persist) its own state.
 *
 * @module lib/community-research-hub
 */

/** Groups the hub's entries roughly the way TODO.md itself describes them. */
export type CommunityHubCategory =
  | "evidence"
  | "collaboration"
  | "intelligence"
  | "practice"
  | "recognition";

/** Display order and label for each category, most contribution-focused first. */
export const COMMUNITY_HUB_CATEGORY_LABELS: Record<CommunityHubCategory, string> = {
  evidence: "Evidence & Cards",
  collaboration: "Team Collaboration",
  intelligence: "Pre-Round Intelligence",
  practice: "Practice & Coaching",
  recognition: "Recognition & Progress",
};

/** One linkable space in the hub. */
export interface CommunityHubEntry {
  id: string;
  title: string;
  description: string;
  href: string;
  category: CommunityHubCategory;
}

/**
 * Every space under TODO.md's Research Crowdsourcing Organizer Features
 * heading, excluding the hub bullet itself. Titles/descriptions/routes are
 * taken from each space's own page metadata so this directory doesn't drift
 * from what a debater actually sees after clicking through.
 */
export const COMMUNITY_RESEARCH_HUB_ENTRIES: CommunityHubEntry[] = [
  {
    id: "shared-evidence-library",
    title: "Shared Evidence Library",
    description: "Search cut cards and reusable analytic blocks by keyword, citation, or argument",
    href: "/cards/library",
    category: "evidence",
  },
  {
    id: "llm-card-scoring",
    title: "LLM Card Scoring",
    description: "Score cards for relevance, clarity, uniqueness, evidence quality, and usability",
    href: "/cards/scoring",
    category: "evidence",
  },
  {
    id: "team-brainstorm-assist",
    title: "Team Brainstorm Assist",
    description: "Submit and upvote squad ideas for an argument block, grouped into boards by category",
    href: "/cards/brainstorm",
    category: "evidence",
  },
  {
    id: "collaboration-prep-room",
    title: "Collaboration Prep Room",
    description: "A topic's shared prep space: evidence, draft blocks, and routed research tasks",
    href: "/cards/prep-room",
    category: "evidence",
  },
  {
    id: "team-collaboration-mode",
    title: "Team Collaboration Mode",
    description: "Leave live prep notes on a shared topic sprint, grouped by topic",
    href: "/cards/collaboration",
    category: "collaboration",
  },
  {
    id: "strategy-sync-notes",
    title: "Strategy Sync Notes",
    description: "Live prep notes across every flow, grouped by status",
    href: "/prep-notes",
    category: "collaboration",
  },
  {
    id: "opponent-team-profiles",
    title: "Opponent Team Profiles",
    description:
      "Records, side-record tendencies, and common arguments/cases for every saved opponent scouting profile",
    href: "/opponents",
    category: "intelligence",
  },
  {
    id: "judge-profiles",
    title: "Judge Profiles",
    description: "Side-vote bias, average speaker points, and tendencies for every saved judge profile",
    href: "/judges",
    category: "intelligence",
  },
  {
    id: "matchup-prep-dashboard",
    title: "Matchup Prep Dashboard",
    description: "Opponent scouting, judge tendencies, head-to-head record, and prep notes per round",
    href: "/briefings",
    category: "intelligence",
  },
  {
    id: "ai-practice-opponent",
    title: "AI Practice Opponent",
    description: "Pick the AI practice-opponent style for a session",
    href: "/practice-opponent",
    category: "practice",
  },
  {
    id: "ai-coach-mode",
    title: "AI Coach Mode",
    description: "Extension, refutation, collapse, and weighing prompts generated from each round's flow",
    href: "/coaching",
    category: "practice",
  },
  {
    id: "practice-round-simulator",
    title: "Practice Round Simulator",
    description: "Recreate a tournament round with a timer, judge paradigm, and AI opponent persona",
    href: "/practice-round",
    category: "practice",
  },
  {
    id: "ai-drill-generator",
    title: "AI Drill Generator",
    description: "Quick practice drills generated from each round's flow",
    href: "/drills",
    category: "practice",
  },
  {
    id: "contribution-leaderboard",
    title: "Contribution Leaderboard",
    description: "Ranked contributors by helpfulness score, tier, badges, and quest streak",
    href: "/cards/leaderboard",
    category: "recognition",
  },
  {
    id: "gamified-quests",
    title: "Gamified Quests",
    description: "Every contributor's daily-quest streak and the milestone badges it has earned",
    href: "/cards/streaks",
    category: "recognition",
  },
  {
    id: "daily-quests-and-targets",
    title: "Daily Quests and Targets",
    description: "Team goals like \"find 5 solvency cards\" — today's live progress against real contributions",
    href: "/cards/quests",
    category: "recognition",
  },
  {
    id: "progress-unlocks",
    title: "Progress Unlocks",
    description: "Every contributor's unlock tier, badges, and daily-quest streak",
    href: "/cards/progress",
    category: "recognition",
  },
];

/** One category's label plus the entries in it, in `COMMUNITY_HUB_CATEGORY_LABELS` order. */
export interface CommunityHubSection {
  category: CommunityHubCategory;
  label: string;
  entries: CommunityHubEntry[];
}

const CATEGORY_ORDER = Object.keys(COMMUNITY_HUB_CATEGORY_LABELS) as CommunityHubCategory[];

/**
 * Groups `entries` into sections ordered by `COMMUNITY_HUB_CATEGORY_LABELS`,
 * preserving each entry's relative order within its category and omitting
 * any category with no entries.
 */
export function buildCommunityResearchHubSections(
  entries: CommunityHubEntry[] = COMMUNITY_RESEARCH_HUB_ENTRIES,
): CommunityHubSection[] {
  const byCategory = new Map<CommunityHubCategory, CommunityHubEntry[]>();
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
    label: COMMUNITY_HUB_CATEGORY_LABELS[category],
    entries: byCategory.get(category)!,
  }));
}

/**
 * Filters `entries` to those whose title or description contains `query`
 * (case-insensitive, whitespace-trimmed), preserving original order. An
 * empty/whitespace-only query returns every entry unchanged.
 */
export function searchCommunityResearchHubEntries(
  entries: CommunityHubEntry[],
  query: string,
): CommunityHubEntry[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return entries;
  return entries.filter(
    (entry) =>
      entry.title.toLowerCase().includes(needle) || entry.description.toLowerCase().includes(needle),
  );
}

/**
 * Filters `entries` to the ones a debater has already favorited elsewhere in
 * the app (the same `/tools`-page star, account-synced via
 * `favoriteTools.ts`), preserving `entries`' own order — the hub's
 * "For You" section. A hub entry counts as favorited purely by exact `href`
 * match against `favoriteHrefs`; no category-affinity guessing, so the
 * section only ever shows spaces the debater explicitly starred themselves.
 * Returns `[]` when nothing favorited is in the hub (e.g. signed out, or
 * every favorite is a tool the hub doesn't list), so a caller can treat an
 * empty result as "don't render this section" without a separate check.
 */
export function buildForYouEntries(
  entries: CommunityHubEntry[],
  favoriteHrefs: readonly string[],
): CommunityHubEntry[] {
  if (favoriteHrefs.length === 0) return [];
  const favorited = new Set(favoriteHrefs);
  return entries.filter((entry) => favorited.has(entry.href));
}

/** Renders a short summary line for a hub header, e.g. "17 spaces across 5 categories". */
export function buildCommunityResearchHubSummaryText(sections: CommunityHubSection[]): string {
  const entryCount = sections.reduce((sum, section) => sum + section.entries.length, 0);
  const breakdown = sections.map((section) => `${section.label} (${section.entries.length})`).join(", ");
  return `${entryCount} space${entryCount === 1 ? "" : "s"} across ${sections.length} categor${
    sections.length === 1 ? "y" : "ies"
  }: ${breakdown}`;
}
