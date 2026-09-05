/**
 * @fileoverview Renders `flow/annotation-density.ts`'s buckets as a
 * horizontal strip of bars, taller where annotations cluster — the
 * "A density scrubber on the video timeline showing where annotations
 * cluster" follow-up named under idea #15 ("Flow-in-Speech Flow
 * Annotations") in TODO.md. Clicking a bar jumps to that cluster's
 * earliest annotation via the same `jumpToAnnotation`-backed callback
 * `FlowAnnotationsPanel.tsx`'s own "Jump to" buttons use.
 *
 * @module flow/AnnotationDensityScrubber
 */

"use client"

import {
  buildAnnotationDensityBuckets,
  maxAnnotationDensityCount,
  pickBucketJumpAnnotation,
} from "./annotation-density"
import { formatAnnotationTimestamp } from "debate-round/src/flow/flow-annotations"
import type { FlowAnnotation } from "debate-round/src/flow/flow-annotations"

export interface AnnotationDensityScrubberProps {
  annotations: FlowAnnotation[]
  onJump: (annotation: FlowAnnotation) => void
}

/** Minimum visible bar height (px) so an empty bucket still reads as a tick, not a gap. */
const MIN_BAR_HEIGHT = 3
const MAX_BAR_HEIGHT = 32

export function AnnotationDensityScrubber({ annotations, onJump }: AnnotationDensityScrubberProps) {
  const buckets = buildAnnotationDensityBuckets(annotations)
  if (buckets.length === 0) return null

  const maxCount = Math.max(1, maxAnnotationDensityCount(buckets))

  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">Annotation density</p>
      <div
        className="flex h-8 items-end gap-px rounded-md border border-border bg-muted/30 p-1"
        role="group"
        aria-label="Annotation density across this flow's timeline"
      >
        {buckets.map((bucket, index) => {
          const count = bucket.annotations.length
          const height =
            count === 0 ? MIN_BAR_HEIGHT : Math.max(MIN_BAR_HEIGHT, (count / maxCount) * MAX_BAR_HEIGHT)
          const jumpTarget = pickBucketJumpAnnotation(bucket)
          const rangeLabel = `${formatAnnotationTimestamp(bucket.startMs)}–${formatAnnotationTimestamp(bucket.endMs)}`
          const label =
            count === 0
              ? `No annotations between ${rangeLabel}`
              : `${count} annotation${count === 1 ? "" : "s"} between ${rangeLabel}`

          return (
            <button
              key={`${bucket.startMs}-${index}`}
              type="button"
              title={label}
              aria-label={label}
              disabled={!jumpTarget}
              onClick={() => jumpTarget && onJump(jumpTarget)}
              className={`flex-1 rounded-sm transition-colors ${
                count > 0
                  ? "bg-primary/70 hover:bg-primary cursor-pointer"
                  : "bg-border cursor-default"
              }`}
              style={{ height }}
            />
          )
        })}
      </div>
    </div>
  )
}
