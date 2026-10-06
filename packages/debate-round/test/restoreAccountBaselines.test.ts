import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getRoundAccountStatus,
  recordRoundSavedToAccount,
  resetFlowAccountStatus,
} from "../src/state/flowAccountStatus";
import { resetRestoreAccountBaselines, restoreAccountBaselinesOnce } from "../src/state/restoreAccountBaselines";
import type { Round } from "../src/types/flow";

const round: Round = {
  id: 7,
  tournamentName: "Glenbrooks",
  roundLevel: "Octos",
  debaters: { aff: ["A", "B"], neg: ["C", "D"] },
  judges: [],
  flowIds: [],
  timestamp: 1,
  status: "active",
};

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}

/** Saves the round, then simulates a reload: memory cleared, localStorage kept. */
function saveThenReload(updatedAt: string) {
  recordRoundSavedToAccount(round, updatedAt);
  const stored = localStorage.getItem("debate:account-save-baselines") ?? "";
  resetFlowAccountStatus();
  localStorage.setItem("debate:account-save-baselines", stored);
}

afterEach(() => {
  resetFlowAccountStatus();
  resetRestoreAccountBaselines();
  vi.unstubAllGlobals();
});

describe("restoreAccountBaselinesOnce", () => {
  it("restores a baseline the account confirms", async () => {
    vi.stubGlobal("localStorage", memoryStorage());
    saveThenReload("2026-01-01T00:00:00Z");
    expect(getRoundAccountStatus(round)).toBe("unknown");

    await restoreAccountBaselinesOnce({
      listFlows: async () => [],
      listRounds: async () => [{ clientId: 7, updatedAt: "2026-01-01T00:00:00Z" }],
    });
    expect(getRoundAccountStatus(round)).toBe("saved");
  });

  it("does not restore when the account holds a different version", async () => {
    vi.stubGlobal("localStorage", memoryStorage());
    saveThenReload("2026-01-01T00:00:00Z");
    await restoreAccountBaselinesOnce({
      listFlows: async () => [],
      listRounds: async () => [{ clientId: 7, updatedAt: "2026-02-02T00:00:00Z" }],
    });
    expect(getRoundAccountStatus(round)).toBe("unknown");
  });

  it("fetches once per session, sharing concurrent callers", async () => {
    const sources = { listFlows: vi.fn(async () => []), listRounds: vi.fn(async () => []) };
    await Promise.all([restoreAccountBaselinesOnce(sources), restoreAccountBaselinesOnce(sources)]);
    await restoreAccountBaselinesOnce(sources);
    expect(sources.listFlows).toHaveBeenCalledTimes(1);
    expect(sources.listRounds).toHaveBeenCalledTimes(1);
  });

  it("retries after being signed out", async () => {
    const signedOut = { listFlows: async () => null, listRounds: async () => null };
    await expect(restoreAccountBaselinesOnce(signedOut)).resolves.toBeUndefined();
    const sources = { listFlows: vi.fn(async () => []), listRounds: vi.fn(async () => []) };
    await restoreAccountBaselinesOnce(sources);
    expect(sources.listFlows).toHaveBeenCalledTimes(1);
  });

  it("swallows fetch failures and retries on the next call", async () => {
    const failing = {
      listFlows: async () => {
        throw new Error("network");
      },
      listRounds: async () => [],
    };
    await expect(restoreAccountBaselinesOnce(failing)).resolves.toBeUndefined();
    const sources = { listFlows: vi.fn(async () => []), listRounds: vi.fn(async () => []) };
    await restoreAccountBaselinesOnce(sources);
    expect(sources.listRounds).toHaveBeenCalledTimes(1);
  });
});
