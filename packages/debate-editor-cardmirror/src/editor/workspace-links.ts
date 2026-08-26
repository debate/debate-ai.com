/**
 * Curated links to the app's workspace tools/pages outside this document —
 * the "Workspace" menu-bar category (`../react/MenuBar.tsx`) and the quick
 * card search palette's `t` prefix (`quick-card-search-ui.ts`) both list
 * these, so a tool added here is reachable both ways at once. This package
 * has no dependency on the Next.js app (and so can't import its `/tools`
 * page data directly) — keep this list in sync by hand when a major tool is
 * added there.
 *
 * Grouped under the same four headings as `/tools` (`category`), so the
 * menu bar's dropdown reads as a miniature copy of that page rather than
 * one long undifferentiated list once it covers most of the app's ~50
 * surfaces. An entry with no `category` renders in a trailing, unlabeled
 * group — currently just the "All Tools" link back to the full page.
 */
export interface WorkspaceLink {
  href: string;
  label: string;
  description: string;
  /** Matches a `/tools` page heading; omit for a trailing, unlabeled entry. */
  category?: 'Workspaces' | 'Community & Progress' | 'Prep & Practice' | 'Coaching & Analytics';
}

export const WORKSPACE_LINKS: WorkspaceLink[] = [
  // ── Workspaces ──────────────────────────────────────────────────────────
  { href: '/doc', label: 'Debate Docs', description: 'Annotated summaries and case outlines', category: 'Workspaces' },
  { href: '/research', label: 'Research Workspace', description: 'Topic coverage, evidence library, tasks, quests, review', category: 'Workspaces' },
  { href: '/coach', label: 'Coach Workspace', description: 'Argument tree, flow summary, drills, scouting, briefings', category: 'Workspaces' },
  { href: '/community-hub', label: 'Community Research Hub', description: 'Every shared research and practice space', category: 'Workspaces' },

  // ── Community & Progress ────────────────────────────────────────────────
  { href: '/cards/leaderboard', label: 'Leaderboard', description: 'Helpfulness score, tier, badges, and quest streak', category: 'Community & Progress' },
  { href: '/news', label: 'News Stream', description: 'Product updates and community announcements', category: 'Community & Progress' },
  { href: '/cards/contributions', label: 'Contributions Feed', description: 'Like, save, and endorse community cards', category: 'Community & Progress' },
  { href: '/cards/awards', label: 'Contributor Awards', description: 'Category winners for best evidence finder, best explainer, and more', category: 'Community & Progress' },
  { href: '/cards/best-card', label: 'Daily Best Card', description: "Today's highest-helpfulness card, plus every past winner", category: 'Community & Progress' },
  { href: '/cards/inbox', label: 'Task Inbox', description: 'Research tasks routed to contributors', category: 'Community & Progress' },
  { href: '/cards/progress', label: 'Progress', description: 'Unlock tier, badges, and daily-quest streak per contributor', category: 'Community & Progress' },
  { href: '/cards/library', label: 'Evidence Library', description: 'Search shared cut cards and analytic blocks', category: 'Community & Progress' },
  { href: '/cards/revisions', label: 'Revision Incentives', description: 'Reward points for improving weak cards and stale citations', category: 'Community & Progress' },
  { href: '/cards/reviews', label: 'Review Queue', description: 'Move a card through comment, approve, and publish', category: 'Community & Progress' },
  { href: '/cards/argument-library', label: 'Argument Library', description: 'Topic folders, case areas, and tag-based collections', category: 'Community & Progress' },
  { href: '/cards/group-challenges', label: 'Group Challenges', description: 'Squad-scoped challenges with live standings and an MVP badge', category: 'Community & Progress' },
  { href: '/cards/coverage', label: 'Topic Coverage Dashboard', description: 'Missing, thin, and covered arguments per topic', category: 'Community & Progress' },
  { href: '/cards/prep-room', label: 'Collaboration Prep Room', description: "A topic's evidence, draft blocks, and routed tasks", category: 'Community & Progress' },
  { href: '/cards/progress-tracking', label: 'Research Progress', description: 'Contribution history and per-topic task completion', category: 'Community & Progress' },
  { href: '/cards/streaks', label: 'Quest Streaks', description: 'Daily-quest streak and milestone badges per contributor', category: 'Community & Progress' },
  { href: '/cards/quests', label: 'Daily Quests', description: 'Team goals tracked against live contribution progress', category: 'Community & Progress' },
  { href: '/cards/brainstorm', label: 'Team Brainstorm Assist', description: 'Submit and upvote ideas for an argument block', category: 'Community & Progress' },
  { href: '/cards/collaboration', label: 'Team Collaboration Mode', description: 'Live prep notes on a shared topic sprint', category: 'Community & Progress' },

  // ── Prep & Practice ─────────────────────────────────────────────────────
  { href: '/prep-notes', label: 'Prep Notes', description: 'Live prep notes across every flow', category: 'Prep & Practice' },
  { href: '/notifications', label: 'Notifications', description: 'Assignee notifications for handed-off prep notes', category: 'Prep & Practice' },
  { href: '/judges', label: 'Judge Profiles', description: 'Side-vote bias and speaker-point tendencies', category: 'Prep & Practice' },
  { href: '/opponents', label: 'Opponent Team Profiles', description: 'Side-record tendencies and common arguments per opponent', category: 'Prep & Practice' },
  { href: '/drills', label: 'Practice Drills', description: "Overview, frontline, cross-ex, and collapse prompts from a round's flow", category: 'Prep & Practice' },
  { href: '/briefings', label: 'Pre-Round Briefings', description: 'Opponent scouting, judge tendencies, and prep notes combined', category: 'Prep & Practice' },
  { href: '/coaching', label: 'AI Coach Mode', description: 'Extension, refutation, collapse, and weighing prompts', category: 'Prep & Practice' },
  { href: '/paradigms', label: 'Judge Paradigm Picker', description: 'Six built-in paradigms or a custom judge paradigm', category: 'Prep & Practice' },
  { href: '/judge-decision', label: 'AI Judge Decision', description: 'An AI round decision under a saved paradigm and flow', category: 'Prep & Practice' },
  { href: '/summaries', label: 'Speech Transcript Summaries', description: 'Per-argument summaries with cross-exam questions', category: 'Prep & Practice' },
  { href: '/practice-opponent', label: 'Opponent Persona Picker', description: 'Four built-in personas or a custom opponent style', category: 'Prep & Practice' },
  { href: '/word-count', label: 'Word-Count Speeches', description: 'A live word-count readout instead of a timer', category: 'Prep & Practice' },
  { href: '/outline', label: 'Argument Tree Outline', description: 'Filterable, heading-grouped outline of a flow', category: 'Prep & Practice' },
  { href: '/versus-ai', label: 'Online Debate Versus AI', description: 'A full practice round against an AI opponent', category: 'Prep & Practice' },
  { href: '/practice-round', label: 'Practice Round Simulator', description: 'Timer, judge paradigm, AI opponent', category: 'Prep & Practice' },
  { href: '/annotations', label: 'Flow Annotations', description: 'Timestamped notes on a streamed or recorded round', category: 'Prep & Practice' },

  // ── Coaching & Analytics ────────────────────────────────────────────────
  { href: '/standings', label: 'CX NDCA Standings', description: 'Cumulative, ranked season standings', category: 'Coaching & Analytics' },
  { href: '/outcomes', label: 'AI Response-Outcome Charts', description: 'Per-side exposure and most-vulnerable arguments', category: 'Coaching & Analytics' },
  { href: '/coaching-programs', label: 'Coaching Programs', description: "A coach's squad-scoped coaching space and boards", category: 'Coaching & Analytics' },
  { href: '/coach-materials', label: 'Coach Materials', description: 'Grounding materials for the team coach AI', category: 'Coaching & Analytics' },

  // ── Trailing, unlabeled ─────────────────────────────────────────────────
  { href: '/tools', label: 'All Tools', description: 'Every workspace, research, and practice tool' },
];
