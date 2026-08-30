# Round Workspace — "Tools for this round" menu

Adds a quick-access menu to the round workspace (`/debate`) linking straight
to the flow-driven analysis tools that act on whatever flow is currently
selected — the first concrete slice of idea #17's follow-up (4) ("audit
`apps/debate-ai.com/app/tools` and the per-panel routes for tools that
exist but aren't discoverable from the main nav/dock") in `TODO.md`'s
Product Feature Ideas list.

Auditing the `/tools` catalog (`app/tools/tool-groups.ts`) against every
route under `apps/debate-ai.com/app` found no genuinely undiscoverable tool
— everything reachable outside the main dock/Settings menu is already
listed there. The real gap was elsewhere: the round workspace itself, where
a debater actually spends most of their time flowing a live round, linked
to none of the ~15 tools that read that same flow back out again (Argument
Tree Outline, AI Response-Outcome Charts, Practice Drills, AI Coach Mode,
and others) — a user had to already know a tool existed, leave the
workspace, find it in the `/tools` grid, then come back.

- **Nav:** a new wrench-icon button in the round workspace sidebar's quick-
  action row (next to the split-mode, Flow History, and Edit/New Round
  buttons)
- **Package:** [`debate-round`](../../packages/debate-round/README.md)

## What it does

Clicking the wrench icon opens a menu of the tools with their own
"Generate ... for current round" action reading `state/store.ts`'s
`useFlowStore` directly — Argument Tree Outline (`/outline`), AI
Response-Outcome Charts (`/outcomes`), Practice Drills (`/drills`), and AI
Coach Mode (`/coaching`) — each with a one-line description of what it
does with the round currently open. Every item is disabled (but still
visible, so the tool stays discoverable) until a flow is selected, mirroring
each target panel's own `disabled={!currentFlow}` gating on its "Generate
..." action; picking an enabled item navigates there, where its existing
"Generate ... for current round" button picks up the same
`useFlowStore`-selected flow.

Deliberately scoped to only the tools that read the *current* flow back —
linking to every tool in the `/tools` catalog from here would just
duplicate that grid rather than add anything specific to the workspace.

## Data flow

```
round/flow-tool-links.ts (pure — no store access, no React)
  → FLOW_TOOL_LINKS               — the curated href/label/description list
  → buildFlowToolsMenuItems(flow) — FLOW_TOOL_LINKS with a `disabled` flag,
                                     true when `flow` is null/undefined

layout/FlowToolsMenu.tsx
  → reads `layout/FlowPageSidebar.tsx`'s already-resolved `currentFlow` prop
    (no direct useFlowStore call of its own)
  → renders buildFlowToolsMenuItems(currentFlow) as a dropdown menu,
    each enabled item a next/link to its href

layout/FlowPageSidebar.tsx
  → renders <FlowToolsMenu currentFlow={currentFlow} /> as a fourth button
    in the existing quick-action row
```

Vitest-covered in `packages/debate-round/test/flowToolLinks.test.ts` (10
cases: every `FLOW_TOOL_LINKS` entry has a non-empty in-app href/label/
description with no duplicate hrefs, and `buildFlowToolsMenuItems` enables
every item for a selected flow, disables every item for `null`/`undefined`,
and preserves each link's label/description alongside the disabled flag).
`FlowToolsMenu.tsx` itself is not unit-tested — it's a thin render of
already-tested data, matching every other dropdown-menu component in this
package (e.g. `controls/ViewModeSelector.tsx`).

## Known gaps

- Only covers the four tools with a literal "Generate ... for current
  round" action as of this slice. Other panels that read `useFlowStore`
  for a narrower purpose (e.g. `CoachingProgramsPanel`'s per-roster-member
  flow recording, `PracticeRoundSimulatorPanel`'s per-saved-round feedback)
  were deliberately left out — they don't have a plain "act on whatever I'm
  flowing right now" action, so a link from here would land on a form that
  needs more than just the current flow to make sense of.
- Idea #17 follow-up (4)'s "bring weaker panel UIs up to the shared
  `debate-ui` primitive conventions" half remains open — auditing this
  slice found every panel already using shared `debate-ui` primitives (no
  outstanding weak panel identified), but that was one search pass, not an
  exhaustive one.
- No corresponding menu exists on any of the four target pages linking back
  to the round workspace or to each other.
