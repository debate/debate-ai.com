/**
 * @fileoverview Stacked playlists — which videos in the library are the same
 * debate seen from two angles, and therefore share one slot in the grid.
 *
 * A "stack" is a small group of videos that belong together: a round and the
 * round-analysis video made from it, a round split into a decision and a
 * rebuttals cut, the parts of a lecture series. The grid renders one card per
 * stack with `<` / `>` arrows instead of one card per video, so the analysis
 * no longer sits fifty rows away from the debate it is about.
 *
 * **Where the links come from.** Nothing hand-maintained: the YouTube
 * description of one video links to the other ("Full Debate:
 * https://www.youtube.com/watch?v=…"), which the channels already write, so an
 * editor links two videos by editing a description rather than by editing this
 * repo. Every link is read as undirected — a one-sided "Full Round" link pairs
 * the two just as a mutual pair does — and any link to an id the library does
 * not hold (a channel trailer, an unlisted upload) is dropped.
 *
 * The result is stored on the row (`stackKey`, `stackPosition`), so both
 * backends carry it: the SQL projection seeds the two columns, and the JSON
 * fallback recomputes them in `buildVideoRows`.
 * @module videos/video-stacks
 */

import type { VideoRow } from "./video-rows";

/**
 * YouTube ids found in a description. `watch?v=`, `youtu.be/` and `/embed/`
 * are the three forms the library's descriptions actually use; the trailing
 * lookahead stops a 12-character id from being truncated into a valid-looking
 * 11-character one.
 */
const YOUTUBE_LINK_PATTERN =
  /(?:youtube\.com\/watch\?(?:[^\s"'<>]*&)?v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{11})(?![A-Za-z0-9_-])/g;

/**
 * Links read from one description, at most.
 *
 * A description that lists a channel's whole back catalogue is a playlist
 * dump, not a statement that those videos are one debate; joining on it would
 * chain unrelated stacks together through a single verbose uploader.
 */
export const MAX_LINKS_PER_DESCRIPTION = 8;

/**
 * Members one stack may hold. Past this the group has stopped being "the same
 * debate twice" and is a channel index, so it is dropped rather than shown as
 * a card the user has to click through thirty times.
 */
export const MAX_STACK_SIZE = 12;

/** One stack: its key, and its members in display order. */
export interface VideoStack {
  /** The stack's id — the first member's video id. Also every member's `stackKey`. */
  key: string;
  /** Member video ids, primary first. */
  memberIds: string[];
}

/**
 * Extracts the YouTube ids a description links to, in first-seen order.
 *
 * @param description - Raw video description.
 * @returns De-duplicated video ids; empty when the description links to none.
 */
export function extractLinkedVideoIds(description: string | null | undefined): string[] {
  if (!description) return [];
  const ids: string[] = [];
  const seen = new Set<string>();
  // `matchAll` over a fresh regex each call — the `g` flag makes the literal
  // above stateful, and a shared `lastIndex` would skip links at random.
  for (const match of description.matchAll(new RegExp(YOUTUBE_LINK_PATTERN))) {
    const id = match[1];
    if (seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

/** Disjoint-set find with path compression. */
function find(parents: Map<string, string>, id: string): string {
  let root = parents.get(id) ?? id;
  while (root !== (parents.get(root) ?? root)) root = parents.get(root) ?? root;
  let cursor = id;
  while (cursor !== root) {
    const next = parents.get(cursor) ?? cursor;
    parents.set(cursor, root);
    cursor = next;
  }
  return root;
}

/**
 * Disjoint-set union. Both ids are registered as their own parent first, so a
 * video that is only ever a link *target* — the round every analysis points at
 * — is still a known node when the groups are collected.
 */
function union(parents: Map<string, string>, a: string, b: string): void {
  if (!parents.has(a)) parents.set(a, a);
  if (!parents.has(b)) parents.set(b, b);
  const rootA = find(parents, a);
  const rootB = find(parents, b);
  if (rootA !== rootB) parents.set(rootA, rootB);
}

/**
 * Order within a stack: the full round first, then by publish date, then by
 * id.
 *
 * The round leads because it is what the analysis is about — flipping to the
 * commentary is the second step, never the first. An unparseable date sorts
 * last rather than to 1970, which would put a legacy row ahead of the debate
 * it comments on.
 */
function compareMembers(a: VideoRow, b: VideoRow): number {
  const rank = (row: VideoRow) => (row.source === "round" ? 0 : 1);
  if (rank(a) !== rank(b)) return rank(a) - rank(b);
  const when = (row: VideoRow) => (row.publishedMs > 0 ? row.publishedMs : Number.MAX_SAFE_INTEGER);
  if (when(a) !== when(b)) return when(a) - when(b);
  return a.videoId.localeCompare(b.videoId);
}

/**
 * Groups rows into stacks by the links their descriptions carry.
 *
 * Single-video groups are not stacks and are left out, as are groups past
 * {@link MAX_STACK_SIZE}.
 *
 * @param rows - Every row in the library.
 * @returns One entry per stack, keyed by its primary member's id.
 */
export function buildVideoStacks(rows: VideoRow[]): VideoStack[] {
  const byId = new Map<string, VideoRow>();
  for (const row of rows) byId.set(row.videoId, row);

  const parents = new Map<string, string>();
  for (const row of rows) {
    const targets = extractLinkedVideoIds(row.description).filter(
      (id) => id !== row.videoId && byId.has(id),
    );
    if (targets.length > MAX_LINKS_PER_DESCRIPTION) continue;
    for (const target of targets) union(parents, row.videoId, target);
  }

  const groups = new Map<string, VideoRow[]>();
  for (const row of rows) {
    if (!parents.has(row.videoId)) continue;
    const root = find(parents, row.videoId);
    const group = groups.get(root);
    if (group) group.push(row);
    else groups.set(root, [row]);
  }

  const stacks: VideoStack[] = [];
  for (const group of groups.values()) {
    if (group.length < 2 || group.length > MAX_STACK_SIZE) continue;
    const ordered = [...group].sort(compareMembers);
    stacks.push({ key: ordered[0].videoId, memberIds: ordered.map((row) => row.videoId) });
  }
  // Deterministic output order, so a re-seed produces byte-identical SQL.
  stacks.sort((a, b) => a.key.localeCompare(b.key));
  return stacks;
}

/**
 * Stamps every row with the stack it belongs to, clearing rows that belong to
 * none.
 *
 * @param rows - Rows to annotate, in place.
 * @returns The stacks that were applied.
 */
export function assignVideoStacks(rows: VideoRow[]): VideoStack[] {
  const stacks = buildVideoStacks(rows);
  const placement = new Map<string, { key: string; position: number }>();
  for (const stack of stacks) {
    stack.memberIds.forEach((videoId, position) => {
      placement.set(videoId, { key: stack.key, position });
    });
  }

  for (const row of rows) {
    const spot = placement.get(row.videoId);
    row.stackKey = spot ? spot.key : null;
    row.stackPosition = spot ? spot.position : 0;
  }

  return stacks;
}
