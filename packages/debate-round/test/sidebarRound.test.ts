import { describe, expect, it } from "vitest";
import { selectSidebarRound } from "../src/utils/sidebar-round";
import type { Flow, Round } from "../src/types/flow";

function makeRound(overrides: Partial<Round> = {}): Round {
  return {
    id: 1,
    tournamentName: "Glenbrooks",
    roundLevel: "Octos",
    debaters: { aff: ["A", "B"], neg: ["C", "D"] },
    judges: [],
    flowIds: [],
    timestamp: 0,
    status: "pending",
    ...overrides,
  };
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
    children: [],
    id: 1700000000000,
    ...overrides,
  };
}

describe("selectSidebarRound", () => {
  it("returns the round the selected flow belongs to, live or not", () => {
    const pending = makeRound({ id: 7, status: "pending" });
    const live = makeRound({ id: 8, status: "active" });
    expect(selectSidebarRound([pending, live], makeFlow({ roundId: 7 }))).toBe(pending);
  });

  it("falls back to the live round when the selected flow has no round", () => {
    const completed = makeRound({ id: 7, status: "completed" });
    const live = makeRound({ id: 8, status: "active" });
    expect(selectSidebarRound([completed, live], makeFlow())).toBe(live);
  });

  it("falls back to the live round when the flow's round is missing", () => {
    const live = makeRound({ id: 8, status: "active" });
    expect(selectSidebarRound([live], makeFlow({ roundId: 999 }))).toBe(live);
  });

  it("returns undefined when nothing is selected and nothing is live", () => {
    expect(selectSidebarRound([makeRound({ status: "completed" })], null)).toBeUndefined();
    expect(selectSidebarRound([], null)).toBeUndefined();
  });
});
