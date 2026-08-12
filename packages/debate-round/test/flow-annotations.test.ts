import { describe, expect, it } from "vitest";
import {
  createFlowAnnotation,
  findAnnotationAtPlaybackPosition,
  getAnnotationsForBox,
  getAnnotationsForSpeech,
  resolveAnnotationBox,
  sortAnnotationsByTimestamp,
  type FlowAnnotation,
} from "../src/flow/flow-annotations";
import { newBox } from "../src/utils/flow-utils";

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

describe("createFlowAnnotation", () => {
  it("builds an annotation from valid input", () => {
    expect(
      createFlowAnnotation({
        id: "a1",
        flowId: 1,
        boxPath: [0, 1],
        speechId: "1AC",
        timestampMs: 4200,
        createdAt: 1000,
      }),
    ).toEqual({
      id: "a1",
      flowId: 1,
      boxPath: [0, 1],
      speechId: "1AC",
      timestampMs: 4200,
      createdAt: 1000,
    });
  });

  it("trims a note and omits it entirely when blank", () => {
    expect(
      createFlowAnnotation({
        id: "a1",
        flowId: 1,
        boxPath: [0],
        speechId: "1AC",
        timestampMs: 0,
        createdAt: 0,
        note: "  turned the case  ",
      }).note,
    ).toBe("turned the case");

    expect(
      createFlowAnnotation({
        id: "a1",
        flowId: 1,
        boxPath: [0],
        speechId: "1AC",
        timestampMs: 0,
        createdAt: 0,
        note: "   ",
      }).note,
    ).toBeUndefined();
  });

  it("clamps an overlong note to the max length", () => {
    const result = createFlowAnnotation({
      id: "a1",
      flowId: 1,
      boxPath: [0],
      speechId: "1AC",
      timestampMs: 0,
      createdAt: 0,
      note: "x".repeat(600),
    });
    expect(result.note).toHaveLength(500);
  });

  it("throws for an empty boxPath", () => {
    expect(() =>
      createFlowAnnotation({
        id: "a1",
        flowId: 1,
        boxPath: [],
        speechId: "1AC",
        timestampMs: 0,
        createdAt: 0,
      }),
    ).toThrow(/boxPath/);
  });

  it("throws for a blank speechId", () => {
    expect(() =>
      createFlowAnnotation({
        id: "a1",
        flowId: 1,
        boxPath: [0],
        speechId: "   ",
        timestampMs: 0,
        createdAt: 0,
      }),
    ).toThrow(/speechId/);
  });

  it("throws for a negative timestamp", () => {
    expect(() =>
      createFlowAnnotation({
        id: "a1",
        flowId: 1,
        boxPath: [0],
        speechId: "1AC",
        timestampMs: -1,
        createdAt: 0,
      }),
    ).toThrow(/timestampMs/);
  });
});

describe("sortAnnotationsByTimestamp", () => {
  it("sorts ascending without mutating the input", () => {
    const input = [annotation({ id: "b", timestampMs: 3000 }), annotation({ id: "a", timestampMs: 1000 })];
    const sorted = sortAnnotationsByTimestamp(input);

    expect(sorted.map((a) => a.id)).toEqual(["a", "b"]);
    expect(input.map((a) => a.id)).toEqual(["b", "a"]);
  });
});

describe("getAnnotationsForSpeech", () => {
  it("filters to the requested speech and sorts by timestamp", () => {
    const annotations = [
      annotation({ id: "1ac-2", speechId: "1AC", timestampMs: 5000 }),
      annotation({ id: "1nc-1", speechId: "1NC", timestampMs: 1000 }),
      annotation({ id: "1ac-1", speechId: "1AC", timestampMs: 1000 }),
    ];

    expect(getAnnotationsForSpeech(annotations, "1AC").map((a) => a.id)).toEqual([
      "1ac-1",
      "1ac-2",
    ]);
  });
});

describe("getAnnotationsForBox", () => {
  it("filters by both flowId and boxPath", () => {
    const annotations = [
      annotation({ id: "match", flowId: 1, boxPath: [0, 1], timestampMs: 2000 }),
      annotation({ id: "other-flow", flowId: 2, boxPath: [0, 1], timestampMs: 1000 }),
      annotation({ id: "other-path", flowId: 1, boxPath: [0, 2], timestampMs: 1000 }),
      annotation({ id: "match-earlier", flowId: 1, boxPath: [0, 1], timestampMs: 500 }),
    ];

    expect(getAnnotationsForBox(annotations, 1, [0, 1]).map((a) => a.id)).toEqual([
      "match-earlier",
      "match",
    ]);
  });
});

describe("findAnnotationAtPlaybackPosition", () => {
  const annotations = [
    annotation({ id: "first", speechId: "1AC", timestampMs: 1000 }),
    annotation({ id: "second", speechId: "1AC", timestampMs: 5000 }),
    annotation({ id: "other-speech", speechId: "1NC", timestampMs: 2000 }),
  ];

  it("returns the latest annotation at or before the given position", () => {
    expect(findAnnotationAtPlaybackPosition(annotations, "1AC", 5000)?.id).toBe("second");
    expect(findAnnotationAtPlaybackPosition(annotations, "1AC", 4999)?.id).toBe("first");
  });

  it("returns null before the first annotation or with no annotations in the speech", () => {
    expect(findAnnotationAtPlaybackPosition(annotations, "1AC", 999)).toBeNull();
    expect(findAnnotationAtPlaybackPosition(annotations, "2AC", 999999)).toBeNull();
  });
});

describe("resolveAnnotationBox", () => {
  const flow = {
    children: [
      { ...newBox(0, 1), children: [newBox(0, 2, false), newBox(1, 2, true)] },
      newBox(1, 1),
    ],
  };

  it("resolves the box a nested annotation path points to", () => {
    const box = resolveAnnotationBox(flow, annotation({ boxPath: [0, 1] }));
    expect(box).toMatchObject({ index: 1, level: 2, focus: true });
  });

  it("returns null when the path no longer resolves (e.g. rows were removed)", () => {
    expect(resolveAnnotationBox(flow, annotation({ boxPath: [5, 0] }))).toBeNull();
  });
});
