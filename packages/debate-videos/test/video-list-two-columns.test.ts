/**
 * @fileoverview Pins how the list layout deals its rows into two tables on a
 * screen wide enough for both: alternating, balanced, and stable as more
 * pages load — and a feed that is all one season still fills both columns.
 */

import { describe, it, expect } from "vitest";
import {
  splitVideoTreeColumns,
  type VideoTreeGroup,
  type VideoTreeNode,
} from "../src/components/video-grid/video-tree";

const leaf = (key: string): VideoTreeNode => ({ type: "video", key, slot: { key } as never });

const group = (key: string, children: VideoTreeNode[]): VideoTreeGroup => ({
  type: "group",
  key,
  kind: "season",
  label: key,
  children,
  videoCount: children.length,
  viewCount: 0,
  latestDate: null,
  earliestDate: null,
  sortValue: key,
  trailing: false,
});

const keys = (nodes: VideoTreeNode[]) => nodes.map((node) => node.key);

describe("splitVideoTreeColumns", () => {
  it("alternates a flat list left, right, left, right", () => {
    const [left, right] = splitVideoTreeColumns(["a", "b", "c", "d", "e"].map(leaf), 1);
    expect(keys(left)).toEqual(["a", "c", "e"]);
    expect(keys(right)).toEqual(["b", "d"]);
  });

  it("keeps rows already placed where they were when more load", () => {
    const first = splitVideoTreeColumns(["a", "b", "c", "d"].map(leaf), 1);
    const more = splitVideoTreeColumns(["a", "b", "c", "d", "e", "f"].map(leaf), 1);
    expect(keys(more[0]).slice(0, first[0].length)).toEqual(keys(first[0]));
    expect(keys(more[1]).slice(0, first[1].length)).toEqual(keys(first[1]));
  });

  it("balances groups by the rows they open to", () => {
    const big = group("big", ["1", "2", "3", "4"].map(leaf));
    const small1 = group("s1", [leaf("5")]);
    const small2 = group("s2", [leaf("6")]);
    const [left, right] = splitVideoTreeColumns([big, small1, small2], 2);
    expect(keys(left)).toEqual(["big"]);
    expect(keys(right)).toEqual(["s1", "s2"]);
  });

  it("splits a lone open season by its children, heading both columns", () => {
    const season = group("2025", ["a", "b", "c"].map(leaf));
    const [left, right] = splitVideoTreeColumns([season], 2);
    expect(keys(left)).toEqual(["2025"]);
    expect(keys(right)).toEqual(["2025"]);
    expect(keys((left[0] as VideoTreeGroup).children)).toEqual(["a", "c"]);
    expect(keys((right[0] as VideoTreeGroup).children)).toEqual(["b"]);
  });

  it("leaves a lone collapsed season whole", () => {
    const season = group("2025", ["a", "b"].map(leaf));
    const [left, right] = splitVideoTreeColumns([season], 1);
    expect(left).toEqual([season]);
    expect(right).toEqual([]);
  });
});
