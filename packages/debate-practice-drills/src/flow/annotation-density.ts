/**
 * @fileoverview Buckets a flow's annotations into fixed-width time windows
 * across their own timestamp range, for a "density scrubber" strip above
 * `FlowAnnotationsPanel`'s annotation list — the "A density scrubber on the
 * video timeline showing where annotations cluster" follow-up named under
 * idea #15 ("Flow-in-Speech Flow Annotations") in TODO.md.
 *
 * Bucketed against the annotations' own min/max timestamp rather than the
 * recording's real duration: nothing in this repo tracks video duration
 * today (the YouTube embed exposes only playback position, via
 * `useVideoPlayerStore`'s `getCurrentTimeRef`), so a scrubber scaled to real
 * duration isn't available. Scaling to the annotated range instead still
 * answers the actual question — "where do annotations cluster relative to
 * each other" — without needing that missing data.
 *
 * @module flow/annotation-density
 */

import { sortAnnotationsByTimestamp } from "debate-round/src/flow/flow-annotations";
import type { FlowAnnotation } from "debate-round/src/flow/flow-annotations";

export type AnnotationDensityBucket = {
  startMs: number;
  endMs: number;
  /** Every annotation in this bucket, ascending by timestamp. */
  annotations: FlowAnnotation[];
};

export const DEFAULT_ANNOTATION_DENSITY_BUCKET_COUNT = 20;

/**
 * Splits `annotations`' own `[min, max]` timestamp range into `bucketCount`
 * equal-width windows and sorts every annotation into the window its
 * timestamp falls in (the last window's `endMs` is inclusive, so the
 * latest-timestamped annotation lands in the last bucket rather than
 * spilling past it). Returns `[]` for no annotations, and a single
 * full-range bucket holding all of them when every annotation shares the
 * same timestamp (a zero-width range can't be split into windows).
 *
 * Every bucket is returned, including empty ones, so a caller rendering a
 * fixed-width bar per bucket gets a stable, evenly-spaced strip rather than
 * one that reflows as clusters move in and out of view.
 */
export function buildAnnotationDensityBuckets(
  annotations: FlowAnnotation[],
  bucketCount: number = DEFAULT_ANNOTATION_DENSITY_BUCKET_COUNT,
): AnnotationDensityBucket[] {
  if (annotations.length === 0) return [];

  const sorted = sortAnnotationsByTimestamp(annotations);
  const minMs = sorted[0].timestampMs;
  const maxMs = sorted[sorted.length - 1].timestampMs;

  if (minMs === maxMs) {
    return [{ startMs: minMs, endMs: maxMs, annotations: sorted }];
  }

  const span = maxMs - minMs;
  const bucketWidth = span / bucketCount;
  const buckets: AnnotationDensityBucket[] = Array.from({ length: bucketCount }, (_, index) => ({
    startMs: minMs + index * bucketWidth,
    endMs: minMs + (index + 1) * bucketWidth,
    annotations: [],
  }));

  for (const annotation of sorted) {
    const rawIndex = Math.floor((annotation.timestampMs - minMs) / bucketWidth);
    const index = Math.min(rawIndex, bucketCount - 1);
    buckets[index].annotations.push(annotation);
  }

  return buckets;
}

/** The highest single-bucket annotation count across `buckets`, or 0 for an empty list — for scaling a density bar's height. */
export function maxAnnotationDensityCount(buckets: AnnotationDensityBucket[]): number {
  return buckets.reduce((max, bucket) => Math.max(max, bucket.annotations.length), 0);
}

/**
 * The earliest annotation in a bucket, for a "jump to this cluster" click —
 * `null` for an empty bucket. Picking the earliest (rather than e.g. the
 * most recently added) mirrors the deleted `FlowSpreadsheet` grid's own
 * `pickJumpAnnotation` convention for a multi-annotation box (see
 * `flow-annotations.md`'s "FlowSpreadsheet affordance" note).
 */
export function pickBucketJumpAnnotation(bucket: AnnotationDensityBucket): FlowAnnotation | null {
  return bucket.annotations[0] ?? null;
}
