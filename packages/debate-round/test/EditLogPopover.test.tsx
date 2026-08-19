/**
 * Render test for `EditLogPopover`, the `FlowSpreadsheet` cell affordance
 * added for idea #16's follow-up (b) in TODO.md. As in `panels.test.tsx`,
 * the Vitest environment is `node`, so this renders through
 * `react-dom/server` and asserts on the markup.
 */

import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { EditLogPopover } from "../src/flow/EditLogPopover";
import type { FlowEdit } from "../src/flow/shared-flow-sync";

function edit(overrides: Partial<FlowEdit> = {}): FlowEdit {
  return {
    id: "e1",
    flowId: 1,
    boxPath: [0, 1],
    authorId: "alice",
    content: "Emissions cause extinction",
    timestampMs: 1000,
    ...overrides,
  };
}

describe("EditLogPopover", () => {
  it("shows the box path and an empty state when there are no edits yet", () => {
    const markup = renderToStaticMarkup(
      <EditLogPopover flowId={7} boxPath={[0, 1]} edits={[]} onLog={vi.fn()} onClose={vi.fn()} />,
    );
    expect(markup).toContain("box 0.1");
    expect(markup).toContain("No edits logged for this box yet.");
  });

  it("lists every edit for the box, newest first", () => {
    const markup = renderToStaticMarkup(
      <EditLogPopover
        flowId={7}
        boxPath={[0, 1]}
        edits={[
          edit({ id: "early", authorId: "alice", content: "First", timestampMs: 1000 }),
          edit({ id: "late", authorId: "bob", content: "Second", timestampMs: 2000 }),
        ]}
        onLog={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    const bobIndex = markup.indexOf("bob");
    const aliceIndex = markup.indexOf("alice");
    expect(bobIndex).toBeGreaterThan(-1);
    expect(aliceIndex).toBeGreaterThan(bobIndex);
    expect(markup).toContain("Second");
    expect(markup).toContain("First");
  });

  it("shows a placeholder for a cleared (empty-content) edit", () => {
    const markup = renderToStaticMarkup(
      <EditLogPopover
        flowId={7}
        boxPath={[0]}
        edits={[edit({ content: "" })]}
        onLog={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(markup).toContain("(cleared)");
  });

  it("always renders the log-an-edit form", () => {
    const markup = renderToStaticMarkup(
      <EditLogPopover flowId={7} boxPath={[0]} edits={[]} onLog={vi.fn()} onClose={vi.fn()} />,
    );
    expect(markup).toContain("Author ID");
    expect(markup).toContain("Proposed content for this box");
    expect(markup).toContain("Log edit");
  });
});
