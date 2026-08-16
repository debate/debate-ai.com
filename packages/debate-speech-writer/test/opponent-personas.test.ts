import { describe, expect, it } from "vitest";
import {
  buildOpponentPersonaPrompt,
  getOpponentPersona,
  isBuiltinOpponentPersonaId,
  listOpponentPersonas,
  opponentPersonaIds,
  opponentPersonas,
} from "../src/opponent/opponent-personas";

describe("opponentPersonas registry", () => {
  it("keys every entry by its own id", () => {
    for (const [key, persona] of Object.entries(opponentPersonas)) {
      expect(persona.id).toBe(key);
    }
  });

  it("gives every built-in persona distinct, non-empty content", () => {
    const names = new Set<string>();
    for (const persona of Object.values(opponentPersonas)) {
      expect(persona.name.length).toBeGreaterThan(0);
      expect(persona.description.length).toBeGreaterThan(0);
      expect(persona.instructions.length).toBeGreaterThan(0);
      expect(persona.preferredArguments.length).toBeGreaterThan(0);
      names.add(persona.name);
    }
    expect(names.size).toBe(Object.keys(opponentPersonas).length);
  });

  it("includes the styles named in the AI Practice Opponent idea", () => {
    const ids = new Set(opponentPersonaIds);
    for (const id of ["policy-heavy", "kritik", "lay", "fast-flow"]) {
      expect(ids.has(id as (typeof opponentPersonaIds)[number])).toBe(true);
    }
  });

  it("listOpponentPersonas returns every registry entry in id order", () => {
    expect(listOpponentPersonas().map((p) => p.id)).toEqual(opponentPersonaIds);
  });
});

describe("isBuiltinOpponentPersonaId / getOpponentPersona", () => {
  it("accepts known built-in ids", () => {
    expect(isBuiltinOpponentPersonaId("policy-heavy")).toBe(true);
    expect(getOpponentPersona("policy-heavy")).toBe(opponentPersonas["policy-heavy"]);
  });

  it("rejects unknown ids without throwing", () => {
    expect(isBuiltinOpponentPersonaId("made-up")).toBe(false);
    expect(getOpponentPersona("made-up")).toBeNull();
  });

  it("rejects prototype-pollution-style lookups", () => {
    expect(isBuiltinOpponentPersonaId("toString")).toBe(false);
    expect(getOpponentPersona("constructor")).toBeNull();
  });
});

describe("buildOpponentPersonaPrompt", () => {
  it("includes the persona name, description, priorities, pace, and instructions", () => {
    const prompt = buildOpponentPersonaPrompt(opponentPersonas.kritik);

    expect(prompt).toContain("Opponent Persona: Kritik");
    expect(prompt).toContain(opponentPersonas.kritik.description);
    expect(prompt).toContain("1. Framework arguments over how the round should be evaluated");
    expect(prompt).toContain("Pace: moderate.");
    expect(prompt).toContain(opponentPersonas.kritik.instructions);
  });

  it("numbers every preferred argument in priority order", () => {
    const prompt = buildOpponentPersonaPrompt(opponentPersonas["fast-flow"]);
    const persona = opponentPersonas["fast-flow"];

    persona.preferredArguments.forEach((argument, index) => {
      expect(prompt).toContain(`${index + 1}. ${argument}`);
    });
  });

  it("omits the preferred-arguments section when a persona has none", () => {
    const bare = {
      ...opponentPersonas.lay,
      preferredArguments: [],
    };

    const prompt = buildOpponentPersonaPrompt(bare);

    expect(prompt).not.toContain("Preferred arguments");
  });
});
