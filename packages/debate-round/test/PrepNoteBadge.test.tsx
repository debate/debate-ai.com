/**
 * Render test for `PrepNoteBadge`, the `FlowSpreadsheet` cell affordance
 * added to close the "no note-creation UI" gap in
 * `docs/features/prep-notes.md`. As in `EditBadge.test.tsx`, the Vitest
 * environment is `node`, so this renders through `react-dom/server` and
 * asserts on the markup — the component is pure/props-driven (no store
 * reads of its own).
 */

import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { PrepNoteBadge } from "../src/flow/PrepNoteBadge";
import type { PrepNote } from "../src/flow/strategy-sync-notes";

function note(overrides: Partial<PrepNote> = {}): PrepNote {
  return {
    id: "note-1",
    flowId: 1,
    boxPath: [0],
    authorId: "alice",
    text: "Answer the solvency turn",
    status: "open",
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  };
}

describe("PrepNoteBadge", () => {
  it("still renders a clickable affordance for a box with no notes, unlike AnnotationBadge", () => {
    const markup = renderToStaticMarkup(<PrepNoteBadge notes={[]} onOpen={vi.fn()} />);
    expect(markup).toContain("<button");
    expect(markup).toContain('aria-label="Add a prep note for this box"');
    expect(markup).toContain('title="Add a prep note for this box"');
  });

  it("renders a badge whose title lists every note's author and text, oldest first", () => {
    const markup = renderToStaticMarkup(
      <PrepNoteBadge
        notes={[
          note({ id: "n1", authorId: "bob", text: "Newer note", createdAt: 9000 }),
          note({ id: "n2", authorId: "alice", text: "Older note", createdAt: 1000 }),
        ]}
        onOpen={vi.fn()}
      />,
    );
    const titleAttr = /title="([^"]*)"/.exec(markup)?.[1] ?? "";
    expect(titleAttr.indexOf("alice: Older note")).toBeLessThan(titleAttr.indexOf("bob: Newer note"));
    expect(markup).toContain('aria-label="2 prep notes"');
    expect(markup).toContain(">2<");
  });

  it("uses singular wording for a single note", () => {
    const markup = renderToStaticMarkup(<PrepNoteBadge notes={[note()]} onOpen={vi.fn()} />);
    expect(markup).toContain('aria-label="1 prep note"');
  });
});
