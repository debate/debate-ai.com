import { describe, expect, it } from "vitest";
import {
  buildFlowAnnotationsExportText,
  flowAnnotationsExportFilename,
} from "../src/flow/flow-annotations-export";
import type { FlowAnnotation } from "debate-round/src/flow/flow-annotations";

function annotation(overrides: Partial<FlowAnnotation> = {}): FlowAnnotation {
  return {
    id: "a1",
    flowId: 1,
    boxPath: [0],
    speechId: "1AC",
    timestampMs: 1000,
    createdAt: 0,
    ...overrides,
  };
}

describe("buildFlowAnnotationsExportText", () => {
  it("renders a header naming the flow", () => {
    expect(buildFlowAnnotationsExportText([], 4)).toContain("Flow Annotations — Flow 4");
  });

  it("returns a no-annotations message when the flow has none", () => {
    expect(buildFlowAnnotationsExportText([], 4)).toBe(
      "Flow Annotations — Flow 4\n\nNo annotations for this flow.",
    );
  });

  it("ignores annotations belonging to a different flowId", () => {
    const text = buildFlowAnnotationsExportText(
      [annotation({ flowId: 1 }), annotation({ id: "other", flowId: 2 })],
      1,
    );
    expect(text.split("\n").filter(Boolean)).toHaveLength(2);
  });

  it("renders an annotation's timestamp, speech, and box path with no suffix when untagged", () => {
    const text = buildFlowAnnotationsExportText(
      [annotation({ timestampMs: 90_000, speechId: "1AC", boxPath: [0, 1] })],
      1,
    );
    expect(text).toContain("- [1:30] 1AC box [0, 1]");
    expect(text).not.toContain("(");
  });

  it("appends speaker and tag in a fixed order when set", () => {
    const text = buildFlowAnnotationsExportText(
      [annotation({ speaker: "Jordan", tag: "solvency" })],
      1,
    );
    expect(text).toContain("(speaker: Jordan; tag: solvency)");
  });

  it("only includes the tags that are actually set", () => {
    const text = buildFlowAnnotationsExportText([annotation({ tag: "turn" })], 1);
    expect(text).toContain("(tag: turn)");
  });

  it("appends the note on its own indented line when set", () => {
    const text = buildFlowAnnotationsExportText(
      [annotation({ note: "Solvency claim starts here" })],
      1,
    );
    expect(text).toContain("\n  Solvency claim starts here");
  });

  it("orders annotations by timestamp regardless of input order", () => {
    const text = buildFlowAnnotationsExportText(
      [
        annotation({ id: "later", timestampMs: 5000, speechId: "later" }),
        annotation({ id: "earlier", timestampMs: 1000, speechId: "earlier" }),
      ],
      1,
    );
    const lines = text.split("\n").filter((line) => line.startsWith("-"));
    expect(lines[0]).toContain("earlier");
    expect(lines[1]).toContain("later");
  });
});

describe("flowAnnotationsExportFilename", () => {
  it("builds a filename from the flow id", () => {
    expect(flowAnnotationsExportFilename(4)).toBe("flow-annotations-flow-4.txt");
  });

  it("works for flow id 0", () => {
    expect(flowAnnotationsExportFilename(0)).toBe("flow-annotations-flow-0.txt");
  });
});
