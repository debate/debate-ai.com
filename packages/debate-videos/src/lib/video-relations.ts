/**
 * @fileoverview The kinds of link an editor can state between two videos.
 *
 * Kept out of the `"use client"` watch panel so server code can read them:
 * a value exported from a client module reaches a route handler as a client
 * reference, not the array, and calling `.includes` on it throws.
 * @module lib/video-relations
 */

/** Relations an editor can state between two videos. */
export const VIDEO_RELATION_KINDS = ["analysis", "related", "rematch"] as const

export type VideoRelationKind = (typeof VIDEO_RELATION_KINDS)[number]

/** How each relation reads in the list. */
export const VIDEO_RELATION_LABELS: Record<VideoRelationKind, string> = {
  analysis: "Analysis",
  related: "Related",
  rematch: "Rematch",
}
