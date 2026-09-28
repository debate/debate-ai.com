/**
 * @fileoverview The grouping rule behind the list layout's collapsible rows.
 *
 * The hierarchy is the point: season → tournament for an archive of rounds,
 * season → channel → category for lectures, newest season first. Inside a
 * tournament the rounds read down from Finals with no round-level groups of
 * their own. Videos missing the field a level groups by have to land
 * somewhere visible rather than vanish: a round with no tournament is a plain
 * row slotted among its season's tournaments by date, one with no round level
 * sits after the tournament's bracket, and an undated one sits in the
 * `Legacy` season.
 */

import { describe, it, expect } from "vitest";
import type { VideoType } from "../src/types/videos";
import { buildVideoSlots } from "../src/components/video-grid/video-stacks";
import {
  buildVideoTree,
  countVideoTreeLeaves,
  roundLevelLabel,
  roundLevelOrder,
  sortVideoTreeLeaves,
  videoGroupPath,
  videoTreeDepth,
  type VideoTreeGroup,
  type VideoTreeNode,
} from "../src/components/video-grid/video-tree";

/** Builds a round tuple; only the fields the tree groups by are interesting. */
function round(
  id: string,
  {
    title = id,
    date = "2025-02-14",
    views = 100,
    tournament = "Harvard 2025",
    level = "Finals",
    season = 2025,
    channel = "Debate Channel",
  }: Partial<{
    title: string;
    date: string;
    views: number;
    tournament: string | null;
    level: string | null;
    season: number;
    channel: string;
  }> = {},
): VideoType {
  return [
    id, title, date, channel, views, "", 1, tournament, level,
    "Aff Team", "Neg Team", true, "2-1", null, null, false, null, season,
  ];
}

/** Builds a lecture tuple — no tournament, no teams. */
function lecture(
  id: string,
  {
    title = id,
    channel = "Lecture Channel",
    category = "Theory",
    season = 2025,
    date = "2025-03-01",
    views = 50,
  }: Partial<{
    title: string;
    channel: string;
    category: string;
    season: number;
    date: string;
    views: number;
  }> = {},
): VideoType {
  return [
    id, title, date, channel, views, "", category, null, null,
    null, null, null, null, null, null, false, null, season,
  ];
}

/** Labels of a level of the tree, in the order it renders. */
function labels(nodes: VideoTreeNode[]): string[] {
  return nodes.map((node) => (node.type === "group" ? node.label : node.slot.videos[0][0]));
}

/** The group at `path`, or a failed expectation naming what was there. */
function groupAt(nodes: VideoTreeNode[], ...path: string[]): VideoTreeGroup {
  let level = nodes;
  let group: VideoTreeGroup | undefined;
  for (const label of path) {
    group = level.find(
      (node): node is VideoTreeGroup => node.type === "group" && node.label === label,
    );
    expect(group, `no "${label}" group among ${labels(level).join(", ")}`).toBeDefined();
    level = (group as VideoTreeGroup).children;
  }
  return group as VideoTreeGroup;
}

function treeOf(videos: VideoType[], mode: "round" | "lecture" = "round"): VideoTreeNode[] {
  return buildVideoTree(buildVideoSlots(videos, null), mode);
}

describe("the path a video takes through the tree", () => {
  it("files a round under its season and tournament, with no round-level group", () => {
    expect(videoGroupPath(round("a"), "round").map((step) => step.label)).toEqual([
      "24-25",
      "Harvard",
    ]);
  });

  it("files a lecture under its season, channel and category", () => {
    expect(videoGroupPath(lecture("a"), "lecture").map((step) => step.label)).toEqual([
      "24-25",
      "Lecture Channel",
      "Theory",
    ]);
  });

  it("normalizes the round level, so Octas and Octofinals read the same", () => {
    expect(roundLevelLabel(round("a", { level: "Octas" }))).toBe("Octofinals");
    expect(roundLevelLabel(round("b", { level: "octofinals" }))).toBe("Octofinals");
    expect(roundLevelOrder(round("a", { level: "Octas" }))).toBe(
      roundLevelOrder(round("b", { level: "octofinals" })),
    );
  });
});

describe("the order of the tree", () => {
  it("puts the newest season first", () => {
    const tree = treeOf([
      round("a", { season: 2023, date: "2023-02-01" }),
      round("b", { season: 2025 }),
      round("c", { season: 2024, date: "2024-02-01" }),
    ]);
    expect(labels(tree)).toEqual(["24-25", "23-24", "22-23"]);
  });

  it("reads the bracket down from Finals to the prelims", () => {
    const tree = treeOf([
      round("a", { level: "Round 3" }),
      round("b", { level: "Semifinals" }),
      round("c", { level: "Finals" }),
      round("d", { level: "Quarterfinals" }),
      round("e", { level: "Round 1" }),
    ]);
    // Videos directly under the tournament, Finals on top.
    expect(labels(groupAt(tree, "24-25", "Harvard").children)).toEqual(["c", "b", "d", "a", "e"]);
  });

  it("sorts tournaments in the order they happened", () => {
    const tree = treeOf([
      round("a", { tournament: "Shirley 2025", date: "2025-03-01" }),
      round("b", { tournament: "Greenhill 2025", date: "2024-09-20" }),
      round("c", { tournament: "Harvard 2025", date: "2025-02-14" }),
      round("d", { tournament: "Greenhill 2025", date: "2024-09-22" }),
    ]);
    expect(labels(groupAt(tree, "24-25").children)).toEqual(["Greenhill", "Harvard", "Shirley"]);
    expect(groupAt(tree, "24-25", "Greenhill").earliestDate).toBe("2024-09-20");
  });

  it("sends the Legacy season to the end of the seasons", () => {
    const tree = treeOf([
      round("b", { tournament: "Harvard 2025" }),
      round("c", { season: 0, date: "" }),
    ]);
    expect(labels(tree)).toEqual(["24-25", "Legacy"]);
  });

  it("slots a round with no tournament between the tournaments by date", () => {
    const tree = treeOf([
      round("late", { tournament: null, date: "2025-03-10" }),
      round("shirley", { tournament: "Shirley 2025", date: "2025-03-01" }),
      round("mid", { tournament: null, date: "2025-02-20" }),
      round("harvard", { tournament: "Harvard 2025", date: "2025-02-14" }),
      round("sameDay", { tournament: null, date: "2025-02-14" }),
    ]);
    expect(labels(groupAt(tree, "24-25").children)).toEqual([
      "Harvard",
      "sameDay",
      "mid",
      "Shirley",
      "late",
    ]);
    expect(countVideoTreeLeaves(tree)).toBe(5);
  });

  it("lists a round with a tournament but no round level after that tournament's bracket", () => {
    const tree = treeOf([
      round("a", { level: null }),
      round("b", { level: "Semis" }),
      round("c", { level: "Mystery" }),
    ]);
    expect(labels(groupAt(tree, "24-25", "Harvard").children)).toEqual(["b", "c", "a"]);
  });
});

describe("what a group row reports", () => {
  it("counts the videos below it and sums their views", () => {
    const tree = treeOf([
      round("a", { views: 100 }),
      round("b", { views: 250, level: "Semifinals" }),
    ]);
    const season = groupAt(tree, "24-25");
    expect(season.videoCount).toBe(2);
    expect(season.viewCount).toBe(350);
    expect(groupAt(tree, "24-25", "Harvard").videoCount).toBe(2);
  });

  it("carries the newest date below it", () => {
    const tree = treeOf([
      round("a", { date: "2025-02-14" }),
      round("b", { date: "2025-03-20", level: "Semifinals" }),
    ]);
    expect(groupAt(tree, "24-25").latestDate).toBe("2025-03-20");
  });

  it("counts a stacked playlist's members, and keeps it to one row", () => {
    const first = round("a");
    const second = round("b");
    const slots = buildVideoSlots([first], { "stack-1": [first, second] });
    // The feed returned one member; the stack resolves to two.
    const stacked = buildVideoTree(
      buildVideoSlots([{ ...first, 18: "stack-1" } as unknown as VideoType], {
        "stack-1": [first, second],
      }),
      "round",
    );
    expect(slots).toHaveLength(1);
    expect(countVideoTreeLeaves(stacked)).toBe(1);
    expect(groupAt(stacked, "24-25").videoCount).toBe(2);
  });
});

describe("the tree's depth and its leaves", () => {
  it("counts the group levels plus the videos", () => {
    expect(videoTreeDepth(treeOf([round("a")]))).toBe(3);
    expect(videoTreeDepth([])).toBe(1);
  });

  it("sorts the videos inside their tournament, leaving the hierarchy alone", () => {
    const tree = treeOf([
      round("a", { title: "Zeta", views: 10 }),
      round("b", { title: "Alpha", views: 20 }),
      round("c", { title: "Mid", views: 30, tournament: "Greenhill 2025", date: "2024-10-01" }),
    ]);
    const sorted = sortVideoTreeLeaves(tree, (a, b) =>
      String(a.videos[0][1]).localeCompare(String(b.videos[0][1])),
    );
    // Tournaments stay in their own order …
    expect(labels(groupAt(sorted, "24-25").children)).toEqual(["Greenhill", "Harvard"]);
    // … while Harvard's two rounds swap into title order.
    const harvardFinals = groupAt(sorted, "24-25", "Harvard").children;
    expect(
      harvardFinals.map((node) => (node.type === "video" ? node.slot.videos[0][1] : node.label)),
    ).toEqual(["Alpha", "Zeta"]);
  });
});
