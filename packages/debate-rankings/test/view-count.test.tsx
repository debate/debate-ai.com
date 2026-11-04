// @vitest-environment jsdom
/**
 * @fileoverview `ViewCount` — view totals step through distinct color tiers,
 * growing in size, gold at 30,000, and carry a lucide icon from gold up.
 */

import { describe, it, expect } from "vitest";
import { mount } from "./helpers/mount";

import {
  ViewCount,
  viewCountStyle,
  viewCountTier,
  VIEW_COUNT_GOLD,
  VIEW_COUNT_TIERS,
} from "../src/view-count";

describe("viewCountTier", () => {
  it("is gray for small or invalid totals", () => {
    expect(viewCountTier(0).name).toBe("gray");
    expect(viewCountTier(499).name).toBe("gray");
    expect(viewCountTier(Number.NaN).name).toBe("gray");
    expect(viewCountTier(-5).name).toBe("gray");
  });

  it("is gold at 30,000 and keeps climbing past it", () => {
    expect(viewCountTier(VIEW_COUNT_GOLD - 1).name).toBe("amber");
    expect(viewCountTier(VIEW_COUNT_GOLD).name).toBe("gold");
    expect(viewCountTier(75_000).name).toBe("orange");
    expect(viewCountTier(150_000).name).toBe("rose");
    expect(viewCountTier(5_000_000).name).toBe("violet");
  });

  it("has ascending edges, growing sizes and distinct colors", () => {
    const mins = VIEW_COUNT_TIERS.map((t) => t.min);
    const sizes = VIEW_COUNT_TIERS.map((t) => t.sizeEm);
    expect([...mins].sort((a, b) => a - b)).toEqual(mins);
    expect([...sizes].sort((a, b) => a - b)).toEqual(sizes);
    expect(new Set(VIEW_COUNT_TIERS.map((t) => t.color)).size).toBe(VIEW_COUNT_TIERS.length);
  });

  it("gives an icon to every tier from gold up and none below", () => {
    for (const t of VIEW_COUNT_TIERS) expect(Boolean(t.icon)).toBe(t.min >= VIEW_COUNT_GOLD);
  });
});

describe("viewCountStyle", () => {
  it("starts smaller than the surrounding text and ends larger", () => {
    expect(parseFloat(String(viewCountStyle(10).fontSize))).toBeLessThan(1);
    expect(parseFloat(String(viewCountStyle(VIEW_COUNT_GOLD).fontSize))).toBeGreaterThan(1);
  });
});

describe("ViewCount", () => {
  it("renders the abbreviated total with the full number in its title", async () => {
    const view = await mount(<ViewCount views={17_400} suffix=" views" />);
    const span = view.container.querySelector("span")!;
    expect(span.textContent).toBe("17k views");
    expect(span.title).toBe(`${(17_400).toLocaleString()} views`);
    expect(span.dataset.viewTier).toBe("yellow");
    expect(span.querySelector("svg")).toBeNull();
    await view.unmount();
  });

  it("swaps the caller's icon for the tier icon from gold up", async () => {
    const low = await mount(<ViewCount views={800} icon={<i data-testid="eye" />} />);
    expect(low.container.querySelector("[data-testid=eye]")).not.toBeNull();
    await low.unmount();

    const high = await mount(<ViewCount views={45_000} icon={<i data-testid="eye" />} />);
    expect(high.container.querySelector("[data-testid=eye]")).toBeNull();
    expect(high.container.querySelector("svg")).not.toBeNull();
    await high.unmount();
  });
});
