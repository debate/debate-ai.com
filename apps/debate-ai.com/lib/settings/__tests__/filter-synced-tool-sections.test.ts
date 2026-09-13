import { describe, expect, it } from "vitest";
import { filterSyncedToolSections, type SyncedToolSectionGroup } from "../filter-synced-tool-sections";

const GROUPS: SyncedToolSectionGroup[] = [
  {
    section: "Practice",
    tools: [
      { href: "/practice-round", label: "Practice Round Simulator" },
      { href: "/drills", label: "Practice Drills" },
    ],
  },
  {
    section: "Videos",
    tools: [
      { href: "/videos", label: "Video Favorites" },
      { href: "/videos", label: "Hidden Videos" },
    ],
  },
];

describe("filterSyncedToolSections", () => {
  it("returns every group unchanged for an empty query", () => {
    expect(filterSyncedToolSections(GROUPS, "")).toEqual(GROUPS);
  });

  it("returns every group unchanged for a whitespace-only query", () => {
    expect(filterSyncedToolSections(GROUPS, "   ")).toEqual(GROUPS);
  });

  it("matches a tool label case-insensitively", () => {
    const result = filterSyncedToolSections(GROUPS, "drills");
    expect(result).toEqual([
      { section: "Practice", tools: [{ href: "/drills", label: "Practice Drills" }] },
    ]);
  });

  it("matches a tool label by substring, not just prefix", () => {
    const result = filterSyncedToolSections(GROUPS, "favorites");
    expect(result).toEqual([
      { section: "Videos", tools: [{ href: "/videos", label: "Video Favorites" }] },
    ]);
  });

  it("keeps every tool in a section whose own name matches", () => {
    const result = filterSyncedToolSections(GROUPS, "video");
    expect(result).toEqual([GROUPS[1]]);
  });

  it("drops a section left with no matching tools", () => {
    const result = filterSyncedToolSections(GROUPS, "practice round");
    expect(result).toEqual([
      { section: "Practice", tools: [{ href: "/practice-round", label: "Practice Round Simulator" }] },
    ]);
    expect(result.some((group) => group.section === "Videos")).toBe(false);
  });

  it("returns an empty list when nothing matches", () => {
    expect(filterSyncedToolSections(GROUPS, "nonexistent tool")).toEqual([]);
  });

  it("does not mutate the input groups", () => {
    const before = JSON.parse(JSON.stringify(GROUPS));
    filterSyncedToolSections(GROUPS, "drills");
    expect(GROUPS).toEqual(before);
  });
});
