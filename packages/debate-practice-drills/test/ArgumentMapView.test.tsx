// @vitest-environment jsdom
/**
 * @fileoverview Render tests for the Argument Tree panel's map views: every
 * d3 mode draws one clickable mark per claim, and the Kialo-style focus
 * view splits a claim's responses into Pros and Cons and walks into them.
 */

import { afterEach, describe, expect, it } from "vitest";

import type { ArgumentTreeNode } from "@debate/round/src/flow/argument-tree";
import { buildArgumentMap, ARGUMENT_MAP_VIEW_MODES } from "../src/flow/argument-map";
import ArgumentMapChart from "../src/panels/argument-map/ArgumentMapChart";
import { ArgumentMapView } from "../src/panels/argument-map/ArgumentMapView";
import { click, mount, type Mounted } from "./helpers/mount";

const TREE: ArgumentTreeNode[] = [
  {
    id: "row-0",
    rowIndex: 0,
    isHeading: false,
    content: "Plan boosts GDP",
    originSpeech: "1AC",
    lastSpeech: "1NC",
    sideKey: "A",
    isUnanswered: true,
    entries: [
      { speech: "1AC", content: "Plan boosts GDP" },
      { speech: "1NC", content: "No link" },
    ],
    children: [],
  },
  {
    id: "row-1",
    rowIndex: 1,
    isHeading: false,
    content: "Politics DA",
    originSpeech: "1NC",
    lastSpeech: "1NC",
    sideKey: "N",
    isUnanswered: true,
    entries: [{ speech: "1NC", content: "Politics DA" }],
    children: [],
  },
];

let mounted: Mounted | null = null;

afterEach(async () => {
  await mounted?.unmount();
  mounted = null;
});

describe("ArgumentMapChart", () => {
  const root = buildArgumentMap(TREE, "Round r1");

  for (const { value } of ARGUMENT_MAP_VIEW_MODES) {
    it(`draws every claim in ${value} mode`, async () => {
      const focused: string[] = [];
      mounted = await mount(
        <ArgumentMapChart root={root} mode={value} focusId="root" onFocus={(id) => focused.push(id)} />,
      );
      const marks = mounted.container.querySelectorAll("svg [role=button]");
      expect(marks.length).toBe(4);
      const gdp = Array.from(marks).find((mark) => mark.getAttribute("aria-label") === "Plan boosts GDP");
      await click(gdp as HTMLElement);
      expect(focused).toEqual(["row-0"]);
    });
  }
});

describe("ArgumentMapView focus view", () => {
  it("splits responses into Pros and Cons and walks into a claim", async () => {
    mounted = await mount(<ArgumentMapView tree={TREE} rootLabel="Round r1" mode="tree" />);
    const text = () => mounted!.container.textContent ?? "";
    expect(text()).toContain("Pros");
    expect(text()).toContain("Cons");

    const card = Array.from(mounted.container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Plan boosts GDP"),
    );
    await click(card as HTMLElement);
    expect(mounted.container.querySelector("[aria-label='Go up to the parent claim']")).not.toBeNull();
    expect(text()).toContain("No link");
  });
});
