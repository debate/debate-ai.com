/**
 * @fileoverview Turning a loaded page of videos into the slots the results
 * actually render — one per stacked playlist, one per standalone video.
 *
 * A stacked playlist is a small group of videos the library knows belong
 * together: a round and the round-analysis video made from it, a debate split
 * across two uploads, the parts of a lecture series. The server marks each row
 * with its stack key (`@debate-ai/videos/src/data/video-stacks.ts` says how a
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

import type { VideoType } from "../../../types/videos";
import { findSameRoundPairs, roundPartOf } from "../../../data/same-round-matcher";

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

/** Key prefix of a stack grouped on the page rather than by the server. */
export const PAGE_STACK_PREFIX = "parts-";

/**
 * Groups the "Part 1" / "Part 2" (or per-speech) uploads of one round that the
 * page holds but the server never stacked — the live table's stack keys are
 * only rewritten by a recompute, so a round split into parts that was added or
 * edited since shows as loose cards until then. Only videos with no stack key
 * take part, and only uploads whose titles say which piece of the round they
 * are (`roundPartOf`), so a full round and its commentary are still left to
 * the server's rule. Members play in round order: Part 1 first.
 *
 * @param videos - Videos in feed order.
 * @returns Members per video id, for every video in a page-made group.
 */
export function groupRoundPartsOnPage(videos: VideoType[]): Map<string, VideoType[]> {
  const candidates = videos.filter((video) => !stackKeyOf(video) && roundPartOf(video[1]).order > 0);
  const groups = new Map<string, VideoType[]>();
  if (candidates.length < 2) return groups;

  const byId = new Map<string, VideoType>();
  for (const video of candidates) if (!byId.has(video[0])) byId.set(video[0], video);
  const pairs = findSameRoundPairs(
    [...byId.values()].map((video) => {
      const published = Date.parse(String(video[2] ?? ""));
      const style = video[6];
      return {
        videoId: video[0],
        title: video[1],
        style: typeof style === "number" ? style : null,
        tournament: video[7] ?? null,
        roundLevel: video[8] ?? null,
        affTeam: video[9] ?? null,
        negTeam: video[10] ?? null,
        seasonYear: typeof video[17] === "number" ? video[17] : null,
        publishedMs: Number.isFinite(published) ? published : 0,
      };
    }),
  );
  if (pairs.length === 0) return groups;

  // Union-find over the pairs, so Part 1 ~ Part 2 ~ Part 3 is one group.
  const parent = new Map<string, string>();
  const find = (id: string): string => {
    let root = id;
    while (parent.get(root) && parent.get(root) !== root) root = parent.get(root)!;
    parent.set(id, root);
    return root;
  };
  for (const [a, b] of pairs) {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(rb, ra);
  }

  const members = new Map<string, VideoType[]>();
  for (const id of parent.keys()) {
    const root = find(id);
    const list = members.get(root) ?? [];
    list.push(byId.get(id)!);
    members.set(root, list);
  }
  for (const list of members.values()) {
    if (list.length < 2) continue;
    const ordered = [...list].sort((a, b) => {
      const byPart = roundPartOf(a[1]).order - roundPartOf(b[1]).order;
      return byPart !== 0 ? byPart : String(a[2] ?? "").localeCompare(String(b[2] ?? ""));
    });
    for (const video of ordered) groups.set(video[0], ordered);
  }
  return groups;
}

/**
 * Groups a page of videos into the slots to render.
 *
 * A video whose stack has not resolved yet — the request is still in flight,
 * or the stack lost a member — renders as itself, so the grid never waits on
 * this to show results. Parts of one round with no stack key are grouped on
 * the page instead (see {@link groupRoundPartsOnPage}) and open on Part 1.
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
  const pageGroups = enabled ? groupRoundPartsOnPage(videos) : new Map<string, VideoType[]>();

  videos.forEach((video, index) => {
    const key = enabled ? stackKeyOf(video) : null;
    const members = key ? stacks?.[key] : undefined;

    if (!key) {
      const parts = pageGroups.get(video[0]);
      if (parts) {
        const partsKey = `${PAGE_STACK_PREFIX}${parts[0][0]}`;
        if (placed.has(partsKey)) return;
        placed.add(partsKey);
        slots.push({ key: `stack-${partsKey}-${index}`, videos: parts, initialIndex: 0 });
        return;
      }
    }

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
