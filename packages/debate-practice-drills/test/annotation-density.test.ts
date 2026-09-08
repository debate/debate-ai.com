import { describe, expect, it } from "vitest";
import {
  buildAnnotationDensityBuckets,
  maxAnnotationDensityCount,
  pickBucketJumpAnnotation,
} from "../src/flow/annotation-density";
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

describe("buildAnnotationDensityBuckets", () => {
  it("returns an empty array for no annotations", () => {
    expect(buildAnnotationDensityBuckets([])).toEqual([]);
  });

  it("returns one full-range bucket holding every annotation when all share a timestamp", () => {
    const annotations = [
      annotation({ id: "a", timestampMs: 5000 }),
      annotation({ id: "b", timestampMs: 5000 }),
    ];
    const buckets = buildAnnotationDensityBuckets(annotations);
    expect(buckets).toHaveLength(1);
    expect(buckets[0]).toMatchObject({ startMs: 5000, endMs: 5000 });
    expect(buckets[0].annotations).toHaveLength(2);
  });

  it("returns exactly bucketCount buckets, including empty ones, spanning the annotations' own range", () => {
    const annotations = [
      annotation({ id: "a", timestampMs: 0 }),
      annotation({ id: "b", timestampMs: 100_000 }),
    ];
    const buckets = buildAnnotationDensityBuckets(annotations, 10);
    expect(buckets).toHaveLength(10);
    expect(buckets[0].startMs).toBe(0);
    expect(buckets[9].endMs).toBe(100_000);
    // Endpoints land in the first/last bucket; the 8 buckets between are empty.
    expect(buckets.filter((b) => b.annotations.length === 0)).toHaveLength(8);
  });

  it("sorts every annotation into the bucket its timestamp falls in", () => {
    const annotations = [
      annotation({ id: "early", timestampMs: 0 }),
      annotation({ id: "mid-1", timestampMs: 4000 }),
      annotation({ id: "mid-2", timestampMs: 4500 }),
      annotation({ id: "late", timestampMs: 10_000 }),
    ];
    const buckets = buildAnnotationDensityBuckets(annotations, 10);
    expect(buckets[0].annotations.map((a) => a.id)).toEqual(["early"]);
    expect(buckets[4].annotations.map((a) => a.id)).toEqual(["mid-1", "mid-2"]);
    expect(buckets[9].annotations.map((a) => a.id)).toEqual(["late"]);
  });

  it("puts the latest-timestamped annotation in the last bucket rather than spilling past it", () => {
    const annotations = [annotation({ id: "start", timestampMs: 0 }), annotation({ id: "end", timestampMs: 9999 })];
    const buckets = buildAnnotationDensityBuckets(annotations, 5);
    expect(buckets).toHaveLength(5);
    expect(buckets[4].annotations.map((a) => a.id)).toEqual(["end"]);
  });

  it("orders each bucket's annotations ascending by timestamp regardless of input order", () => {
    const annotations = [
      annotation({ id: "end", timestampMs: 10_000 }),
      annotation({ id: "later", timestampMs: 4900 }),
      annotation({ id: "start", timestampMs: 0 }),
      annotation({ id: "earlier", timestampMs: 4100 }),
    ];
    const buckets = buildAnnotationDensityBuckets(annotations, 10);
    expect(buckets[4].annotations.map((a) => a.id)).toEqual(["earlier", "later"]);
  });

  it("defaults to DEFAULT_ANNOTATION_DENSITY_BUCKET_COUNT buckets", () => {
    const annotations = [annotation({ id: "a", timestampMs: 0 }), annotation({ id: "b", timestampMs: 1000 })];
    expect(buildAnnotationDensityBuckets(annotations)).toHaveLength(20);
  });
});

describe("maxAnnotationDensityCount", () => {
  it("returns 0 for an empty bucket list", () => {
    expect(maxAnnotationDensityCount([])).toBe(0);
  });

  it("returns the highest single-bucket count", () => {
    const buckets = buildAnnotationDensityBuckets(
      [
        annotation({ id: "a", timestampMs: 0 }),
        annotation({ id: "b", timestampMs: 100 }),
        annotation({ id: "c", timestampMs: 9000 }),
      ],
      5,
    );
    expect(maxAnnotationDensityCount(buckets)).toBe(2);
  });
});

describe("pickBucketJumpAnnotation", () => {
  it("returns null for an empty bucket", () => {
    expect(pickBucketJumpAnnotation({ startMs: 0, endMs: 1000, annotations: [] })).toBeNull();
  });

  it("returns the earliest annotation in the bucket", () => {
    const earlier = annotation({ id: "earlier", timestampMs: 100 });
    const later = annotation({ id: "later", timestampMs: 900 });
    expect(pickBucketJumpAnnotation({ startMs: 0, endMs: 1000, annotations: [earlier, later] })).toBe(earlier);
  });
});
