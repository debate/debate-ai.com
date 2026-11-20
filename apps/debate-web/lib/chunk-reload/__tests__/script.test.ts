import { describe, expect, it } from "vitest";

import {
  RELOAD_COOLDOWN_MS,
  chunkReloadScript,
  isChunkLoadFailure,
  mayReload,
} from "../script";

describe("isChunkLoadFailure", () => {
  it("recognises each browser's failed-import message", () => {
    expect(isChunkLoadFailure("Failed to fetch dynamically imported module: https://d.ebate.app/_next/static/chunks/a.js")).toBe(true);
    expect(isChunkLoadFailure("Importing a module script failed.")).toBe(true);
    expect(isChunkLoadFailure("error loading dynamically imported module")).toBe(true);
    expect(isChunkLoadFailure("'text/html' is not a valid JavaScript MIME type.")).toBe(true);
    expect(isChunkLoadFailure("ChunkLoadError")).toBe(true);
  });

  it("ignores other errors", () => {
    expect(isChunkLoadFailure("Cannot read properties of undefined")).toBe(false);
    expect(isChunkLoadFailure(undefined)).toBe(false);
  });
});

describe("mayReload", () => {
  it("allows the first reload and one after the cooldown", () => {
    expect(mayReload(null, 1_000)).toBe(true);
    expect(mayReload("1000", 1_000 + RELOAD_COOLDOWN_MS + 1)).toBe(true);
  });

  it("blocks a second reload inside the cooldown", () => {
    expect(mayReload("1000", 1_000 + RELOAD_COOLDOWN_MS - 1)).toBe(false);
  });
});

describe("chunkReloadScript", () => {
  it("is a self-contained script that parses", () => {
    const source = chunkReloadScript();
    expect(() => new Function(source)).not.toThrow();
    expect(source).toContain("vite:preloadError");
    expect(source).toContain("/_next/static/");
  });

  it("reloads once on a failed chunk and then waits out the cooldown", () => {
    const listeners: Record<string, (event: unknown) => void> = {};
    const store = new Map<string, string>();
    let reloads = 0;
    const window = { addEventListener: (type: string, fn: (event: unknown) => void) => { listeners[type] = fn; } };
    const sessionStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v) };
    const location = { reload: () => { reloads++; } };
    new Function("window", "sessionStorage", "location", chunkReloadScript())(window, sessionStorage, location);

    let prevented = false;
    listeners["vite:preloadError"]({ preventDefault: () => { prevented = true; } });
    expect(reloads).toBe(1);
    expect(prevented).toBe(true);

    listeners.error({ target: { tagName: "SCRIPT", src: "https://d.ebate.app/_next/static/chunks/x.js" } });
    listeners.unhandledrejection({ reason: new TypeError("Importing a module script failed.") });
    expect(reloads).toBe(1);
  });

  it("ignores unrelated errors", () => {
    const listeners: Record<string, (event: unknown) => void> = {};
    let reloads = 0;
    const window = { addEventListener: (type: string, fn: (event: unknown) => void) => { listeners[type] = fn; } };
    const sessionStorage = { getItem: () => null, setItem: () => undefined };
    new Function("window", "sessionStorage", "location", chunkReloadScript())(window, sessionStorage, { reload: () => { reloads++; } });
    listeners.error({ target: { tagName: "IMG", src: "https://d.ebate.app/x.png" } });
    listeners.unhandledrejection({ reason: new Error("boom") });
    expect(reloads).toBe(0);
  });
});
