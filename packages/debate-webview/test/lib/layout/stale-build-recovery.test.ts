/**
 * The loop guard is the whole point of this helper: `global-error.tsx` reloads
 * on ANY root-layout failure (a stale build's null imports have no message
 * worth matching on), so the only thing standing between a genuinely broken
 * deploy and an infinite reload is the cooldown asserted here.
 */

import { describe, expect, it } from "vitest";
import {
  isChunkLoadError,
  recoverFromChunkLoadError,
  reloadForStaleBuild,
  shouldReloadForStaleBuild,
  STALE_BUILD_RELOAD_KEY,
  STALE_BUILD_RELOAD_COOLDOWN_MS,
} from "../../../src/lib/layout/stale-build-recovery";

function memoryStore(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
}

describe("shouldReloadForStaleBuild", () => {
  it("recovers on the first root-layout failure in a tab", () => {
    const store = memoryStore();
    expect(shouldReloadForStaleBuild(store, 1_000)).toBe(true);
    expect(store.data.get(STALE_BUILD_RELOAD_KEY)).toBe("1000");
  });

  it("does not reload again when the failure comes straight back", () => {
    // The broken-for-everyone case: reloading landed on the same dead build,
    // so the second failure must fall through to the error UI.
    const store = memoryStore();
    expect(shouldReloadForStaleBuild(store, 1_000)).toBe(true);
    expect(shouldReloadForStaleBuild(store, 1_500)).toBe(false);
  });

  it("allows a fresh attempt once the cooldown has passed", () => {
    // A long-lived tab that survives two separate deploys recovers from both.
    const store = memoryStore();
    expect(shouldReloadForStaleBuild(store, 1_000)).toBe(true);
    expect(shouldReloadForStaleBuild(store, 1_000 + STALE_BUILD_RELOAD_COOLDOWN_MS)).toBe(true);
  });

  it("holds the line right up to the cooldown boundary", () => {
    const store = memoryStore();
    expect(shouldReloadForStaleBuild(store, 1_000)).toBe(true);
    expect(shouldReloadForStaleBuild(store, 1_000 + STALE_BUILD_RELOAD_COOLDOWN_MS - 1)).toBe(false);
  });

  it("ignores a marker that is not a usable timestamp", () => {
    // A stuck marker must not disable recovery permanently.
    for (const junk of ["", "not-a-number", "NaN"]) {
      expect(shouldReloadForStaleBuild(memoryStore({ [STALE_BUILD_RELOAD_KEY]: junk }), 1_000)).toBe(true);
    }
  });

  it("ignores a future-dated marker", () => {
    // Left by a clock change; trusting it would suppress recovery for as long
    // as the skew lasts.
    const store = memoryStore({ [STALE_BUILD_RELOAD_KEY]: String(9_000) });
    expect(shouldReloadForStaleBuild(store, 1_000)).toBe(true);
  });

  it("declines when storage is unavailable", () => {
    expect(shouldReloadForStaleBuild(undefined)).toBe(false);
  });

  it("declines when reading storage throws", () => {
    const store = {
      getItem: () => {
        throw new DOMException("denied", "SecurityError");
      },
      setItem: () => {},
    };
    expect(shouldReloadForStaleBuild(store, 1_000)).toBe(false);
  });

  it("declines when the attempt cannot be recorded", () => {
    // Writing is what makes the guard work, so a store that reads but cannot
    // write must not get a reload it would repeat forever.
    const store = {
      getItem: () => null,
      setItem: () => {
        throw new DOMException("quota", "QuotaExceededError");
      },
    };
    expect(shouldReloadForStaleBuild(store, 1_000)).toBe(false);
  });
});

describe("isChunkLoadError", () => {
  it("recognises each browser's failed dynamic import", () => {
    expect(
      isChunkLoadError(
        new TypeError("Failed to fetch dynamically imported module: https://d.ebate.app/_next/static/chunks/DYe7ka8a.js"),
      ),
    ).toBe(true);
    expect(isChunkLoadError(new TypeError("Importing a module script failed."))).toBe(true);
    expect(isChunkLoadError(new TypeError("error loading dynamically imported module: /a.js"))).toBe(true);
    expect(isChunkLoadError(new TypeError("'text/html' is not a valid JavaScript MIME type."))).toBe(true);
    expect(isChunkLoadError(Object.assign(new Error("boom"), { name: "ChunkLoadError" }))).toBe(true);
    expect(isChunkLoadError(new Error("Loading CSS chunk 42 failed."))).toBe(true);
    expect(isChunkLoadError(new Error("Unable to preload CSS for /assets/a.css"))).toBe(true);
    expect(isChunkLoadError("Failed to fetch dynamically imported module")).toBe(true);
  });

  it("ignores ordinary component bugs", () => {
    expect(isChunkLoadError(new TypeError("Cannot read properties of null (reading 'useRef')"))).toBe(false);
    expect(isChunkLoadError(null)).toBe(false);
    expect(isChunkLoadError(42)).toBe(false);
  });
});

describe("recoverFromChunkLoadError", () => {
  const chunkError = new TypeError("Failed to fetch dynamically imported module: /_next/static/chunks/x.js");

  it("reloads once for a chunk failure, then lets the error UI show", () => {
    const store = memoryStore();
    let reloads = 0;
    const reload = () => void reloads++;
    expect(recoverFromChunkLoadError(chunkError, store, reload)).toBe(true);
    expect(recoverFromChunkLoadError(chunkError, store, reload)).toBe(false);
    expect(reloads).toBe(1);
  });

  it("never reloads for a non-chunk error", () => {
    const store = memoryStore();
    let reloads = 0;
    expect(recoverFromChunkLoadError(new Error("bug"), store, () => void reloads++)).toBe(false);
    expect(reloads).toBe(0);
    expect(store.data.size).toBe(0);
  });

  it("does not reload when storage is unavailable", () => {
    let reloads = 0;
    expect(reloadForStaleBuild(undefined, () => void reloads++)).toBe(false);
    expect(reloads).toBe(0);
  });
});
