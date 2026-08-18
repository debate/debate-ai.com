/**
 * Render test for the Shared Flow Sync panel.
 *
 * As in the other packages, the Vitest environment is `node`, so this renders
 * through `react-dom/server` and asserts on the markup: the panel is checked
 * against the output of the `flow/shared-flow-sync.ts` slice it presents.
 *
 * Every other panel in this package reads its own store and is covered by that
 * store's own suite; this one is the only panel driven entirely by props.
 */

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Box, Flow } from "debate-core/src/types/flow";

import { SharedFlowSyncPanel } from "../src/panels/SharedFlowSyncPanel";
import type { FlowEdit } from "../src/flow/shared-flow-sync";

const COLUMNS = ["1AC", "1NC", "2AC", "2NC"];

/** Builds a row's box chain from per-column content; "" leaves a column unflowed. */
function rowFromContents(contents: string[], overrides: Partial<Box> = {}): Box {
  let box: Box | undefined;
  for (let i = contents.length - 1; i >= 0; i--) {
    const current: Box = {
      content: contents[i],
      children: box ? [box] : [],
      index: 0,
      level: i + 1,
      focus: false,
      empty: !contents[i].trim(),
    };
    box = current;
  }
  return { ...(box as Box), ...overrides };
}

const flow: Flow = {
  content: "",
  level: 0,
  columns: COLUMNS,
  invert: false,
  focus: false,
  index: 0,
  lastFocus: [],
  id: 7,
  roundId: 7,
  children: [
    rowFromContents(["Warming advantage", "", "", ""], { isHeading: true }),
    rowFromContents(["Emissions cause extinction", "No warming impact", "Extend warming", ""]),
    rowFromContents(["Adaptation solves", "", "", ""]),
  ],
};

describe("SharedFlowSyncPanel", () => {
  const edits: FlowEdit[] = [
    { id: "e1", flowId: 7, boxPath: [1], authorId: "alice", content: "New tag", timestampMs: 1_000 },
    { id: "e2", flowId: 7, boxPath: [1], authorId: "bob", content: "Other tag", timestampMs: 1_200 },
  ];

  it("shows the merge result and flags the conflicting box", () => {
    const html = renderToStaticMarkup(<SharedFlowSyncPanel flow={flow} edits={edits} />);
    expect(html).toContain("Shared Flow Sync");
    expect(html).toContain("Conflicts");
    expect(html).toContain("alice");
  });
});
