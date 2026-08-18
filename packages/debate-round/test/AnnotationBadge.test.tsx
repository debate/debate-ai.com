/**
 * Render test for `AnnotationBadge`, the `FlowSpreadsheet` cell affordance
 * added for idea #15's follow-up (b) in TODO.md. As in `panels.test.tsx`,
 * the Vitest environment is `node`, so this renders through
 * `react-dom/server` and asserts on the markup — the component is
 * pure/props-driven (no store reads of its own).
 */

import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { AnnotationBadge } from "../src/flow/AnnotationBadge";
import type { FlowAnnotation } from "../src/flow/flow-annotations";

function annotation(overrides: Partial<FlowAnnotation> = {}): FlowAnnotation {
  return {
    id: "a1",
    flowId: 1,
    boxPath: [0],
    speechId: "1AC",
    timestampMs: 90_000,
    createdAt: 0,
    ...overrides,
  };
}

describe("AnnotationBadge", () => {
  it("renders nothing for a box with no annotations", () => {
    const markup = renderToStaticMarkup(
      <AnnotationBadge annotations={[]} onJump={vi.fn()} />,
    );
    expect(markup).toBe("");
  });

  it("renders a badge whose title lists every annotation's formatted timestamp and note", () => {
    const markup = renderToStaticMarkup(
      <AnnotationBadge
        annotations={[
          annotation({ id: "a1", timestampMs: 90_000, note: "Solvency claim" }),
          annotation({ id: "a2", timestampMs: 150_000 }),
        ]}
        onJump={vi.fn()}
      />,
    );
    expect(markup).toContain("<button");
    expect(markup).toContain("1:30 — Solvency claim");
    expect(markup).toContain("2:30");
    expect(markup).toContain('aria-label="2 flow annotations"');
  });

  it("uses singular wording for a single annotation", () => {
    const markup = renderToStaticMarkup(
      <AnnotationBadge annotations={[annotation()]} onJump={vi.fn()} />,
    );
    expect(markup).toContain('aria-label="1 flow annotation"');
  });
});
