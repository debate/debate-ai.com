/**
 * @fileoverview Grouping the list layout's rows into the collapsible tree it
 * renders — the same shape as the code-file trees in the docs sites, where a
 * row is either a folder you open or a leaf you act on.
 *
 * The hierarchy is the one an archive of rounds is actually navigated by:
 * season → tournament, with the videos as the leaves. Round levels are not a
 * group of their own: inside a tournament the rounds are ordered Finals,
 * Semifinals, … then prelims, and the level rides on each row's badge.
 * Lectures carry none of those fields, so they group season → channel →
 * category instead.
 *
 * Within a season, tournaments are listed in the order they happened, and a
 * round missing its tournament is a plain row slotted in between them by its
 * date — after the tournament that came before it, not at the end of the
 * season.
 *
 * Grouping runs on the *slot* (see `video-stacks.ts`), not on the video: a
 * stacked playlist sits in one leaf under the round its first member belongs
 * to, and flipping the row to another member does not move it in the tree.
 *
 * Kept free of React so the grouping rule can be tested as a list-in,
 * tree-out function, the way `video-stacks.ts` is.
 * @module components/video-grid/video-tree
 */

import { formatSeasonLabel } from "debate-data-sync/src/videos/video-rows";
import {
  formatRoundLevel,
  getRoundSortKey,
  parseRoundLevel,
} from "debate-data-sync/src/youtube/parsers/round-level";
import { DEBATE_STYLE_LABELS, type VideoType } from "../../types/videos";
import type { VideoSlot } from "./video-stacks";

/** Which hierarchy a set of videos is grouped by. */
export type VideoTreeMode = "round" | "lecture";

/** What a group row stands for — drives its icon and its wording. */
export type VideoGroupKind =
  | "season"
  | "tournament"
  | "round"
  | "channel"
  | "category";

/** Label used for videos missing the field their level groups by. */
export const UNGROUPED_LABEL = "Unsorted";

/** A leaf: one rendered video row, standing for one slot. */
export interface VideoTreeLeaf {
  type: "video";
  /** The slot's own key, so a re-group keeps React's row identity. */
  key: string;
  slot: VideoSlot;
}

/** A branch: a season, a tournament, a round level, a channel, a category. */
export interface VideoTreeGroup {
  type: "group";
  /** Path key — the labels of this group and its ancestors. */
  key: string;
  kind: VideoGroupKind;
  label: string;
  children: VideoTreeNode[];
  /** Videos below this group at any depth, stack members included. */
  videoCount: number;
  /** Summed views of those videos. */
  viewCount: number;
  /** Newest publication date below this group, for the Date column. */
  latestDate: string | null;
  /** Oldest publication date below this group — when a tournament started,
   *  which is what places it among its season's other tournaments. */
  earliestDate: string | null;
  /** Sort position among its siblings; see {@link compareTreeNodes}. */
  sortValue: number | string;
  /** Placeholder groups (`Unsorted`, `Legacy`) sort after their siblings. */
  trailing: boolean;
}

export type VideoTreeNode = VideoTreeGroup | VideoTreeLeaf;

/** One level of a video's path through the tree. */
interface GroupStep {
  kind: VideoGroupKind;
  label: string;
  sortValue: number | string;
  trailing?: boolean;
}

/**
 * Strips the year, round and boilerplate off a tournament name, leaving the
 * tournament itself — the part that is the same across a season's uploads and
 * so can head a group of them.
 *
 * @param tournament - Raw tournament field from the video tuple.
 * @returns The shortened name, or `undefined` when nothing is left of it.
 */
export function cleanTournamentName(tournament: string | null | undefined): string | undefined {
  if (!tournament) return undefined;

  const cleaned = tournament
    .replace(/\bTournament of Champions\b/gi, "TOC")
    .replace(/\bNational Debate Tournament\b/gi, "NDT")
    .replace(/\b(?:19|20)\d{2}\b/g, "")
    .replace(/\b(TOC|Nats)\d{2}\b/gi, "$1")
    .replace(/[\s,\-–]+(?:\d{2}|\d{2}'?)\s*$/g, "")
    .replace(/\bR\d{1,3}\b/gi, "")
    .replace(/\bround\s+robin\b/gi, "")
    .replace(/\b(?:round|rd|rounds)\s*(?:\d{1,3}|double|doubles|triple|triples|octos?|octas?|octafinals?|quarters?|quarterfinals?|semis?|semifinals?|finals?|runoffs?|prelims?|eliminations?)\b/gi, "")
    .replace(/\b(?:round|rd|rounds)\b/gi, "")
    .replace(/\b(?:finals?|semis?|semifinals?|quarters?|quarterfinals?|octos?|octas?|octafinals?|runoffs?|doubles?|triples?|prelims?|eliminations?)\b/gi, "")
    .replace(/\b(?:debate\s+)?(?:tournament|championships?|nationals?|nats|invitational|open)\b/gi, "")
    .replace(/\s+debate\b/gi, "")
    .replace(/\s+/g, " ")
    .replace(/^[\s,\-–|]+|[\s,\-–|]+$/g, "")
    .trim();

  return cleaned || undefined;
}

/**
 * Reads a video's category — the debate style for a round, the free-text
 * lecture category for a lecture.
 *
 * @param video - Video tuple.
 * @returns The display label, or an empty string when the field is unset.
 */
export function videoCategoryLabel(video: VideoType): string {
  const style = video[6];
  if (typeof style === "number") return DEBATE_STYLE_LABELS[style as 1 | 2 | 3 | 4] ?? "";
  return typeof style === "string" ? style.trim() : "";
}

/**
 * The path one video takes through the tree, outermost group first — the same
 * idea as a file tree's data path, with a sort position per level.
 *
 * @param video - Video tuple.
 * @param mode - Which hierarchy to group by.
 * @returns One step per group level.
 */
export function videoGroupPath(video: VideoType, mode: VideoTreeMode): GroupStep[] {
  const seasonYear = typeof video[17] === "number" && video[17] > 0 ? video[17] : 0;
  const steps: GroupStep[] = [
    {
      kind: "season",
      label: seasonYear ? formatSeasonLabel(seasonYear) : "Legacy",
      // Negated: the newest season heads the list.
      sortValue: -seasonYear,
      trailing: seasonYear === 0,
    },
  ];

  if (mode === "lecture") {
    const channel = video[3]?.trim();
    const category = videoCategoryLabel(video);
    steps.push({
      kind: "channel",
      label: channel || UNGROUPED_LABEL,
      sortValue: channel?.toLowerCase() ?? "",
      trailing: !channel,
    });
    steps.push({
      kind: "category",
      label: category || UNGROUPED_LABEL,
      sortValue: category.toLowerCase(),
      trailing: !category,
    });
    return steps;
  }

  // A round missing its tournament stops at the season, where it is placed
  // among the tournaments by date rather than buried under an `Unsorted`
  // placeholder.
  const tournament = cleanTournamentName(video[7]);
  if (!tournament) return steps;
  steps.push({
    kind: "tournament",
    label: tournament,
    sortValue: tournament.toLowerCase(),
  });

  return steps;
}

/**
 * Where a round sits within its tournament: Finals first, then down the
 * bracket to the prelims, with an unrecognized or missing level last.
 *
 * @param video - Video tuple.
 * @returns A number to sort ascending by.
 */
export function roundLevelOrder(video: VideoType): number {
  const rawLevel = video[8]?.trim();
  if (!rawLevel) return Number.MAX_SAFE_INTEGER;
  const level = parseRoundLevel(rawLevel).level;
  if (level === "UNKNOWN") return Number.MAX_SAFE_INTEGER - 1;
  // Negated so the bracket reads down from Finals to the prelims, which is
  // the order the rounds are watched in rather than debated in.
  return -getRoundSortKey(level);
}

/** The round level a row's badge shows, normalized when it parses. */
export function roundLevelLabel(video: VideoType): string {
  const rawLevel = video[8]?.trim() ?? "";
  if (!rawLevel) return "";
  const level = parseRoundLevel(rawLevel).level;
  return level === "UNKNOWN" ? rawLevel : formatRoundLevel(level);
}

/** Total views across a slot — a stack counts all of its members. */
function slotViews(slot: VideoSlot): number {
  return slot.videos.reduce((total, video) => total + (video[4] ?? 0), 0);
}

/** Milliseconds since the epoch, or `null` for a missing or unparseable date. */
function dateTime(value: string | null | undefined): number | null {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

/** The earlier of two dates, either of which may be missing or unparseable. */
function earlierDate(current: string | null, candidate: string | null | undefined): string | null {
  const candidateTime = dateTime(candidate);
  if (candidateTime === null) return current;
  const currentTime = dateTime(current);
  return currentTime === null || candidateTime < currentTime ? (candidate as string) : current;
}

/** The later of two dates, either of which may be missing or unparseable. */
function laterDate(current: string | null, candidate: string | null | undefined): string | null {
  if (!candidate) return current;
  if (!current) return candidate;
  return new Date(candidate).getTime() > new Date(current).getTime() ? candidate : current;
}

/**
 * Orders siblings: groups above leaves, placeholder groups last, and
 * otherwise by the level's own sort position. Leaves compare equal, so a
 * stable sort leaves them in the order the feed returned them.
 *
 * @param a - First sibling.
 * @param b - Second sibling.
 * @returns Negative, zero or positive, as `Array.prototype.sort` expects.
 */
export function compareTreeNodes(a: VideoTreeNode, b: VideoTreeNode): number {
  if (a.type !== b.type) return a.type === "group" ? -1 : 1;
  if (a.type !== "group" || b.type !== "group") return 0;
  if (a.trailing !== b.trailing) return a.trailing ? 1 : -1;
  if (typeof a.sortValue === "number" && typeof b.sortValue === "number") {
    return a.sortValue - b.sortValue;
  }
  return String(a.sortValue).localeCompare(String(b.sortValue));
}

/**
 * Groups the rendered slots into the tree the list layout draws.
 *
 * @param slots - Slots in feed order, from `buildVideoSlots`.
 * @param mode - Which hierarchy to group by.
 * @returns The roots of the tree — one per season.
 */
export function buildVideoTree(slots: VideoSlot[], mode: VideoTreeMode): VideoTreeNode[] {
  const roots: VideoTreeNode[] = [];
  const groups = new Map<string, VideoTreeGroup>();

  for (const slot of slots) {
    // The member the feed itself returned decides where the slot sits, so
    // flipping a stack on screen never re-files the row.
    const video = slot.videos[slot.initialIndex] ?? slot.videos[0];
    if (!video) continue;

    const views = slotViews(slot);
    let siblings = roots;
    let key = "";

    for (const step of videoGroupPath(video, mode)) {
      key = key ? `${key} / ${step.kind}:${step.label}` : `${step.kind}:${step.label}`;
      let group = groups.get(key);
      if (!group) {
        group = {
          type: "group",
          key,
          kind: step.kind,
          label: step.label,
          children: [],
          videoCount: 0,
          viewCount: 0,
          latestDate: null,
          earliestDate: null,
          sortValue: step.sortValue,
          trailing: step.trailing ?? false,
        };
        groups.set(key, group);
        siblings.push(group);
      }
      group.videoCount += slot.videos.length;
      group.viewCount += views;
      group.latestDate = laterDate(group.latestDate, video[2]);
      group.earliestDate = earlierDate(group.earliestDate, video[2]);
      siblings = group.children;
    }

    siblings.push({ type: "video", key: slot.key, slot });
  }

  sortTree(roots, null);
  return roots;
}

/** The video a leaf is filed by — the member the feed returned. */
function leafVideo(leaf: VideoTreeLeaf): VideoType | undefined {
  return leaf.slot.videos[leaf.slot.initialIndex] ?? leaf.slot.videos[0];
}

/**
 * Orders a season's children chronologically: each tournament by the date it
 * started, each loose round by its own date, a tournament ahead of a round on
 * the same day. Undated nodes go last, in feed order.
 *
 * @param a - First sibling.
 * @param b - Second sibling.
 * @returns Negative, zero or positive, as `Array.prototype.sort` expects.
 */
export function compareChronologically(a: VideoTreeNode, b: VideoTreeNode): number {
  const when = (node: VideoTreeNode) =>
    dateTime(node.type === "group" ? node.earliestDate : leafVideo(node)?.[2]);
  const left = when(a);
  const right = when(b);
  if (left === null || right === null) {
    if (left !== right) return left === null ? 1 : -1;
  } else if (left !== right) {
    return left - right;
  }
  if (a.type !== b.type) return a.type === "group" ? -1 : 1;
  return a.type === "group" && b.type === "group" ? compareTreeNodes(a, b) : 0;
}

/**
 * Orders a tournament's rounds Finals first, down the bracket.
 *
 * @param a - First sibling.
 * @param b - Second sibling.
 * @returns Negative, zero or positive, as `Array.prototype.sort` expects.
 */
function compareRoundLevels(a: VideoTreeNode, b: VideoTreeNode): number {
  if (a.type !== "video" || b.type !== "video") return compareTreeNodes(a, b);
  const left = leafVideo(a);
  const right = leafVideo(b);
  return (left ? roundLevelOrder(left) : 0) - (right ? roundLevelOrder(right) : 0);
}

/** Sorts a level and every level below it, in place. */
function sortTree(nodes: VideoTreeNode[], parent: VideoTreeGroup | null): void {
  const hasTournaments = nodes.some((node) => node.type === "group" && node.kind === "tournament");
  const hasLooseRounds =
    parent?.kind === "season" && nodes.some((node) => node.type === "video");
  if (parent?.kind === "season" && (hasTournaments || hasLooseRounds)) {
    nodes.sort(compareChronologically);
  } else if (parent?.kind === "tournament") {
    nodes.sort(compareRoundLevels);
  } else {
    nodes.sort(compareTreeNodes);
  }
  for (const node of nodes) {
    if (node.type === "group") sortTree(node.children, node);
  }
}

/**
 * How many levels of rows the tree has, group levels plus the videos — the
 * number of collapse levels the header's control offers.
 *
 * @param nodes - Roots of the tree.
 * @returns At least 1, even for an empty tree.
 */
export function videoTreeDepth(nodes: VideoTreeNode[]): number {
  let deepest = 0;
  for (const node of nodes) {
    const depth = node.type === "group" ? 1 + videoTreeDepth(node.children) : 1;
    if (depth > deepest) deepest = depth;
  }
  return Math.max(1, deepest);
}

/**
 * Re-orders the leaves inside each group, for a column sort.
 *
 * The groups themselves keep the hierarchy's own order — a season is where it
 * is because of when it happened, not because of the column a row is sorted
 * by — so a sort re-orders the videos within their round, not the rounds.
 *
 * @param nodes - Roots of the tree.
 * @param compare - Comparator over the slots two leaves stand for.
 * @returns A new tree; the input is left alone.
 */
export function sortVideoTreeLeaves(
  nodes: VideoTreeNode[],
  compare: (a: VideoSlot, b: VideoSlot) => number,
): VideoTreeNode[] {
  const leaves = nodes.filter((node): node is VideoTreeLeaf => node.type === "video");
  const sortedLeaves = [...leaves].sort((a, b) => compare(a.slot, b.slot));
  let next = 0;

  return nodes.map((node) =>
    node.type === "group"
      ? { ...node, children: sortVideoTreeLeaves(node.children, compare) }
      : sortedLeaves[next++],
  );
}

/**
 * Counts the leaves in a tree, for the "no results" fallback row.
 *
 * @param nodes - Roots of the tree.
 * @returns Number of video rows the tree would render when fully open.
 */
export function countVideoTreeLeaves(nodes: VideoTreeNode[]): number {
  return nodes.reduce(
    (total, node) => total + (node.type === "group" ? countVideoTreeLeaves(node.children) : 1),
    0,
  );
}
