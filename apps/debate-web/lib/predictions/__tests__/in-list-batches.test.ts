/**
 * @fileoverview D1 refuses a statement with more than 100 bound parameters,
 * so the board's `IN (…)` lookups (a signed-in viewer's bets over 100+
 * markets) bind their ids in batches. A single list of them used to fail the
 * whole board with a 500 for every signed-in viewer.
 */

import { describe, expect, it } from "vitest";
import { inListBatches } from "@/lib/predictions/queries";

describe("inListBatches", () => {
  it("keeps every batch under D1's 100-parameter limit, with room for the query's own", () => {
    const ids = Array.from({ length: 250 }, (_, index) => `market-${index}`);
    const batches = inListBatches(ids);
    expect(batches.every((batch) => batch.length > 0 && batch.length + 10 <= 100)).toBe(true);
    expect(batches.flat()).toEqual(ids);
  });

  it("returns no batches for no ids and one for a short list", () => {
    expect(inListBatches([])).toEqual([]);
    expect(inListBatches(["a", "b"])).toEqual([["a", "b"]]);
  });
});
