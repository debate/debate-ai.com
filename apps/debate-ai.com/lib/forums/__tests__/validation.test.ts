/**
 * @fileoverview The forum API's input rules — the title and post limits, the
 * feed's page size, and the thread ids.
 *
 * These are the checks that run before any query, so they are also the ones a
 * caller can reach without an account: every case here is a request that costs
 * nothing to make and must not cost a query.
 */

import { describe, expect, it } from "vitest";

import {
  DEFAULT_FEED_LIMIT,
  MAX_FEED_LIMIT,
  MAX_THREAD_BODY_LENGTH,
  MAX_THREAD_TITLE_LENGTH,
  isThreadId,
  parseFeedLimit,
  parseThreadBody,
  parseThreadId,
  parseThreadTitle,
} from "../validation";

const UUID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

describe("parseThreadTitle", () => {
  it("trims the title it accepts", () => {
    const parsed = parseThreadTitle("  Worth a round?  ");
    expect(parsed).toEqual({ ok: true, value: "Worth a round?" });
  });

  it("refuses an absent, empty or whitespace-only title", () => {
    for (const raw of [undefined, null, "", "   \n\t "]) {
      const parsed = parseThreadTitle(raw);
      expect(parsed.ok).toBe(false);
      expect(parsed.ok === false && parsed.error).toBe("A thread needs a title.");
    }
  });

  it("refuses a non-string title rather than coercing it", () => {
    // A number title would otherwise become "42" — a thread named after a
    // number, from a client that meant something else entirely.
    expect(parseThreadTitle(42).ok).toBe(false);
    expect(parseThreadTitle({ title: "x" }).ok).toBe(false);
  });

  it("accepts a title at the limit and refuses one past it", () => {
    const atLimit = "t".repeat(MAX_THREAD_TITLE_LENGTH);
    expect(parseThreadTitle(atLimit)).toEqual({ ok: true, value: atLimit });

    const overLimit = parseThreadTitle("t".repeat(MAX_THREAD_TITLE_LENGTH + 1));
    expect(overLimit.ok).toBe(false);
    expect(overLimit.ok === false && overLimit.error).toContain(
      String(MAX_THREAD_TITLE_LENGTH),
    );
  });

  it("counts the title after trimming, not before", () => {
    // Otherwise padding with spaces is a way around the limit: the stored title
    // is the trimmed one, so the limit has to be checked against it.
    const padded = `${"t".repeat(MAX_THREAD_TITLE_LENGTH)}   `;
    expect(parseThreadTitle(padded).ok).toBe(false);
  });
});

describe("parseThreadBody", () => {
  it("trims the opening post it accepts", () => {
    const parsed = parseThreadBody("\n  Front, please.\n");
    expect(parsed).toEqual({ ok: true, value: "Front, please." });
  });

  it("refuses an absent, empty or whitespace-only post", () => {
    for (const raw of [undefined, null, "", "  "]) {
      const parsed = parseThreadBody(raw);
      expect(parsed.ok).toBe(false);
      expect(parsed.ok === false && parsed.error).toBe("A thread needs an opening post.");
    }
  });

  it("allows a longer post than a comment, and says so at the limit", () => {
    // An opening post is the thing being discussed, not a turn in a discussion
    // that already has one — so it is not held to the comment's 5,000.
    expect(MAX_THREAD_BODY_LENGTH).toBeGreaterThan(5_000);

    const atLimit = "b".repeat(MAX_THREAD_BODY_LENGTH);
    expect(parseThreadBody(atLimit)).toEqual({ ok: true, value: atLimit });

    const overLimit = parseThreadBody("b".repeat(MAX_THREAD_BODY_LENGTH + 1));
    expect(overLimit.ok).toBe(false);
    expect(overLimit.ok === false && overLimit.error).toContain(
      MAX_THREAD_BODY_LENGTH.toLocaleString(),
    );
  });
});

describe("parseThreadId", () => {
  it("accepts a UUID and refuses everything else", () => {
    expect(parseThreadId(UUID)).toEqual({ ok: true, value: UUID });

    for (const raw of ["", "42", "../../etc/passwd", "3f2504e0-4f89-41d3-9a0c", null, 7]) {
      expect(parseThreadId(raw).ok).toBe(false);
    }
  });

  it("agrees with isThreadId", () => {
    expect(isThreadId(UUID)).toBe(true);
    expect(isThreadId(UUID.toUpperCase())).toBe(true);
    expect(isThreadId("nope")).toBe(false);
  });
});

describe("parseFeedLimit", () => {
  it("defaults when the caller names no limit", () => {
    for (const raw of [null, undefined, ""]) {
      expect(parseFeedLimit(raw)).toBe(DEFAULT_FEED_LIMIT);
    }
  });

  it("clamps rather than failing the read", () => {
    // The limit is a hint about how much to send, not a claim about what is
    // being asked for: a feed that 400s on `?limit=abc` teaches a client that
    // the feed is fragile.
    expect(parseFeedLimit("abc")).toBe(DEFAULT_FEED_LIMIT);
    expect(parseFeedLimit("NaN")).toBe(DEFAULT_FEED_LIMIT);
    expect(parseFeedLimit("0")).toBe(1);
    expect(parseFeedLimit("-5")).toBe(1);
    expect(parseFeedLimit("10")).toBe(10);
    expect(parseFeedLimit("9999")).toBe(MAX_FEED_LIMIT);
  });

  it("reads a numeric limit as a number, not as a string", () => {
    expect(parseFeedLimit(10)).toBe(10);
  });
});
