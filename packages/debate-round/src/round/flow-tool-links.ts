/**
 * @fileoverview Round-workspace "Tools for this round" quick-access menu —
 * TODO.md idea #17 ("User Settings — account-linked debate preferences"),
 * follow-up (4): "audit `apps/debate-ai.com/app/tools` and the per-panel
 * routes for tools that exist but aren't discoverable from the main
 * nav/dock." The `/tools` catalog itself already lists every tool (there
 * turned out to be no undiscoverable route once audited), but the round
 * workspace at `/debate` — where a debater actually spends most of their
 * time flowing a live round — links to none of them: a user has to already
 * know a tool exists, leave the workspace, find it in the `/tools` grid,
 * then come back. This module is the data half of a fix: a small, curated
 * list of the tools that specifically act on "the round workspace's
 * currently selected flow" (each has its own "Generate ... for current
 * round" action reading `state/store.ts`'s `useFlowStore`, per
 * `ArgumentTreePanel.tsx`/`VulnerabilityChartsPanel.tsx`/
 * `DrillSetsPanel.tsx`/`CoachingSessionsPanel.tsx`'s own header comments) —
 * so linking to them from the workspace itself is actually meaningful, not
 * just a duplicate of the `/tools` grid.
 *
 * Kept deliberately small and specific rather than mirroring the app's
 * whole `app/tools/tool-groups.ts` catalog: that catalog is app-specific
 * (owns every tool, including ones with nothing to do with a live flow),
 * while this list is scoped to what a signed-in-or-not debater actively
 * flowing a round would want next, and lives in this shared package
 * because `layout/FlowToolsMenu.tsx` (the UI half) is rendered from
 * `layout/FlowPageSidebar.tsx`, part of the round workspace itself.
 *
 * @module round/flow-tool-links
 */

import type { Flow } from "../types/flow";

/** One entry in the round workspace's "Tools for this round" menu. */
export interface FlowToolLink {
  /** In-app route this tool lives at. */
  href: string;
  /** Short label shown in the menu. */
  label: string;
  /** One-line description of what the tool does with the current flow. */
  description: string;
}

/**
 * Every tool with a "Generate ... for current round" action that reads the
 * round workspace's currently selected flow directly from `useFlowStore`,
 * in menu display order. Adding a new such tool here is the whole wiring
 * needed for it to show up in the round workspace's quick-access menu.
 */
export const FLOW_TOOL_LINKS: FlowToolLink[] = [
  {
    href: "/outline",
    label: "Argument Tree Outline",
    description: "Generate a filterable outline of this round's flow, grouped by heading.",
  },
  {
    href: "/outcomes",
    label: "AI Response-Outcome Charts",
    description: "See per-side exposure and the most vulnerable arguments in this round's flow.",
  },
  {
    href: "/drills",
    label: "Practice Drills",
    description: "Generate quick practice drills from this round's flowed arguments.",
  },
  {
    href: "/coaching",
    label: "AI Coach Mode",
    description: "Get extension, refutation, collapse, and weighing prompts for this round.",
  },
];

/** One {@link FlowToolLink} plus whether it's currently actionable. */
export interface FlowToolMenuItem extends FlowToolLink {
  /** True when there's no current flow for the linked tool to act on yet. */
  disabled: boolean;
}

/**
 * Builds the round workspace's "Tools for this round" menu items, disabling
 * every entry when there's no current flow to generate a report from —
 * mirroring each target panel's own `disabled={!currentFlow}` gating on its
 * "Generate ... for current round" action, so the menu never links to a
 * tool that would just show an empty/disabled state on arrival.
 *
 * @param currentFlow - The round workspace's currently selected flow, or `null`/`undefined` if none is selected.
 */
export function buildFlowToolsMenuItems(currentFlow: Flow | null | undefined): FlowToolMenuItem[] {
  const disabled = !currentFlow;
  return FLOW_TOOL_LINKS.map((link) => ({ ...link, disabled }));
}
