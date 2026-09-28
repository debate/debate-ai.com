import { describe, expect, it } from "vitest";
import { decideUpdateAction, isNewerVersion, parseManifest } from "../src/lib/update/policy";

const entry = { signature: "sig", url: "https://example.com/app.tar.gz" };

describe("parseManifest", () => {
  it("accepts a well-formed manifest and keeps optional fields", () => {
    const m = parseManifest({
      version: "1.2.3",
      pub_date: "2026-01-01T00:00:00Z",
      notes: "Fixes",
      platforms: { "darwin-aarch64": { ...entry, extra: true } },
    });
    expect(m.version).toBe("1.2.3");
    expect(m.pub_date).toBe("2026-01-01T00:00:00Z");
    expect(m.notes).toBe("Fixes");
    expect({ ...m.platforms }).toEqual({ "darwin-aarch64": entry });
  });

  it("omits optional fields of the wrong type", () => {
    const m = parseManifest({ version: "1.0.0", pub_date: 5, notes: null, platforms: {} });
    expect(m).not.toHaveProperty("pub_date");
    expect(m).not.toHaveProperty("notes");
  });

  it("rejects non-objects", () => {
    expect(() => parseManifest(null)).toThrow(/expected an object/);
    expect(() => parseManifest("x")).toThrow(/expected an object/);
  });

  it("rejects a missing or empty version", () => {
    expect(() => parseManifest({ platforms: {} })).toThrow(/missing version/);
    expect(() => parseManifest({ version: "", platforms: {} })).toThrow(/missing version/);
  });

  it("rejects missing platforms", () => {
    expect(() => parseManifest({ version: "1.0.0" })).toThrow(/missing platforms/);
    expect(() => parseManifest({ version: "1.0.0", platforms: null })).toThrow(
      /missing platforms/,
    );
  });

  it("rejects a malformed platform entry", () => {
    expect(() =>
      parseManifest({ version: "1.0.0", platforms: { linux: { url: "u" } } }),
    ).toThrow(/malformed platform "linux"/);
    expect(() => parseManifest({ version: "1.0.0", platforms: { linux: null } })).toThrow();
  });

  it("stores a __proto__ key as a platform, not a prototype", () => {
    const raw = JSON.parse(`{"version":"1.0.0","platforms":{"__proto__":${JSON.stringify(entry)}}}`);
    const m = parseManifest(raw);
    expect(Object.getPrototypeOf(m.platforms)).toBeNull();
    expect(Object.keys(m.platforms)).toEqual(["__proto__"]);
  });
});

describe("isNewerVersion", () => {
  it.each([
    ["1.0.1", "1.0.0", true],
    ["1.0.0", "1.0.0", false],
    ["0.9.9", "1.0.0", false],
    ["v2.0.0", "1.9.9", true],
    ["1.2", "1.1.9", true],
    ["1.0.0-beta.1", "1.0.0", false],
    ["1.0.0.1", "1.0.0", true],
    ["1.x.0", "1.0.0", false],
  ])("%s newer than %s -> %s", (a, b, expected) => {
    expect(isNewerVersion(a, b)).toBe(expected);
  });
});

describe("decideUpdateAction", () => {
  it("downloads only when the manifest is newer", () => {
    const manifest = { version: "2.0.0", platforms: {} };
    expect(decideUpdateAction(manifest, "1.0.0")).toEqual({ kind: "download" });
    expect(decideUpdateAction(manifest, "2.0.0")).toEqual({ kind: "none" });
  });
});
