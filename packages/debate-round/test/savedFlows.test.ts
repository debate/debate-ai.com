import { describe, expect, it } from "vitest";
import { deriveFlowLabel, isValidFlow } from "../src/state/savedFlows";
import type { Box, Flow } from "debate-core/src/types/flow";

function makeBox(overrides: Partial<Box> = {}): Box {
  return { content: "", children: [], index: 0, level: 0, focus: false, ...overrides };
}

function makeFlow(overrides: Partial<Flow> = {}): Flow {
  return {
    content: "1AC",
    level: 0,
    columns: ["1AC", "1NC"],
    invert: false,
    focus: false,
    index: 0,
    lastFocus: [0],
    children: [makeBox()],
    id: 1700000000000,
    ...overrides,
  };
}

describe("isValidFlow", () => {
  it("accepts a well-formed flow with an empty box tree", () => {
    expect(isValidFlow(makeFlow({ children: [] }))).toBe(true);
  });

  it("accepts a well-formed flow with a nested box tree", () => {
    const nested = makeBox({ children: [makeBox({ children: [makeBox()] })] });
    expect(isValidFlow(makeFlow({ children: [nested] }))).toBe(true);
  });

  it("accepts optional fields (speechDocs, sharedSpeeches, archived, roundId, speechNumber, winner) when present", () => {
    const flow = makeFlow({
      speechDocs: { "1AC": "doc text" },
      sharedSpeeches: { "1AC": { timestamp: 1, emails: ["a@b.com"] } },
      archived: true,
      roundId: 42,
      speechNumber: 1,
      winner: "aff",
    });
    expect(isValidFlow(flow)).toBe(true);
  });

  it.each([null, undefined, "flow", 42, [], true])("rejects a non-object value %p", (value) => {
    expect(isValidFlow(value)).toBe(false);
  });

  it.each([
    "content",
    "level",
    "columns",
    "invert",
    "focus",
    "index",
    "lastFocus",
    "children",
    "id",
  ] as const)("rejects a flow missing required field %p", (field) => {
    const flow = makeFlow() as unknown as Record<string, unknown>;
    delete flow[field];
    expect(isValidFlow(flow)).toBe(false);
  });

  it("rejects a flow whose columns array contains a non-string", () => {
    expect(isValidFlow(makeFlow({ columns: ["1AC", 2 as unknown as string] }))).toBe(false);
  });

  it("rejects a flow whose lastFocus array contains a non-number", () => {
    expect(isValidFlow(makeFlow({ lastFocus: [0, "1" as unknown as number] }))).toBe(false);
  });

  it("rejects a flow whose children contain a malformed box (missing required Box field)", () => {
    const malformedBox = { content: "x", children: [], index: 0, level: 0 } as unknown as Box; // missing `focus`
    expect(isValidFlow(makeFlow({ children: [malformedBox] }))).toBe(false);
  });

  it("rejects a flow whose nested box tree contains a malformed descendant", () => {
    const badDescendant = { content: "x", children: [], index: 0, level: 0 } as unknown as Box; // missing `focus`
    const tree = makeBox({ children: [makeBox({ children: [badDescendant] })] });
    expect(isValidFlow(makeFlow({ children: [tree] }))).toBe(false);
  });

  it("rejects a box tree deeper than the recursion cap", () => {
    let box: Box = makeBox();
    for (let i = 0; i < 250; i++) {
      box = makeBox({ children: [box] });
    }
    expect(isValidFlow(makeFlow({ children: [box] }))).toBe(false);
  });
});

describe("deriveFlowLabel", () => {
  it("uses the flow's content, trimmed", () => {
    expect(deriveFlowLabel({ content: "  1AC Case  ", speechNumber: undefined })).toBe("1AC Case");
  });

  it("falls back to the speech number when content is empty", () => {
    expect(deriveFlowLabel({ content: "", speechNumber: 3 })).toBe("Speech 3");
  });

  it("falls back to the speech number when content is only whitespace", () => {
    expect(deriveFlowLabel({ content: "   ", speechNumber: 2 })).toBe("Speech 2");
  });

  it("falls back to 'Untitled flow' when content is empty and there is no speech number", () => {
    expect(deriveFlowLabel({ content: "", speechNumber: undefined })).toBe("Untitled flow");
  });

  it("truncates very long content to 120 characters", () => {
    const long = "x".repeat(200);
    const label = deriveFlowLabel({ content: long, speechNumber: undefined });
    expect(label).toHaveLength(120);
    expect(label).toBe("x".repeat(120));
  });
});
