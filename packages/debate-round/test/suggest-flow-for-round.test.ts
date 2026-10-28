import { describe, expect, it } from "vitest";
import { suggestFlowsForRound } from "../src/flow/suggest-flow-for-round";

const flow = (clientId: number, label: string, updatedAt = "2026-10-01T00:00:00Z") => ({
  clientId,
  label,
  updatedAt,
});

describe("suggestFlowsForRound", () => {
  const flows = [
    flow(1, "Harvard Round 3 Varsity"),
    flow(2, "Harvard Round 4 JV", "2026-10-02T00:00:00Z"),
    flow(3, "Yale R1"),
  ];

  it("returns nothing for a blank tournament name", () => {
    expect(suggestFlowsForRound(flows, { tournamentName: "  " })).toEqual([]);
  });

  it("matches the tournament name case-insensitively", () => {
    const result = suggestFlowsForRound(flows, { tournamentName: "HARVARD" });
    expect(result.map((f) => f.clientId)).toEqual([2, 1]);
  });

  it("ranks flows that also mention the division and round id higher", () => {
    const result = suggestFlowsForRound(flows, {
      tournamentName: "Harvard",
      division: "Varsity",
      roundId: "Round 3",
    });
    expect(result.map((f) => f.clientId)).toEqual([1, 2]);
  });

  it("returns nothing when no label mentions the tournament", () => {
    expect(suggestFlowsForRound(flows, { tournamentName: "Stanford" })).toEqual([]);
  });

  it("ignores empty labels", () => {
    expect(suggestFlowsForRound([flow(9, "")], { tournamentName: "Harvard" })).toEqual([]);
  });
});
