import { beforeEach, describe, expect, it } from "vitest";
import { opponentPersonas } from "debate-speech-writer/src/opponent/opponent-personas";
import { saveOpponentPersonaSelection } from "../src/state/opponentPersonaSelections";
import {
  getOpponentDifficultyForRound,
  getOpponentPersonaForRound,
} from "../src/round/opponent-persona-speech-wiring";

/** Minimal in-memory `localStorage` mock — this package's Vitest environment has no DOM by default here. */
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

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
});

describe("getOpponentPersonaForRound", () => {
  it("returns null when no persona is saved for the round", () => {
    expect(getOpponentPersonaForRound("round-1")).toBeNull();
  });

  it("returns the persona saved under the round's id as a sessionId", () => {
    saveOpponentPersonaSelection({ sessionId: "round-1", persona: opponentPersonas["fast-flow"] });

    expect(getOpponentPersonaForRound("round-1")).toEqual(opponentPersonas["fast-flow"]);
  });

  it("scopes lookups to the given roundId", () => {
    saveOpponentPersonaSelection({ sessionId: "round-2", persona: opponentPersonas.lay });

    expect(getOpponentPersonaForRound("round-1")).toBeNull();
  });

  it("reflects the most recently saved persona for a round", () => {
    saveOpponentPersonaSelection({ sessionId: "round-1", persona: opponentPersonas["policy-heavy"] });
    saveOpponentPersonaSelection({ sessionId: "round-1", persona: opponentPersonas.kritik });

    expect(getOpponentPersonaForRound("round-1")).toEqual(opponentPersonas.kritik);
  });
});

describe("getOpponentDifficultyForRound", () => {
  it("defaults to intermediate when no persona is saved for the round", () => {
    expect(getOpponentDifficultyForRound("round-1")).toBe("intermediate");
  });

  it("defaults to intermediate when a saved selection predates the difficulty field", () => {
    saveOpponentPersonaSelection({ sessionId: "round-1", persona: opponentPersonas.lay });
    expect(getOpponentDifficultyForRound("round-1")).toBe("intermediate");
  });

  it("returns the difficulty saved under the round's id as a sessionId", () => {
    saveOpponentPersonaSelection({
      sessionId: "round-1",
      persona: opponentPersonas["fast-flow"],
      difficulty: "elite",
    });

    expect(getOpponentDifficultyForRound("round-1")).toBe("elite");
  });

  it("scopes lookups to the given roundId", () => {
    saveOpponentPersonaSelection({ sessionId: "round-2", persona: opponentPersonas.lay, difficulty: "elite" });
    expect(getOpponentDifficultyForRound("round-1")).toBe("intermediate");
  });
});
