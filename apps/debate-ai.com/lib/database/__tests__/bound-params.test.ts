/**
 * @fileoverview Pins the chunking of `IN (...)` lists against D1's
 * 100-bound-parameter statement ceiling. The ceiling is invisible in
 * development — local SQLite allows tens of thousands — so it has to be
 * asserted here rather than discovered by a production 500.
 */
import { describe, expect, it } from "vitest";
import { chunkBoundParams, D1_MAX_BOUND_PARAMS } from "../bound-params";

const ids = (count: number) => Array.from({ length: count }, (_, index) => `id-${index}`);

describe("chunkBoundParams", () => {
  it("issues no statement at all for an empty list", () => {
    expect(chunkBoundParams([])).toEqual([]);
  });

  it("leaves a list that already fits in one statement", () => {
    expect(chunkBoundParams(ids(100))).toEqual([ids(100)]);
  });

  it("splits at the limit, not one past it", () => {
    const chunks = chunkBoundParams(ids(101));
    expect(chunks.map((chunk) => chunk.length)).toEqual([100, 1]);
  });

  it("gives back the reserved parameters the rest of the WHERE clause binds", () => {
    // One reserved parameter (e.g. `eq(videos.adminEdited, true)`) leaves 99
    // for the list, so the whole statement still binds exactly 100.
    const chunks = chunkBoundParams(ids(200), 1);
    expect(chunks.map((chunk) => chunk.length)).toEqual([99, 99, 2]);
    for (const chunk of chunks) {
      expect(chunk.length + 1).toBeLessThanOrEqual(D1_MAX_BOUND_PARAMS);
    }
  });

  it("preserves order and loses nothing across the split", () => {
    expect(chunkBoundParams(ids(250), 1).flat()).toEqual(ids(250));
  });

  it("still makes progress when the reserved count would leave no room", () => {
    // A degenerate call must not produce zero-length chunks and loop forever.
    expect(chunkBoundParams(ids(3), D1_MAX_BOUND_PARAMS + 5)).toEqual([["id-0"], ["id-1"], ["id-2"]]);
  });
});
