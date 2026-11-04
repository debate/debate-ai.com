// @vitest-environment jsdom
/**
 * @fileoverview `ViewCount` — view totals scale from small gray to large gold
 * (30,000+) and keep getting yellower past that.
 */

import { describe, it, expect } from "vitest";
import { mount } from "./helpers/mount";

import {
  ViewCount,
  viewCountLevel,
  viewCountStyle,
  VIEW_COUNT_CEILING,
  VIEW_COUNT_GOLD,
} from "../src/view-count";

const fontEm = (views: number) => parseFloat(String(viewCountStyle(views).fontSize));
const rgb = (views: number) =>
  String(viewCountStyle(views).color).match(/\d+/g)!.map(Number) as [number, number, number];

describe("viewCountLevel", () => {
  it("is 0 for small or invalid totals, 1 at gold and 2 at the ceiling", () => {
    expect(viewCountLevel(0)).toBe(0);
    expect(viewCountLevel(50)).toBe(0);
    expect(viewCountLevel(Number.NaN)).toBe(0);
    expect(viewCountLevel(VIEW_COUNT_GOLD)).toBeCloseTo(1);
    expect(viewCountLevel(VIEW_COUNT_CEILING)).toBeCloseTo(2);
    expect(viewCountLevel(10_000_000)).toBe(2);
  });

  it("rises with the total", () => {
    expect(viewCountLevel(1_000)).toBeLessThan(viewCountLevel(5_000));
    expect(viewCountLevel(5_000)).toBeLessThan(viewCountLevel(17_000));
    expect(viewCountLevel(17_000)).toBeLessThan(viewCountLevel(VIEW_COUNT_GOLD));
  });
});

describe("viewCountStyle", () => {
  it("starts gray and smaller than the surrounding text", () => {
    expect(viewCountStyle(10).color).toBe("rgb(138, 143, 152)");
    expect(fontEm(10)).toBeLessThan(1);
  });

  it("is full gold and larger at 30,000", () => {
    expect(viewCountStyle(VIEW_COUNT_GOLD).color).toBe("rgb(212, 160, 23)");
    expect(fontEm(VIEW_COUNT_GOLD)).toBeGreaterThan(1);
    expect(viewCountStyle(VIEW_COUNT_GOLD).fontWeight).toBe(700);
  });

  it("keeps getting yellower and larger past gold", () => {
    // More red and green, less blue: a brighter, yellower gold.
    const [r0, g0] = rgb(VIEW_COUNT_GOLD);
    const [r1, g1] = rgb(100_000);
    expect(r1).toBeGreaterThan(r0);
    expect(g1).toBeGreaterThan(g0);
    expect(fontEm(100_000)).toBeGreaterThan(fontEm(VIEW_COUNT_GOLD));
  });

  it("never drifts toward blue or green on the way to gold", () => {
    for (const n of [500, 1_700, 5_000, 17_000]) {
      const [r, g, b] = rgb(n);
      expect(r).toBeGreaterThanOrEqual(g);
      expect(g).toBeGreaterThanOrEqual(b);
    }
  });

  it("grows monotonically in size", () => {
    const sizes = [100, 1_000, 10_000, 30_000, 300_000].map(fontEm);
    expect([...sizes].sort((a, b) => a - b)).toEqual(sizes);
  });
});

describe("ViewCount", () => {
  it("renders the abbreviated total with the full number in its title", async () => {
    const view = await mount(<ViewCount views={17_400} suffix=" views" />);
    const span = view.container.querySelector("span")!;
    expect(span.textContent).toBe("17k views");
    expect(span.title).toBe(`${(17_400).toLocaleString()} views`);
    expect(span.style.color).not.toBe("");
    await view.unmount();
  });
});
