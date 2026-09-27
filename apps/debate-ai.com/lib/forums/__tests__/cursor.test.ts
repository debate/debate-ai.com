/**
 * @fileoverview The feed's pagination cursor, round-tripped.
 *
 * The cursor is the pair `(lastActivityAt, id)` — the same order the feed reads
 * in, and the reason it is a cursor rather than a page number (see
 * `lib/forums/queries.ts`). What is worth pinning here is that the encoding
 * survives the trip, that a client cannot hand-craft a walk the feed never
 * promised, and that a corrupt cursor is refused rather than silently read as
 * "start at the top" — which would show the same page twice with no sign that
 * the reader's place was lost.
 */

import { describe, expect, it } from "vitest";

import { decodeCursor, encodeCursor } from "../queries";

const UUID_A = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const UUID_B = "9c858901-8a57-4791-81fe-4c455b099bc9";

describe("encodeCursor / decodeCursor", () => {
  it("round-trips the timestamp and the id", () => {
    const decoded = decodeCursor(encodeCursor(1_700_000_000, UUID_A));
    expect(decoded).toEqual({ ok: true, value: { at: 1_700_000_000, id: UUID_A } });
  });

  it("keeps two threads posted in the same second distinguishable", () => {
    // The tie-break is the whole reason the id is in the cursor: without it a
    // walk would either skip the second row or repeat the first.
    const first = decodeCursor(encodeCursor(1_700_000_000, UUID_A));
    const second = decodeCursor(encodeCursor(1_700_000_000, UUID_B));
    expect(first.ok && second.ok && first.value.id).not.toBe(second.ok && second.value.id);
  });

  it("is url-safe, so it survives being a query parameter", () => {
    // Base64's `+`, `/` and `=` all have to be escaped somewhere; if the route
    // ever has to encode the cursor, a raw `+` becomes a space and the walk
    // starts from the wrong row.
    const cursor = encodeCursor(1_700_000_000, UUID_A);
    expect(cursor).toBe(encodeURIComponent(cursor));
  });

  it("reads an absent cursor as the first page", () => {
    for (const raw of [null, undefined, ""]) {
      expect(decodeCursor(raw)).toEqual({ ok: true, value: null });
    }
  });

  it("refuses a cursor it could not have written", () => {
    for (const raw of ["nonsense", "!!!.!!!", btoa("1700000000.not-a-uuid"), 42, {}]) {
      const decoded = decodeCursor(raw);
      expect(decoded.ok).toBe(false);
      expect(decoded.ok === false && decoded.error).toBe("That is not a page of the forum.");
    }
  });

  it("refuses a timestamp that is not one", () => {
    expect(decodeCursor(btoa("soon.11111111-1111-1111-1111-111111111111")).ok).toBe(false);
  });

  it("refuses a payload with no separator at all", () => {
    expect(decodeCursor(btoa("1700000000")).ok).toBe(false);
  });
});
