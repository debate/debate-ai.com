import { describe, expect, it } from "vitest";
import {
  createFlowAnnotation,
  findAnnotationAtPlaybackPosition,
  formatAnnotationTimestamp,
  getAnnotationsForBox,
  getAnnotationsForSpeech,
  getAnnotationsForVideo,
  jumpToAnnotation,
  parseAnnotationTimestamp,
  parseBoxPathInput,
  resolveAnnotationBox,
  sortAnnotationsByTimestamp,
  type FlowAnnotation,
  type JumpToAnnotationDeps,
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

  it("trims a videoId and omits it entirely when blank", () => {
    expect(
      createFlowAnnotation({
        id: "a1",
        flowId: 1,
        boxPath: [0],
        speechId: "1AC",
        timestampMs: 0,
        createdAt: 0,
        videoId: "  dQw4w9WgXcQ  ",
      }).videoId,
    ).toBe("dQw4w9WgXcQ");

    expect(
      createFlowAnnotation({
        id: "a1",
        flowId: 1,
        boxPath: [0],
        speechId: "1AC",
        timestampMs: 0,
        createdAt: 0,
        videoId: "   ",
      }).videoId,
    ).toBeUndefined();
  });

  it("trims a videoTitle and omits it entirely when blank", () => {
    expect(
      createFlowAnnotation({
        id: "a1",
        flowId: 1,
        boxPath: [0],
        speechId: "1AC",
        timestampMs: 0,
        createdAt: 0,
        videoId: "dQw4w9WgXcQ",
        videoTitle: "  Round 3 vs. Lincoln  ",
      }).videoTitle,
    ).toBe("Round 3 vs. Lincoln");

    expect(
      createFlowAnnotation({
        id: "a1",
        flowId: 1,
        boxPath: [0],
        speechId: "1AC",
        timestampMs: 0,
        createdAt: 0,
        videoId: "dQw4w9WgXcQ",
        videoTitle: "   ",
      }).videoTitle,
    ).toBeUndefined();
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

describe("getAnnotationsForVideo", () => {
  it("filters to the requested video and sorts by timestamp", () => {
    const annotations = [
      annotation({ id: "vid-a-2", videoId: "vidA", timestampMs: 5000 }),
      annotation({ id: "vid-b-1", videoId: "vidB", timestampMs: 1000 }),
      annotation({ id: "vid-a-1", videoId: "vidA", timestampMs: 1000 }),
      annotation({ id: "no-video" }),
    ];

    expect(getAnnotationsForVideo(annotations, "vidA").map((a) => a.id)).toEqual([
      "vid-a-1",
      "vid-a-2",
    ]);
  });

  it("returns an empty list for a video with no annotations", () => {
    expect(getAnnotationsForVideo([annotation({ videoId: "vidA" })], "vidB")).toEqual([]);
  });
});

describe("formatAnnotationTimestamp", () => {
  it("formats sub-hour positions as m:ss", () => {
    expect(formatAnnotationTimestamp(0)).toBe("0:00");
    expect(formatAnnotationTimestamp(5_000)).toBe("0:05");
    expect(formatAnnotationTimestamp(90_000)).toBe("1:30");
  });

  it("formats hour-plus positions as h:mm:ss", () => {
    expect(formatAnnotationTimestamp(3_661_000)).toBe("1:01:01");
  });

  it("clamps a negative value to zero", () => {
    expect(formatAnnotationTimestamp(-500)).toBe("0:00");
  });
});

describe("parseAnnotationTimestamp", () => {
  it("parses m:ss and h:mm:ss", () => {
    expect(parseAnnotationTimestamp("1:30")).toBe(90_000);
    expect(parseAnnotationTimestamp("1:01:01")).toBe(3_661_000);
  });

  it("parses a bare seconds value", () => {
    expect(parseAnnotationTimestamp("45")).toBe(45_000);
  });

  it("returns null for out-of-range minutes/seconds", () => {
    expect(parseAnnotationTimestamp("1:60")).toBeNull();
    expect(parseAnnotationTimestamp("1:60:00")).toBeNull();
    expect(parseAnnotationTimestamp("1:00:60")).toBeNull();
  });

  it("returns null for malformed or empty input", () => {
    expect(parseAnnotationTimestamp("")).toBeNull();
    expect(parseAnnotationTimestamp("abc")).toBeNull();
    expect(parseAnnotationTimestamp("1:")).toBeNull();
    expect(parseAnnotationTimestamp("1:2:3:4")).toBeNull();
    expect(parseAnnotationTimestamp("-1:00")).toBeNull();
  });
});

describe("parseBoxPathInput", () => {
  it("parses a comma-separated path", () => {
    expect(parseBoxPathInput("0, 1")).toEqual([0, 1]);
    expect(parseBoxPathInput("2")).toEqual([2]);
  });

  it("returns null for empty or malformed input", () => {
    expect(parseBoxPathInput("")).toBeNull();
    expect(parseBoxPathInput("0,,1")).toBeNull();
    expect(parseBoxPathInput("0, a")).toBeNull();
    expect(parseBoxPathInput("0, -1")).toBeNull();
    expect(parseBoxPathInput("0, 1.5")).toBeNull();
  });
});

describe("jumpToAnnotation", () => {
  function fakeDeps(overrides: Partial<JumpToAnnotationDeps> = {}) {
    const calls: {
      setActiveVideo: unknown[];
      seekTo: unknown[];
      playVideo: number;
      setIsPlaying: unknown[];
    } = { setActiveVideo: [], seekTo: [], playVideo: 0, setIsPlaying: [] };
    const deps: JumpToAnnotationDeps = {
      activeVideoId: null,
      setActiveVideo: (...args) => calls.setActiveVideo.push(args),
      seekTo: (timestampMs) => calls.seekTo.push(timestampMs),
      playVideo: () => {
        calls.playVideo += 1;
      },
      setIsPlaying: (isPlaying) => calls.setIsPlaying.push(isPlaying),
      ...overrides,
    };
    return { deps, calls };
  }

  it("seeks in place when the annotation's video is already active", () => {
    const { deps, calls } = fakeDeps({ activeVideoId: "vid-1" });

    const result = jumpToAnnotation(annotation({ videoId: "vid-1", timestampMs: 4200 }), deps);

    expect(result).toBe(true);
    expect(calls.seekTo).toEqual([4200]);
    expect(calls.playVideo).toBe(1);
    expect(calls.setIsPlaying).toEqual([true]);
    expect(calls.setActiveVideo).toEqual([]);
  });

  it("switches video first when a different (or no) recording is loaded, falling back to the bare videoId as the title when no videoTitle was recorded", () => {
    const { deps, calls } = fakeDeps({ activeVideoId: "vid-1" });

    const result = jumpToAnnotation(annotation({ videoId: "vid-2", timestampMs: 4200 }), deps);

    expect(result).toBe(true);
    expect(calls.setActiveVideo).toEqual([["vid-2", "vid-2", undefined, 4.2]]);
    expect(calls.seekTo).toEqual([]);
    expect(calls.playVideo).toBe(0);
  });

  it("switches video using the annotation's own videoTitle when one was recorded", () => {
    const { deps, calls } = fakeDeps({ activeVideoId: "vid-1" });

    const result = jumpToAnnotation(
      annotation({ videoId: "vid-2", videoTitle: "Round 3 vs. Lincoln", timestampMs: 4200 }),
      deps,
    );

    expect(result).toBe(true);
    expect(calls.setActiveVideo).toEqual([["vid-2", "Round 3 vs. Lincoln", undefined, 4.2]]);
  });

  it("switches video when nothing is currently loaded", () => {
    const { deps, calls } = fakeDeps({ activeVideoId: null });

    jumpToAnnotation(annotation({ videoId: "vid-2", timestampMs: 1000 }), deps);

    expect(calls.setActiveVideo).toEqual([["vid-2", "vid-2", undefined, 1]]);
  });

  it("is a no-op when the annotation has no videoId", () => {
    const { deps, calls } = fakeDeps({ activeVideoId: "vid-1" });

    const result = jumpToAnnotation(annotation({ videoId: undefined }), deps);

    expect(result).toBe(false);
    expect(calls.setActiveVideo).toEqual([]);
    expect(calls.seekTo).toEqual([]);
    expect(calls.playVideo).toBe(0);
    expect(calls.setIsPlaying).toEqual([]);
  });
});
