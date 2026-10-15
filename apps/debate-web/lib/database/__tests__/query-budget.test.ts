import { describe, expect, it } from "vitest";
import {
  DEFAULT_STATEMENTS_PER_BATCH,
  D1_MAX_QUERIES_PER_INVOCATION,
  chunkStatements,
} from "../query-budget";

describe("chunkStatements", () => {
  it("issues no batch at all for an empty run", () => {
    // `db.batch([])` is not a valid call, so a caller looping over the result
    // of an empty run has to end up sending nothing.
    expect(chunkStatements([])).toEqual([]);
  });

  it("keeps a short run in a single batch", () => {
    expect(chunkStatements(["a", "b", "c"])).toEqual([["a", "b", "c"]]);
  });

  it("splits a long run at the batch size, preserving order", () => {
    const statements = Array.from({ length: 250 }, (_, index) => index);
    const batches = chunkStatements(statements);

    expect(batches.map((batch) => batch.length)).toEqual([100, 100, 50]);
    expect(batches.flat()).toEqual(statements);
  });

  it("honours a caller's own batch size, and never produces an empty batch", () => {
    expect(chunkStatements([1, 2, 3], 2)).toEqual([[1, 2], [3]]);
    expect(chunkStatements([1, 2, 3], 0)).toEqual([[1], [2], [3]]);
  });

  it("turns a queue far past D1's per-invocation ceiling into a handful of queries", () => {
    // The regression this exists for: a publish queue of 5,000 rounds used to
    // cost one D1 query per round, an order of magnitude past what a Worker
    // invocation is allowed to spend.
    const statements = Array.from({ length: 5000 }, (_, index) => index);

    expect(statements.length).toBeGreaterThan(D1_MAX_QUERIES_PER_INVOCATION);
    expect(chunkStatements(statements).length).toBe(5000 / DEFAULT_STATEMENTS_PER_BATCH);
  });
});
