/**
 * Curated links to the app's workspace tools/pages outside this document —
 * the "Workspace" menu-bar category (`../react/MenuBar.tsx`) and the quick
 * card search palette's `t` prefix (`quick-card-search-ui.ts`) both list
 * these, so a tool added here is reachable both ways at once. This package
 * has no dependency on the Next.js app (and so can't import its `/tools`
 * page data directly) — keep this list in sync by hand when a major tool is
 * added there.
 */
export interface WorkspaceLink {
  href: string;
  label: string;
  description: string;
}

export const WORKSPACE_LINKS: WorkspaceLink[] = [
  { href: '/doc', label: 'Debate Docs', description: 'Annotated summaries and case outlines' },
  { href: '/research', label: 'Research Workspace', description: 'Topic coverage, evidence library, tasks, quests, review' },
  { href: '/coach', label: 'Coach Workspace', description: 'Argument tree, flow summary, drills, scouting, briefings' },
  { href: '/community-hub', label: 'Community Research Hub', description: 'Every shared research and practice space' },
  { href: '/cards/library', label: 'Evidence Library', description: 'Search shared cut cards and analytic blocks' },
  { href: '/cards/contributions', label: 'Contributions Feed', description: 'Like, save, and endorse community cards' },
  { href: '/cards/inbox', label: 'Task Inbox', description: 'Research tasks routed to contributors' },
  { href: '/news', label: 'News Stream', description: 'Product updates and community announcements' },
  { href: '/judges', label: 'Judge Profiles', description: 'Side-vote bias and speaker-point tendencies' },
  { href: '/practice-round', label: 'Practice Round Simulator', description: 'Timer, judge paradigm, AI opponent' },
  { href: '/prep-notes', label: 'Prep Notes', description: 'Live prep notes across every flow' },
  { href: '/tools', label: 'All Tools', description: 'Every workspace, research, and practice tool' },
];
