import { describe, expect, it } from "vitest";
import {
  buildSavedCustomOpponentPersona,
  isValidSavedCustomOpponentPersona,
  resolveOpponentPersonaFromLibraryEntry,
  sortCustomOpponentPersonaLibrary,
  type SavedCustomOpponentPersona,
} from "../src/opponent/opponent-persona-library";
import { buildOpponentPersonaPrompt } from "../src/opponent/opponent-personas";

describe("buildSavedCustomOpponentPersona", () => {
  it("builds a saved library entry from a name and notes", () => {
    const entry = buildSavedCustomOpponentPersona(
      { name: "Coach Amy's K bot", notes: "Opens on framework, spreads fast." },
      1000,
    );

    expect(entry.name).toBe("Coach Amy's K bot");
    expect(entry.notes).toBe("Opens on framework, spreads fast.");
    expect(entry.shared).toBe(false);
    expect(entry.createdAt).toBe(1000);
    expect(entry.updatedAt).toBe(1000);
    expect(typeof entry.id).toBe("string");
    expect(entry.id.length).toBeGreaterThan(0);
  });

  it("defaults shared to false when omitted", () => {
    const entry = buildSavedCustomOpponentPersona({ name: "Speedster", notes: "Spreads everything." });
    expect(entry.shared).toBe(false);
  });

  it("carries an explicit shared flag through", () => {
    const entry = buildSavedCustomOpponentPersona({ name: "Speedster", notes: "Spreads everything.", shared: true });
    expect(entry.shared).toBe(true);
  });

  it("reuses a caller-supplied id (e.g. editing an existing entry in place)", () => {
    const entry = buildSavedCustomOpponentPersona({ id: "fixed-id", name: "Speedster", notes: "Spreads everything." });
    expect(entry.id).toBe("fixed-id");
  });

  it("generates distinct ids for entries with no caller-supplied id", () => {
    const a = buildSavedCustomOpponentPersona({ name: "A", notes: "Notes A." });
    const b = buildSavedCustomOpponentPersona({ name: "B", notes: "Notes B." });
    expect(a.id).not.toBe(b.id);
  });

  it("sanitizes and clamps name/notes the same way buildCustomOpponentPersona does", () => {
    const entry = buildSavedCustomOpponentPersona({
      name: "  Speedster  ",
      notes: "  Line one\nLine two\x00\x07 has a bell.  ",
    });
    expect(entry.name).toBe("Speedster");
    expect(entry.notes).toBe("Line one\nLine two has a bell.");
  });

  it("throws when name is empty after sanitization", () => {
    expect(() => buildSavedCustomOpponentPersona({ name: "   ", notes: "Some notes" })).toThrow(/name is required/);
  });

  it("throws when notes are empty after sanitization", () => {
    expect(() => buildSavedCustomOpponentPersona({ name: "Speedster", notes: "   " })).toThrow(/notes are required/);
  });
});

describe("resolveOpponentPersonaFromLibraryEntry", () => {
  it("produces an OpponentPersona usable by buildOpponentPersonaPrompt", () => {
    const entry = buildSavedCustomOpponentPersona({ name: "Speedster", notes: "Spreads everything." });
    const persona = resolveOpponentPersonaFromLibraryEntry(entry);

    expect(persona.id).toBe("custom");
    expect(persona.name).toBe("Custom: Speedster");
    expect(persona.instructions).toBe("Spreads everything.");

    const prompt = buildOpponentPersonaPrompt(persona);
    expect(prompt).toContain("Opponent Persona: Custom: Speedster");
    expect(prompt).toContain("Spreads everything.");
  });
});

describe("sortCustomOpponentPersonaLibrary", () => {
  const beta: SavedCustomOpponentPersona = {
    id: "1",
    name: "Beta Bot",
    notes: "notes",
    shared: false,
    createdAt: 0,
    updatedAt: 0,
  };
  const alpha: SavedCustomOpponentPersona = { ...beta, id: "2", name: "alpha bot" };

  it("sorts alphabetically by name, case-insensitively", () => {
    expect(sortCustomOpponentPersonaLibrary([beta, alpha])).toEqual([alpha, beta]);
  });

  it("does not mutate the input array", () => {
    const input = [beta, alpha];
    sortCustomOpponentPersonaLibrary(input);
    expect(input).toEqual([beta, alpha]);
  });
});

describe("isValidSavedCustomOpponentPersona", () => {
  const valid: SavedCustomOpponentPersona = {
    id: "abc",
    name: "Speedster",
    notes: "Spreads everything.",
    shared: false,
    createdAt: 1,
    updatedAt: 2,
  };

  it("accepts a well-formed entry", () => {
    expect(isValidSavedCustomOpponentPersona(valid)).toBe(true);
  });

  it("rejects non-objects", () => {
    expect(isValidSavedCustomOpponentPersona(null)).toBe(false);
    expect(isValidSavedCustomOpponentPersona("nope")).toBe(false);
    expect(isValidSavedCustomOpponentPersona(42)).toBe(false);
  });

  it("rejects a missing or empty id", () => {
    expect(isValidSavedCustomOpponentPersona({ ...valid, id: undefined })).toBe(false);
    expect(isValidSavedCustomOpponentPersona({ ...valid, id: "" })).toBe(false);
  });

  it("rejects a missing or empty name", () => {
    expect(isValidSavedCustomOpponentPersona({ ...valid, name: undefined })).toBe(false);
    expect(isValidSavedCustomOpponentPersona({ ...valid, name: "   " })).toBe(false);
  });

  it("rejects a missing or empty notes field", () => {
    expect(isValidSavedCustomOpponentPersona({ ...valid, notes: undefined })).toBe(false);
    expect(isValidSavedCustomOpponentPersona({ ...valid, notes: "" })).toBe(false);
  });

  it("rejects a non-boolean shared flag", () => {
    expect(isValidSavedCustomOpponentPersona({ ...valid, shared: "yes" })).toBe(false);
  });

  it("rejects non-numeric timestamps", () => {
    expect(isValidSavedCustomOpponentPersona({ ...valid, createdAt: "1" })).toBe(false);
    expect(isValidSavedCustomOpponentPersona({ ...valid, updatedAt: "2" })).toBe(false);
  });
});
