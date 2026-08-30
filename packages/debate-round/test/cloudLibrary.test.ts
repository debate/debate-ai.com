import { describe, expect, it } from "vitest";
import {
  buildRecentCloudItems,
  formatRelativeCloudTime,
  parseCloudTimestamp,
  type CloudDocumentSummary,
} from "../src/state/cloudLibrary";
import type { SavedFlowSummary } from "../src/state/savedFlows";
import type { SavedRoundSummary } from "../src/state/savedRounds";

describe("parseCloudTimestamp", () => {
  it("parses an ISO date string", () => {
    expect(parseCloudTimestamp("2026-08-30T12:00:00.000Z")).toBe(Date.parse("2026-08-30T12:00:00.000Z"));
  });

  it("treats a small number as unix seconds", () => {
    expect(parseCloudTimestamp(1_772_193_600)).toBe(1_772_193_600_000);
  });

  it("treats a large number as milliseconds already", () => {
    expect(parseCloudTimestamp(1_772_193_600_000)).toBe(1_772_193_600_000);
  });

  it("returns 0 for a non-finite number", () => {
    expect(parseCloudTimestamp(Number.NaN)).toBe(0);
    expect(parseCloudTimestamp(Number.POSITIVE_INFINITY)).toBe(0);
  });

  it("returns 0 for an unparseable string", () => {
    expect(parseCloudTimestamp("not a date")).toBe(0);
  });
});

describe("buildRecentCloudItems", () => {
  const documents: CloudDocumentSummary[] = [
    { id: 1, title: "Case Neg", updatedAt: "2026-08-28T00:00:00.000Z" },
  ];
  const flows: SavedFlowSummary[] = [
    { clientId: 2, label: "1AC vs Policy K", updatedAt: "2026-08-30T00:00:00.000Z" },
  ];
  const rounds: SavedRoundSummary[] = [
    { clientId: 3, label: "State Quals - Round 4", updatedAt: "2026-08-29T00:00:00.000Z" },
  ];

  it("merges all three kinds and sorts newest first", () => {
    const items = buildRecentCloudItems({ documents, flows, rounds });
    expect(items.map((i) => i.kind)).toEqual(["flow", "round", "document"]);
  });

  it("includes flows — the gap this module closes: the widget previously omitted them entirely", () => {
    const items = buildRecentCloudItems({ documents: [], flows, rounds: [] });
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ kind: "flow", key: "flow-2", label: "1AC vs Policy K" });
  });

  it("defaults hrefs per kind and lets a caller override them", () => {
    const items = buildRecentCloudItems({ documents, flows, rounds });
    const byKind = Object.fromEntries(items.map((i) => [i.kind, i.href]));
    expect(byKind.document).toBe("/reason-editor");
    expect(byKind.flow).toBe("/debate");
    expect(byKind.round).toBe("/debate");

    const overridden = buildRecentCloudItems({ flows }, { flowHref: "/custom-flow-route" });
    expect(overridden[0]?.href).toBe("/custom-flow-route");
  });

  it("falls back to an untitled label per kind when the title/label is blank", () => {
    const items = buildRecentCloudItems({
      documents: [{ id: 1, title: "   ", updatedAt: "2026-08-30T00:00:00.000Z" }],
      flows: [{ clientId: 2, label: "", updatedAt: "2026-08-30T00:00:00.000Z" }],
      rounds: [{ clientId: 3, label: "", updatedAt: "2026-08-30T00:00:00.000Z" }],
    });
    const byKind = Object.fromEntries(items.map((i) => [i.kind, i.label]));
    expect(byKind.document).toBe("Untitled");
    expect(byKind.flow).toBe("Untitled flow");
    expect(byKind.round).toBe("Untitled round");
  });

  it("caps each kind to perKindLimit before merging", () => {
    const manyFlows: SavedFlowSummary[] = Array.from({ length: 10 }, (_, i) => ({
      clientId: i,
      label: `Flow ${i}`,
      updatedAt: new Date(Date.UTC(2026, 7, 30 - i)).toISOString(),
    }));
    const items = buildRecentCloudItems({ flows: manyFlows }, { perKindLimit: 3, limit: 20 });
    expect(items).toHaveLength(3);
    expect(items.map((i) => i.label)).toEqual(["Flow 0", "Flow 1", "Flow 2"]);
  });

  it("caps the merged result to limit", () => {
    const items = buildRecentCloudItems({ documents, flows, rounds }, { limit: 2 });
    expect(items).toHaveLength(2);
  });

  it("returns an empty list for empty/omitted input", () => {
    expect(buildRecentCloudItems({})).toEqual([]);
    expect(buildRecentCloudItems({ documents: [], flows: [], rounds: [] })).toEqual([]);
  });
});

describe("formatRelativeCloudTime", () => {
  const now = Date.parse("2026-08-30T12:00:00.000Z");

  it("returns Today for a timestamp within the last 24 hours", () => {
    expect(formatRelativeCloudTime(now - 1000, now)).toBe("Today");
    expect(formatRelativeCloudTime(now, now)).toBe("Today");
  });

  it("returns Today for a timestamp in the future (clock skew tolerance)", () => {
    expect(formatRelativeCloudTime(now + 60_000, now)).toBe("Today");
  });

  it("returns Yesterday for a timestamp 1-2 days ago", () => {
    expect(formatRelativeCloudTime(now - 25 * 3_600_000, now)).toBe("Yesterday");
  });

  it("returns 'Nd ago' for older timestamps", () => {
    expect(formatRelativeCloudTime(now - 5 * 86_400_000, now)).toBe("5d ago");
  });

  it("returns an empty string for a non-finite timestamp", () => {
    expect(formatRelativeCloudTime(Number.NaN, now)).toBe("");
  });
});
