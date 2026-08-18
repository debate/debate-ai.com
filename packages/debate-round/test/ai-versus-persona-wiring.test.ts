import { beforeEach, describe, expect, it } from "vitest";
import {
  buildAiVersusPersonaPromptSection,
  resolveAiVersusOpponentPersona,
} from "../src/round/ai-versus-persona-wiring";
import { saveOpponentPersonaSelection } from "debate-speech-writer/src/state/opponentPersonaSelections";
import { opponentPersonas } from "debate-speech-writer/src/opponent/opponent-personas";

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

describe("resolveAiVersusOpponentPersona", () => {
  it("returns null when no persona is selected for the round's id", () => {
    expect(resolveAiVersusOpponentPersona("round-1")).toBeNull();
  });

  it("resolves the persona saved under the same id as the round's sessionId", () => {
    saveOpponentPersonaSelection({ sessionId: "round-1", persona: opponentPersonas.kritik });
    expect(resolveAiVersusOpponentPersona("round-1")).toEqual(opponentPersonas.kritik);
  });

  it("scopes lookups to the given id", () => {
    saveOpponentPersonaSelection({ sessionId: "round-2", persona: opponentPersonas.lay });
    expect(resolveAiVersusOpponentPersona("round-1")).toBeNull();
  });
});

describe("buildAiVersusPersonaPromptSection", () => {
  it("returns null when no persona is selected", () => {
    expect(buildAiVersusPersonaPromptSection("round-1")).toBeNull();
  });

  it("builds the persona prompt section when a persona is selected", () => {
    saveOpponentPersonaSelection({ sessionId: "round-1", persona: opponentPersonas["fast-flow"] });
    const section = buildAiVersusPersonaPromptSection("round-1");
    expect(section).toContain("Opponent Persona: Fast Flow");
    expect(section).toContain("maximum competitive speed");
  });
});
