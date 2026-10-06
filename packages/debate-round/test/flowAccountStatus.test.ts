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
  restoreFlowAccountBaselines,
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

function stubLocalStorage(): Map<string, string> {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  });
  return store;
}

afterEach(() => {
  resetFlowAccountStatus();
  vi.unstubAllGlobals();
});

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

  describe("persisted baselines", () => {
    const savedAt = "2026-10-05T10:00:00.000Z";

    /** Simulates a reload: in-memory baselines gone, localStorage kept. */
    function reload(store: Map<string, string>): void {
      const kept = store.get("debate:account-save-baselines");
      resetFlowAccountStatus();
      if (kept) store.set("debate:account-save-baselines", kept);
    }

    it("restores a baseline the account confirms by updatedAt", () => {
      const store = stubLocalStorage();
      recordFlowSavedToAccount(makeFlow(), savedAt);
      recordRoundSavedToAccount(makeRound(), savedAt);
      reload(store);
      expect(getFlowAccountStatus(makeFlow())).toBe("unknown");

      restoreFlowAccountBaselines([{ clientId: 1, updatedAt: savedAt }], [{ clientId: 1, updatedAt: savedAt }]);
      expect(getFlowAccountStatus(makeFlow())).toBe("saved");
      expect(getFlowAccountStatus(makeFlow({ content: "edited" }))).toBe("unsaved");
      expect(getRoundAccountStatus(makeRound())).toBe("saved");
    });

    it("does not restore when the account holds a different version or no copy", () => {
      const store = stubLocalStorage();
      recordFlowSavedToAccount(makeFlow(), savedAt);
      reload(store);
      restoreFlowAccountBaselines([{ clientId: 1, updatedAt: "2026-10-06T00:00:00.000Z" }]);
      expect(getFlowAccountStatus(makeFlow())).toBe("unknown");
      restoreFlowAccountBaselines([{ clientId: 2, updatedAt: savedAt }]);
      expect(getFlowAccountStatus(makeFlow())).toBe("unknown");
    });

    it("does not persist a save that has no updatedAt", () => {
      const store = stubLocalStorage();
      recordFlowSavedToAccount(makeFlow());
      reload(store);
      restoreFlowAccountBaselines([{ clientId: 1, updatedAt: savedAt }]);
      expect(getFlowAccountStatus(makeFlow())).toBe("unknown");
    });

    it("never overrides a baseline recorded this session", () => {
      const store = stubLocalStorage();
      recordFlowSavedToAccount(makeFlow(), savedAt);
      recordFlowSavedToAccount(makeFlow({ content: "newer" }));
      restoreFlowAccountBaselines([{ clientId: 1, updatedAt: savedAt }]);
      expect(getFlowAccountStatus(makeFlow({ content: "newer" }))).toBe("saved");
      expect(store.size).toBe(1);
    });

    it("forget and reset drop the persisted entries", () => {
      const store = stubLocalStorage();
      recordFlowSavedToAccount(makeFlow({ id: 1 }), savedAt);
      recordFlowSavedToAccount(makeFlow({ id: 2 }), savedAt);
      forgetFlowAccountStatus(1);
      reload(store);
      restoreFlowAccountBaselines([
        { clientId: 1, updatedAt: savedAt },
        { clientId: 2, updatedAt: savedAt },
      ]);
      expect(getFlowAccountStatus(makeFlow({ id: 1 }))).toBe("unknown");
      expect(getFlowAccountStatus(makeFlow({ id: 2 }))).toBe("saved");

      resetFlowAccountStatus();
      restoreFlowAccountBaselines([{ clientId: 2, updatedAt: savedAt }]);
      expect(getFlowAccountStatus(makeFlow({ id: 2 }))).toBe("unknown");
    });

    it("ignores corrupt storage and a throwing localStorage", () => {
      const store = stubLocalStorage();
      store.set("debate:account-save-baselines", "{not json");
      expect(() => restoreFlowAccountBaselines([{ clientId: 1, updatedAt: savedAt }])).not.toThrow();
      store.set("debate:account-save-baselines", JSON.stringify({ flows: { 1: { hash: 5 } } }));
      restoreFlowAccountBaselines([{ clientId: 1, updatedAt: savedAt }]);
      expect(getFlowAccountStatus(makeFlow())).toBe("unknown");

      vi.stubGlobal("localStorage", {
        getItem: () => {
          throw new Error("blocked");
        },
        setItem: () => {
          throw new Error("blocked");
        },
      });
      expect(() => recordFlowSavedToAccount(makeFlow(), savedAt)).not.toThrow();
      expect(getFlowAccountStatus(makeFlow())).toBe("saved");
    });
  });
});
