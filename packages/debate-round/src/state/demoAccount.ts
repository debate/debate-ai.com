/**
 * @fileoverview The shared demo account — a stable, publicly sign-in-able
 * user (`POST /api/demo/login` in `apps/debate-ai.com`, "Try the demo
 * account" on `/login`) pre-loaded with sample documents, saved flows, and
 * shared files so a visitor can tour `/library`, the Reason Editor, and
 * the flow workspace without creating an account first. See
 * docs/features/user-library.md.
 *
 * This module owns the account's identity constants and the seed content
 * builder; the route consumes both. Kept framework/fetch-free so the seed
 * can be unit-tested here (`apps/debate-ai.com` has no vitest project).
 *
 * @module state/demoAccount
 */

import type { Box, Flow } from "../types/flow";
import { newFlow } from "../utils/flow-utils";
import { debateStyleMap } from "debate-timer/src/formats/debate-format-times";

/** The demo account's identity. The email doubles as the "is this the demo user?" check. */
export const DEMO_ACCOUNT = {
  email: "demo@debate-ai.com",
  name: "Demo Debater",
} as const;

/** Whether `email` (any casing) is the shared demo account. */
export function isDemoAccountEmail(email: string | null | undefined): boolean {
  return (email ?? "").trim().toLowerCase() === DEMO_ACCOUNT.email;
}

/** A document (or folder) the demo account is seeded with. Files reference their folder by `folder` title. */
export interface DemoDocumentSeed {
  title: string;
  content: string;
  folder?: string;
  isFolder?: boolean;
}

/** A shared-library file the demo account publishes. */
export interface DemoSharedFileSeed {
  title: string;
  content: string;
  tags: string[];
  published: boolean;
}

export interface DemoSeed {
  documents: DemoDocumentSeed[];
  flows: Flow[];
  sharedFiles: DemoSharedFileSeed[];
}

/**
 * Stable, deterministic `Flow.id`s for the seeded flows. `saved_flows` is
 * unique on `(user_id, client_id)`, so re-running the seed upserts these
 * rows rather than piling up duplicates every time someone signs in.
 */
export const DEMO_FLOW_IDS = {
  policy: 1_750_000_000_001,
  publicForum: 1_750_000_000_002,
  lincolnDouglas: 1_750_000_000_003,
} as const;

/** Writes `content` into the cell at (`row`, `column`) of a `newFlow`-shaped column-chain flow. */
export function setFlowCell(flow: Flow, row: number, column: number, content: string): void {
  let box: Box | undefined = flow.children[row];
  for (let c = 0; c < column && box; c++) box = box.children[0];
  if (box) box.content = content;
}

/** Reads the cell at (`row`, `column`), or `""` when the flow has no such cell. */
export function getFlowCell(flow: Flow, row: number, column: number): string {
  let box: Box | undefined = flow.children[row];
  for (let c = 0; c < column && box; c++) box = box.children[0];
  return box?.content ?? "";
}

function styleIndex(key: (typeof debateStyleMap)[number]): number {
  return debateStyleMap.indexOf(key);
}

function seededFlow(
  key: "policy" | "publicForum" | "lincolnDouglas",
  title: string,
  rows: string[][],
  speechDocs: Record<string, string> = {},
): Flow {
  const flow = newFlow(0, "primary", false, styleIndex(key));
  if (!flow) throw new Error(`debate-timer has no primary flow for ${key}`);
  flow.id = DEMO_FLOW_IDS[key];
  flow.content = title;
  rows.forEach((cells, row) => cells.forEach((cell, column) => setFlowCell(flow, row, column, cell)));
  if (Object.keys(speechDocs).length > 0) flow.speechDocs = speechDocs;
  return flow;
}

const CASE_OUTLINE_HTML = `<h1>1AC — Federal Clean Energy Investment</h1>
<h2>Plan</h2>
<p>The United States federal government should substantially increase its investment in domestic clean-energy manufacturing.</p>
<h2>Advantage 1 — Climate</h2>
<p><strong>Warming is accelerating and the window for mitigation is closing.</strong></p>
<p><em>IPCC, 2023</em> — "Every increment of global warming will intensify multiple and concurrent hazards."</p>
<p><strong>Domestic manufacturing capacity is the bottleneck for deployment.</strong></p>
<h2>Advantage 2 — Economy</h2>
<p><strong>Clean-energy jobs are the fastest-growing sector in the labor market.</strong></p>
<p>Investment creates durable employment in regions hit hardest by deindustrialization.</p>
<h2>Solvency</h2>
<p>Federal investment crowds in private capital at a three-to-one ratio.</p>`;

const BLOCKS_HTML = `<h1>2AC Blocks</h1>
<h2>AT: Spending Disadvantage</h2>
<p><strong>No link</strong> — the plan is funded through existing appropriations.</p>
<p><strong>Turn</strong> — clean-energy investment pays for itself through tax revenue within a decade.</p>
<h2>AT: States Counterplan</h2>
<p><strong>Perm do both</strong> — federal coordination is necessary for interstate supply chains.</p>
<p><strong>Solvency deficit</strong> — states lack the fiscal capacity for manufacturing-scale investment.</p>
<h2>AT: Capitalism Kritik</h2>
<p><strong>Perm</strong> — do the plan and reject capitalism in every other instance.</p>
<p><strong>No alternative</strong> — the alt has no mechanism to change energy policy.</p>`;

const PREP_NOTES_HTML = `<h1>Tournament Prep Checklist</h1>
<ul>
<li>Update the 1AC with the new manufacturing statistics.</li>
<li>Cut two more impact cards for the economy advantage.</li>
<li>Re-read the judge paradigm for the first elimination round.</li>
<li>Print a fresh copy of the 2AC blocks.</li>
</ul>
<p>Use the <strong>Shared Files</strong> panel in the editor to pull the Topic Starter evidence into this folder.</p>`;

const SHARED_TOPIC_BRIEF_HTML = `<h1>Topic Brief — Clean Energy Manufacturing</h1>
<p>A starter outline for anyone new to the topic: the key affirmative advantages, the most common negative positions, and the best places to begin research.</p>
<h2>Affirmative ground</h2>
<ul><li>Climate mitigation timelines</li><li>Manufacturing jobs and regional economies</li><li>Supply-chain resilience</li></ul>
<h2>Negative ground</h2>
<ul><li>Spending and inflation disadvantages</li><li>States and private-sector counterplans</li><li>Degrowth and capitalism kritiks</li></ul>
<h2>Where to start</h2>
<p>Search the CARDS library for "clean energy manufacturing" and sort by most-cited.</p>`;

const SHARED_DRILL_HTML = `<h1>Rebuttal Drill — Answering the Spending DA</h1>
<p>Set a two-minute timer and deliver the four answers below from memory. Repeat until every answer lands with a warrant and an impact comparison.</p>
<ol>
<li>No link — existing appropriations.</li>
<li>Link turn — investment raises revenue.</li>
<li>Impact defense — deficit spending doesn't cause collapse.</li>
<li>Impact turn — stimulus prevents recession.</li>
</ol>`;

/**
 * The full set of sample content the demo account is seeded with. Every
 * title is unique within its kind so the route can seed idempotently by
 * title (documents, shared files) or by `Flow.id` (flows).
 */
export function buildDemoSeed(): DemoSeed {
  const documents: DemoDocumentSeed[] = [
    { title: "Clean Energy Aff", content: "", isFolder: true },
    { title: "1AC — Clean Energy Manufacturing", content: CASE_OUTLINE_HTML, folder: "Clean Energy Aff" },
    { title: "2AC Blocks", content: BLOCKS_HTML, folder: "Clean Energy Aff" },
    { title: "Tournament Prep Checklist", content: PREP_NOTES_HTML },
  ];

  const flows: Flow[] = [
    seededFlow(
      "policy",
      "Round 3 — Clean Energy Aff vs. Spending DA",
      [
        ["Plan: increase clean-energy manufacturing investment", "Spending DA — deficit spending tanks the economy", "No link — funded through existing appropriations", "Link — new spending is new spending", "", "Extend no link + link turn", "Even if the link is small, the impact outweighs", "Link turn outweighs — investment raises revenue"],
        ["Adv 1: Climate — window is closing", "Impact defense — warming is slow", "IPCC says every increment matters", "", "Their evidence is pre-2020", "Extend IPCC — most recent and most qualified", "", "Climate outweighs on magnitude and timeframe"],
        ["Adv 2: Economy — manufacturing jobs", "States CP solves the economy", "Perm do both — federal coordination is key", "CP solves 100% of the advantage", "", "Solvency deficit — states can't fund at scale", "Perm severs federal action", "Perm is legitimate — the CP is plan-plus"],
      ],
      { "1AC": "<p>Read the 1AC from the Clean Energy Aff folder.</p>" },
    ),
    seededFlow(
      "publicForum",
      "Scrimmage — Public Forum practice",
      [
        ["Contention 1: Jobs", "Turn — automation replaces workers", "Automation creates more jobs than it removes", "", "Extend the turn", "Their turn has no impact"],
        ["Contention 2: Innovation", "Non-unique — innovation is already happening", "Investment accelerates the timeline", "", "", "Timeline is the whole debate"],
      ],
    ),
    seededFlow(
      "lincolnDouglas",
      "LD — Value debate practice",
      [
        ["Value: Justice / Criterion: Maximizing well-being", "Value: Liberty / Criterion: Minimizing coercion", "Well-being subsumes liberty", "", ""],
        ["Contention: Public goods require collective action", "Contention: Coercive taxation violates consent", "Consent theory proves too much", "", ""],
      ],
    ),
  ];

  const sharedFiles: DemoSharedFileSeed[] = [
    { title: "Topic Brief — Clean Energy Manufacturing", content: SHARED_TOPIC_BRIEF_HTML, tags: ["topic-brief", "policy", "demo"], published: true },
    { title: "Rebuttal Drill — Answering the Spending DA", content: SHARED_DRILL_HTML, tags: ["drill", "rebuttal", "demo"], published: true },
    { title: "Private Draft — Not yet shared", content: "<p>This file stays visible only to the demo account until it is published.</p>", tags: ["draft"], published: false },
  ];

  return { documents, flows, sharedFiles };
}
