import { describe, expect, it } from "vitest";
import { computeBreadcrumbPath } from "../src/editor/heading-breadcrumb";
import type { HeadingEntry } from "../src/editor/headings";

function entry(partial: Pick<HeadingEntry, "type" | "text" | "pos" | "level"> & Partial<HeadingEntry>): HeadingEntry {
  return {
    id: null,
    cite: null,
    zonePos: null,
    ...partial,
  };
}

describe("computeBreadcrumbPath", () => {
  it("returns an empty chain for no headings", () => {
    expect(computeBreadcrumbPath([], 0)).toEqual([]);
  });

  it("returns an empty chain when pos is before every heading", () => {
    const headings = [entry({ type: "pocket", text: "Case", pos: 10, level: 1 })];
    expect(computeBreadcrumbPath(headings, 5)).toEqual([]);
  });

  it("returns just the root heading when pos is at/after it and there's no deeper heading yet", () => {
    const pocket = entry({ type: "pocket", text: "Case", pos: 10, level: 1 });
    expect(computeBreadcrumbPath([pocket], 10)).toEqual([pocket]);
    expect(computeBreadcrumbPath([pocket], 500)).toEqual([pocket]);
  });

  it("builds the full ancestor chain for a nested pocket > hat > block > tag", () => {
    const pocket = entry({ type: "pocket", text: "Case", pos: 0, level: 1 });
    const hat = entry({ type: "hat", text: "Advantage", pos: 20, level: 2 });
    const block = entry({ type: "block", text: "Uniqueness", pos: 40, level: 3 });
    const tag = entry({ type: "tag", text: "Warming is real", pos: 60, level: 4 });
    const headings = [pocket, hat, block, tag];
    expect(computeBreadcrumbPath(headings, 65)).toEqual([pocket, hat, block, tag]);
    // Between block and tag: only the ancestors so far, no tag yet.
    expect(computeBreadcrumbPath(headings, 55)).toEqual([pocket, hat, block]);
  });

  it("pops deeper siblings when a shallower or equal-level heading follows", () => {
    const pocket = entry({ type: "pocket", text: "Case", pos: 0, level: 1 });
    const hat1 = entry({ type: "hat", text: "Advantage 1", pos: 20, level: 2 });
    const block = entry({ type: "block", text: "Uniqueness", pos: 40, level: 3 });
    const hat2 = entry({ type: "hat", text: "Advantage 2", pos: 60, level: 2 });
    const headings = [pocket, hat1, block, hat2];
    // Under hat2 (a sibling of hat1), block's chain must not linger.
    expect(computeBreadcrumbPath(headings, 65)).toEqual([pocket, hat2]);
  });

  it("resets the chain across two top-level (level 1) headings", () => {
    const pocket1 = entry({ type: "pocket", text: "Case 1", pos: 0, level: 1 });
    const hat = entry({ type: "hat", text: "Advantage", pos: 20, level: 2 });
    const pocket2 = entry({ type: "pocket", text: "Case 2", pos: 40, level: 1 });
    const headings = [pocket1, hat, pocket2];
    expect(computeBreadcrumbPath(headings, 45)).toEqual([pocket2]);
  });

  it("treats an analytic (level 4) the same as a tag for chain-building", () => {
    const block = entry({ type: "block", text: "Link", pos: 0, level: 3 });
    const analytic = entry({ type: "analytic", text: "This proves the link", pos: 20, level: 4 });
    const headings = [block, analytic];
    expect(computeBreadcrumbPath(headings, 25)).toEqual([block, analytic]);
  });

  it("stops scanning once it passes pos, ignoring later headings entirely", () => {
    const pocket = entry({ type: "pocket", text: "Case", pos: 0, level: 1 });
    const hatLater = entry({ type: "hat", text: "Later", pos: 1000, level: 2 });
    expect(computeBreadcrumbPath([pocket, hatLater], 10)).toEqual([pocket]);
  });
});
