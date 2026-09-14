/**
 * @fileoverview Turning a loaded page of videos into the slots the results
 * actually render — one per stacked playlist, one per standalone video.
 *
 * A stacked playlist is a small group of videos the library knows belong
 * together: a round and the round-analysis video made from it, a debate split
 * across two uploads, the parts of a lecture series. The server marks each row
 * with its stack key (`debate-data-sync/src/videos/video-stacks.ts` says how a
 * stack is formed) and `/api/videos/stacks` resolves those keys to their full
 * membership; this module does the last step, which is purely positional: the
 * *first* row of a stack to appear in the feed keeps its place in the results
 * and the rest of the stack folds into it, so the grid's order is still the
 * feed's order and nothing is silently dropped from view.
 *
 * Kept free of React so the collapsing rule can be tested as a list-in,
 * list-out function.
 * @module components/video-grid/video-stacks
 */

import type { VideoType } from "../../types/videos";

/** Tuple index carrying the stack key. */
export const STACK_KEY_INDEX = 18;

/** Members of the stacks currently on screen, keyed by stack key. */
export type VideoStackMap = Record<string, VideoType[]>;

/** One slot in the results: a single video, or a stack the user can flip through. */
export interface VideoSlot {
  /** Stable key for the rendered slot. */
  key: string;
  /** The videos in this slot — one entry unless it is a stack. */
  videos: VideoType[];
  /** Index of the member the feed itself returned, which the slot opens on. */
  initialIndex: number;
}

/**
 * Reads a video's stack key.
 *
 * @param video - Video tuple.
 * @returns The stack key, or `null` for a video that stands alone.
 */
export function stackKeyOf(video: VideoType): string | null {
  const key = video[STACK_KEY_INDEX];
  return typeof key === "string" && key.length > 0 ? key : null;
}

/**
 * Collects the distinct stack keys of a loaded feed, for the request that
 * resolves them to their members.
 *
 * @param videos - Videos loaded so far.
 * @returns Distinct stack keys, in first-seen order.
 */
export function collectStackKeys(videos: VideoType[]): string[] {
  const keys: string[] = [];
  const seen = new Set<string>();
  for (const video of videos) {
    const key = stackKeyOf(video);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    keys.push(key);
  }
  return keys;
}

/**
 * Groups a page of videos into the slots to render.
 *
 * A video whose stack has not resolved yet — the request is still in flight,
 * or the stack lost a member — renders as itself, so the grid never waits on
 * this to show results.
 *
 * @param videos - Videos in feed order.
 * @param stacks - Members per stack key, from `/api/videos/stacks`.
 * @param enabled - `false` renders every video in its own slot, which is what
 *   the "stacked playlists" toggle turns off.
 * @returns One slot per rendered card or row, in feed order.
 */
export function buildVideoSlots(
  videos: VideoType[],
  stacks: VideoStackMap | null | undefined,
  enabled = true,
): VideoSlot[] {
  const slots: VideoSlot[] = [];
  const placed = new Set<string>();

  videos.forEach((video, index) => {
    const key = enabled ? stackKeyOf(video) : null;
    const members = key ? stacks?.[key] : undefined;

    if (!key || !members || members.length < 2) {
      slots.push({ key: `${video[0]}-${index}`, videos: [video], initialIndex: 0 });
      return;
    }

    // Later members of a stack already on screen fold into the slot that is
    // holding their place rather than opening a second one.
    if (placed.has(key)) return;
    placed.add(key);

    const opensAt = Math.max(
      0,
      members.findIndex((member) => member[0] === video[0]),
    );
    slots.push({ key: `stack-${key}-${index}`, videos: members, initialIndex: opensAt });
  });

  return slots;
}
