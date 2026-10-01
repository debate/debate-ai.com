/**
 * @fileoverview Tests for `flow/argument-map.ts` — turning a round's outline
 * tree into the Kialo-style pro/con claim hierarchy the Argument Tree
 * panel's map views draw.
 */

import { describe, expect, it } from "vitest";

import type { ArgumentTreeNode } from "debate-round/src/flow/argument-tree";
import {
  argumentMapPath,
  buildArgumentMap,
  countDescendants,
  parseArgumentTreeViewMode,
  resolveProSideKey,
} from "../src/flow/argument-map";

function row(rowIndex: number, entries: [string, string][]): ArgumentTreeNode {
  return {
    id: `row-${rowIndex}`,
    rowIndex,
    isHeading: false,
    content: entries[0][1],
    originSpeech: entries[0][0],
    lastSpeech: entries[entries.length - 1][0],
    sideKey: entries[0][0].replace(/^\d*/, "")[0] ?? null,
    isUnanswered: false,
    entries: entries.map(([speech, content]) => ({ speech, content })),
    children: [],
  };
}

function heading(rowIndex: number, content: string, children: ArgumentTreeNode[]): ArgumentTreeNode {
  return {
    id: `row-${rowIndex}`,
    rowIndex,
    isHeading: true,
    content,
    originSpeech: "1AC",
    lastSpeech: "1AC",
    sideKey: null,
    isUnanswered: false,
    entries: [{ speech: "1AC", content }],
    children,
  };
}

const TREE: ArgumentTreeNode[] = [
  heading(0, "Contention 1: Economy", [
    row(1, [
      ["1AC", "Plan boosts GDP"],
      ["1NC", "No link — GDP is flat"],
      ["2AC", "Extend the GDP card"],
    ]),
    row(2, [["1AC", "Jobs impact"]]),
  ]),
  heading(3, "Off: Politics DA", [row(4, [["1NC", "Plan costs capital"], ["2AC", "Non-unique"]])]),
];

describe("resolveProSideKey", () => {
  it("prefers the A/P side even when it is not the first one seen", () => {
    expect(resolveProSideKey([row(0, [["1NC", "x"]]), row(1, [["1AC", "y"]])])).toBe("A");
  });

  it("falls back to the first side seen", () => {
    expect(resolveProSideKey([row(0, [["G1", "x"]]), row(1, [["O1", "y"]])])).toBe("G");
  });
});

describe("buildArgumentMap", () => {
  const map = buildArgumentMap(TREE, "Round r1");

  it("roots the map at the round and nests headings, rows and responses", () => {
    expect(map.stance).toBe("root");
    expect(map.label).toBe("Round r1");
    expect(map.children.map((child) => child.label)).toEqual(["Contention 1: Economy", "Off: Politics DA"]);
    const gdp = map.children[0].children[0];
    expect(gdp.label).toBe("Plan boosts GDP");
    expect(gdp.children[0].label).toBe("No link — GDP is flat");
    expect(gdp.children[0].children[0].label).toBe("Extend the GDP card");
    expect(countDescendants(map)).toBe(8);
  });

  it("colors each claim pro or con relative to its parent", () => {
    const [economy, politics] = map.children;
    expect(economy.stance).toBe("pro");
    expect(politics.stance).toBe("con");
    const gdp = economy.children[0];
    expect(gdp.stance).toBe("pro");
    expect(gdp.children[0].stance).toBe("con"); // 1NC answers a 1AC claim
    expect(gdp.children[0].children[0].stance).toBe("con"); // 2AC answers the 1NC answer
    expect(politics.children[0].stance).toBe("pro"); // neg row supports the neg heading
    expect(politics.children[0].children[0].stance).toBe("con");
  });

  it("puts loose rows straight under the root, stanced by side", () => {
    const loose = buildArgumentMap([row(0, [["1AC", "a"]]), row(1, [["1NC", "n"]])], "R");
    expect(loose.children.map((child) => child.stance)).toEqual(["pro", "con"]);
  });
});

describe("argumentMapPath", () => {
  const map = buildArgumentMap(TREE, "Round r1");

  it("walks from the root down to a claim", () => {
    expect(argumentMapPath(map, "row-1-r1").map((node) => node.id)).toEqual(["root", "row-0", "row-1", "row-1-r1"]);
  });

  it("falls back to the root for an unknown id", () => {
    expect(argumentMapPath(map, "missing").map((node) => node.id)).toEqual(["root"]);
  });
});

describe("parseArgumentTreeViewMode", () => {
  it("accepts known modes and defaults to the tiered tree", () => {
    expect(parseArgumentTreeViewMode("sunburst")).toBe("sunburst");
    expect(parseArgumentTreeViewMode("outline")).toBe("outline");
    expect(parseArgumentTreeViewMode("nope")).toBe("tree");
    expect(parseArgumentTreeViewMode(null)).toBe("tree");
  });
});
