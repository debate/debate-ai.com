import { describe, expect, it } from "vitest";
import { buildCrossLinks, buildFlowToolsMenuItems, FLOW_TOOL_LINKS } from "../src/round/flow-tool-links";
import type { Box, Flow } from "../src/types/flow";

function makeBox(overrides: Partial<Box> = {}): Box {
  return { content: "", children: [], index: 0, level: 0, focus: false, ...overrides };
}

function makeFlow(overrides: Partial<Flow> = {}): Flow {
  return {
    content: "1AC",
    level: 0,
    columns: ["1AC", "1NC"],
    invert: false,
    focus: false,
    index: 0,
    lastFocus: [0],
    children: [makeBox()],
    id: 1700000000000,
    ...overrides,
  };
}

describe("FLOW_TOOL_LINKS", () => {
  it("is non-empty and every entry has a non-empty href, label, and description", () => {
    expect(FLOW_TOOL_LINKS.length).toBeGreaterThan(0);
    for (const link of FLOW_TOOL_LINKS) {
      expect(link.href.startsWith("/")).toBe(true);
      expect(link.label.trim().length).toBeGreaterThan(0);
      expect(link.description.trim().length).toBeGreaterThan(0);
    }
  });

  it("has no duplicate hrefs", () => {
    const hrefs = FLOW_TOOL_LINKS.map((link) => link.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});

describe("buildFlowToolsMenuItems", () => {
  it("returns one item per FLOW_TOOL_LINKS entry, all enabled, when a flow is selected", () => {
    const items = buildFlowToolsMenuItems(makeFlow());
    expect(items).toHaveLength(FLOW_TOOL_LINKS.length);
    expect(items.every((item) => item.disabled === false)).toBe(true);
    expect(items.map((item) => item.href)).toEqual(FLOW_TOOL_LINKS.map((link) => link.href));
  });

  it("disables every item when there is no current flow (null)", () => {
    const items = buildFlowToolsMenuItems(null);
    expect(items).toHaveLength(FLOW_TOOL_LINKS.length);
    expect(items.every((item) => item.disabled === true)).toBe(true);
  });

  it("disables every item when there is no current flow (undefined)", () => {
    const items = buildFlowToolsMenuItems(undefined);
    expect(items.every((item) => item.disabled === true)).toBe(true);
  });

  it("preserves each link's label and description alongside the disabled flag", () => {
    const items = buildFlowToolsMenuItems(makeFlow());
    for (const link of FLOW_TOOL_LINKS) {
      const item = items.find((i) => i.href === link.href);
      expect(item).toBeDefined();
      expect(item?.label).toBe(link.label);
      expect(item?.description).toBe(link.description);
    }
  });
});

describe("buildCrossLinks", () => {
  it("excludes the current page's own href", () => {
    const links = buildCrossLinks("/outline");
    expect(links.some((link) => link.href === "/outline")).toBe(false);
  });

  it("returns every other FLOW_TOOL_LINKS entry, preserving order", () => {
    const links = buildCrossLinks("/outline");
    const expected = FLOW_TOOL_LINKS.filter((link) => link.href !== "/outline");
    expect(links).toEqual(expected);
  });

  it("returns the full list unchanged when currentHref matches nothing", () => {
    const links = buildCrossLinks("/not-a-flow-tool");
    expect(links).toEqual(FLOW_TOOL_LINKS);
  });

  it("returns a distinct result for each of the four target pages", () => {
    for (const link of FLOW_TOOL_LINKS) {
      const links = buildCrossLinks(link.href);
      expect(links).toHaveLength(FLOW_TOOL_LINKS.length - 1);
      expect(links.every((l) => l.href !== link.href)).toBe(true);
    }
  });
});
