import { afterEach, describe, expect, it, vi } from "vitest";
import {
  forgetFlowAccountStatus,
  getFlowAccountStatus,
  forgetRoundAccountStatus,
  getFlowAccountStatusVersion,
  getRoundAccountStatus,
  recordFlowSavedToAccount,
  recordRoundSavedToAccount,
  resetFlowAccountStatus,
  subscribeFlowAccountStatus,
} from "../src/state/flowAccountStatus";
import type { Flow, Round } from "../src/types/flow";

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
    id: 1,
    ...overrides,
  };
}

function makeRound(overrides: Partial<Round> = {}): Round {
  return {
    id: 1,
    tournamentName: "Glenbrooks",
    roundLevel: "Octos",
    debaters: { aff: ["A", "B"], neg: ["C", "D"] },
    judges: [],
    flowIds: [1],
    timestamp: 1,
    status: "active",
    ...overrides,
  };
}

afterEach(() => resetFlowAccountStatus());

describe("flowAccountStatus", () => {
  it("is unknown until a save has been recorded this session", () => {
    expect(getFlowAccountStatus(makeFlow())).toBe("unknown");
  });

  it("reports saved while the content matches the last account save", () => {
    const flow = makeFlow();
    recordFlowSavedToAccount(flow);
    expect(getFlowAccountStatus(makeFlow())).toBe("saved");
  });

  it("reports unsaved once the flow is edited after a save", () => {
    recordFlowSavedToAccount(makeFlow());
    expect(getFlowAccountStatus(makeFlow({ content: "1AC (edited)" }))).toBe("unsaved");
  });

  it("tracks flows independently by id", () => {
    recordFlowSavedToAccount(makeFlow({ id: 1 }));
    expect(getFlowAccountStatus(makeFlow({ id: 2 }))).toBe("unknown");
  });

  it("forgets a single flow or everything", () => {
    recordFlowSavedToAccount(makeFlow({ id: 1 }));
    recordFlowSavedToAccount(makeFlow({ id: 2 }));
    forgetFlowAccountStatus(1);
    expect(getFlowAccountStatus(makeFlow({ id: 1 }))).toBe("unknown");
    expect(getFlowAccountStatus(makeFlow({ id: 2 }))).toBe("saved");
    resetFlowAccountStatus();
    expect(getFlowAccountStatus(makeFlow({ id: 2 }))).toBe("unknown");
  });

  it("notifies subscribers and bumps the version only on real changes", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeFlowAccountStatus(listener);
    const before = getFlowAccountStatusVersion();
    recordFlowSavedToAccount(makeFlow());
    expect(listener).toHaveBeenCalledTimes(1);
    expect(getFlowAccountStatusVersion()).toBe(before + 1);
    forgetFlowAccountStatus(999);
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    resetFlowAccountStatus();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  describe("rounds", () => {
    it("is unknown, saved, then unsaved as the round changes", () => {
      expect(getRoundAccountStatus(makeRound())).toBe("unknown");
      recordRoundSavedToAccount(makeRound());
      expect(getRoundAccountStatus(makeRound())).toBe("saved");
      expect(getRoundAccountStatus(makeRound({ status: "completed" }))).toBe("unsaved");
    });

    it("keeps round and flow baselines separate even with the same id", () => {
      recordRoundSavedToAccount(makeRound({ id: 1 }));
      expect(getFlowAccountStatus(makeFlow({ id: 1 }))).toBe("unknown");
    });

    it("forgets one round, and reset clears rounds too", () => {
      recordRoundSavedToAccount(makeRound({ id: 1 }));
      recordRoundSavedToAccount(makeRound({ id: 2 }));
      forgetRoundAccountStatus(1);
      expect(getRoundAccountStatus(makeRound({ id: 1 }))).toBe("unknown");
      resetFlowAccountStatus();
      expect(getRoundAccountStatus(makeRound({ id: 2 }))).toBe("unknown");
    });
  });
});
