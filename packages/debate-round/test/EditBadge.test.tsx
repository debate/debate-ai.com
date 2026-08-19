/**
 * Render test for `EditBadge`, the `FlowSpreadsheet` cell affordance added
 * for idea #16's remaining half of follow-up (b) in TODO.md. As in
 * `AnnotationBadge.test.tsx`, the Vitest environment is `node`, so this
 * renders through `react-dom/server` and asserts on the markup — the
 * component is pure/props-driven (no store reads of its own).
 */

import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { EditBadge } from "../src/flow/EditBadge";
import type { FlowEdit } from "../src/flow/shared-flow-sync";

function edit(overrides: Partial<FlowEdit> = {}): FlowEdit {
  return {
    id: "edit-1",
    flowId: 1,
    boxPath: [0],
    authorId: "alice",
    content: "Emissions cause extinction",
    timestampMs: 1000,
    ...overrides,
  };
}

describe("EditBadge", () => {
  it("still renders a clickable affordance for a box with no edits, unlike AnnotationBadge", () => {
    const markup = renderToStaticMarkup(<EditBadge edits={[]} onOpen={vi.fn()} />);
    expect(markup).toContain("<button");
    expect(markup).toContain('aria-label="Log an edit for this box"');
    expect(markup).toContain('title="Log an edit for this box"');
  });

  it("renders a badge whose title lists every edit's author and content, newest first", () => {
    const markup = renderToStaticMarkup(
      <EditBadge
        edits={[
          edit({ id: "e1", authorId: "alice", content: "Old content", timestampMs: 1000 }),
          edit({ id: "e2", authorId: "bob", content: "New content", timestampMs: 9000 }),
        ]}
        onOpen={vi.fn()}
      />,
    );
    const titleAttr = /title="([^"]*)"/.exec(markup)?.[1] ?? "";
    expect(titleAttr.indexOf("bob: New content")).toBeLessThan(titleAttr.indexOf("alice: Old content"));
    expect(markup).toContain('aria-label="2 pending edits"');
    expect(markup).toContain(">2<");
  });

  it("uses singular wording for a single pending edit", () => {
    const markup = renderToStaticMarkup(<EditBadge edits={[edit()]} onOpen={vi.fn()} />);
    expect(markup).toContain('aria-label="1 pending edit"');
  });

  it("shows '(cleared)' for an edit whose content is blank", () => {
    const markup = renderToStaticMarkup(
      <EditBadge edits={[edit({ content: "" })]} onOpen={vi.fn()} />,
    );
    expect(markup).toContain("alice: (cleared)");
  });
});
