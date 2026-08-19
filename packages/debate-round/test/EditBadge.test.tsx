/**
 * Render test for `EditBadge`, the `FlowSpreadsheet` cell affordance added
 * for idea #16's follow-up (b) in TODO.md. As in `AnnotationBadge.test.tsx`,
 * the Vitest environment is `node`, so this renders through
 * `react-dom/server` and asserts on the markup.
 */

import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { EditBadge } from "../src/flow/EditBadge";
import type { FlowEdit } from "../src/flow/shared-flow-sync";

function edit(overrides: Partial<FlowEdit> = {}): FlowEdit {
  return {
    id: "e1",
    flowId: 1,
    boxPath: [0],
    authorId: "alice",
    content: "Emissions cause extinction",
    timestampMs: 1000,
    ...overrides,
  };
}

describe("EditBadge", () => {
  it("renders a log affordance (not the count badge) for a box with no edits", () => {
    const markup = renderToStaticMarkup(<EditBadge edits={[]} onOpen={vi.fn()} />);
    expect(markup).toContain("<button");
    expect(markup).toContain('aria-label="Log a flow edit for this box"');
  });

  it("renders a count badge whose title lists every edit's author and content", () => {
    const markup = renderToStaticMarkup(
      <EditBadge
        edits={[
          edit({ id: "e1", authorId: "alice", content: "First", timestampMs: 1000 }),
          edit({ id: "e2", authorId: "bob", content: "Second", timestampMs: 2000 }),
        ]}
        onOpen={vi.fn()}
      />,
    );
    expect(markup).toContain('aria-label="2 flow edits"');
    expect(markup).toContain("bob: Second");
    expect(markup).toContain("alice: First");
  });

  it("uses singular wording for a single edit", () => {
    const markup = renderToStaticMarkup(<EditBadge edits={[edit()]} onOpen={vi.fn()} />);
    expect(markup).toContain('aria-label="1 flow edit"');
  });

  it("shows a placeholder for cleared (empty-content) edits in the tooltip", () => {
    const markup = renderToStaticMarkup(
      <EditBadge edits={[edit({ content: "" })]} onOpen={vi.fn()} />,
    );
    expect(markup).toContain("alice: (cleared)");
  });
});
