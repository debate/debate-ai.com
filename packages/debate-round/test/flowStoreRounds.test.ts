import { beforeEach, describe, expect, it } from "vitest";
import { useFlowStore } from "../src/state/store";
import type { Round } from "debate-core/src/types/flow";

/**
 * Minimal in-memory `localStorage` mock — this package's Vitest environment
 * has no DOM by default (see `judge-decision-store-wiring.test.ts`).
 */
class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
}

function makeRoundInput(overrides: Partial<Omit<Round, "id" | "timestamp">> = {}): Omit<Round, "id" | "timestamp"> {
  return {
    tournamentName: "Glenbrooks",
    roundLevel: "Octafinals",
    debaters: { aff: ["a@b.com", ""], neg: ["c@d.com", ""] },
    judges: ["judge@e.com"],
    flowIds: [1, 2],
    status: "completed",
    ...overrides,
  };
}

function makeRound(id: number, overrides: Partial<Round> = {}): Round {
  return { ...makeRoundInput(), id, timestamp: id, ...overrides };
}

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
  useFlowStore.setState({ rounds: [] });
});

describe("useFlowStore round CRUD", () => {
  it("createRound assigns an id and timestamp and appends to rounds", () => {
    const round = useFlowStore.getState().createRound(makeRoundInput());

    expect(typeof round.id).toBe("number");
    expect(typeof round.timestamp).toBe("number");
    expect(useFlowStore.getState().rounds).toEqual([round]);
    expect(JSON.parse(localStorage.getItem("rounds")!)).toEqual([round]);
  });

  it("updateRound patches only the matching round", () => {
    const a = makeRound(1, { tournamentName: "A" });
    const b = makeRound(2, { tournamentName: "B" });
    useFlowStore.getState().setRounds([a, b]);

    useFlowStore.getState().updateRound(a.id, { roundLevel: "Finals" });

    const rounds = useFlowStore.getState().rounds;
    expect(rounds.find((r) => r.id === a.id)?.roundLevel).toBe("Finals");
    expect(rounds.find((r) => r.id === b.id)?.roundLevel).toBe("Octafinals");
  });

  it("deleteRound removes only the matching round and persists the change", () => {
    const a = makeRound(1, { tournamentName: "A" });
    const b = makeRound(2, { tournamentName: "B" });
    useFlowStore.getState().setRounds([a, b]);

    useFlowStore.getState().deleteRound(a.id);

    const rounds = useFlowStore.getState().rounds;
    expect(rounds).toEqual([b]);
    expect(JSON.parse(localStorage.getItem("rounds")!)).toEqual([b]);
  });

  it("deleteRound on an unknown id leaves the rounds list untouched", () => {
    const a = makeRound(1);
    useFlowStore.getState().setRounds([a]);

    useFlowStore.getState().deleteRound(a.id + 1);

    expect(useFlowStore.getState().rounds).toEqual([a]);
  });

  it("deleteRound on an empty rounds list is a no-op", () => {
    useFlowStore.getState().deleteRound(123);

    expect(useFlowStore.getState().rounds).toEqual([]);
    expect(JSON.parse(localStorage.getItem("rounds")!)).toEqual([]);
  });
});
