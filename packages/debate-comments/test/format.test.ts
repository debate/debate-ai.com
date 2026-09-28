/**
 * @fileoverview The presentation strings: relative timestamps, avatar
 * initials, and the reply-toggle label.
 *
 * `formatRelativeTime` takes `now` as an argument rather than reading the clock
 * so its boundaries can be tested — and so a comment rendered on the server
 * and re-rendered by hydration can be handed the same instant instead of
 * disagreeing with itself at a boundary (the classic "61 seconds ago" vs
 * "just now" hydration mismatch).
 */

import { describe, it, expect } from "vitest";

import { formatAbsoluteTime, formatRelativeTime, getInitials, replyToggleLabel } from "../src/format";
import { MAX_COMMENT_BODY_LENGTH, isCommentResourceType } from "../src/types";

const NOW = 1_700_000_000_000;

describe("formatRelativeTime", () => {
  const at = (secondsAgo: number) => NOW - secondsAgo * 1000;

  it("says just now for the first minute", () => {
    expect(formatRelativeTime(at(0), NOW)).toBe("just now");
    expect(formatRelativeTime(at(59), NOW)).toBe("just now");
  });

  it("counts minutes up to the hour", () => {
    expect(formatRelativeTime(at(60), NOW)).toBe("1m ago");
    expect(formatRelativeTime(at(59 * 60), NOW)).toBe("59m ago");
  });

  it("counts hours up to the day", () => {
    expect(formatRelativeTime(at(60 * 60), NOW)).toBe("1h ago");
    expect(formatRelativeTime(at(23 * 60 * 60), NOW)).toBe("23h ago");
  });

  it("counts days up to the week", () => {
    expect(formatRelativeTime(at(24 * 60 * 60), NOW)).toBe("1d ago");
    expect(formatRelativeTime(at(6 * 24 * 60 * 60), NOW)).toBe("6d ago");
  });

  it("falls back to a date past the week", () => {
    const old = Date.UTC(2024, 0, 2, 12);
    expect(formatRelativeTime(old, Date.UTC(2026, 8, 26, 12))).toMatch(/Jan\s+2,?\s+2024/);
  });

  it("does not report a future timestamp as negative time", () => {
    // Clock skew between the writer and the reader should not produce "-3m ago".
    expect(formatRelativeTime(NOW + 180_000, NOW)).toBe("just now");
  });
});

describe("formatAbsoluteTime", () => {
  it("returns a string a title attribute can hold", () => {
    expect(typeof formatAbsoluteTime(NOW)).toBe("string");
    expect(formatAbsoluteTime(NOW).length).toBeGreaterThan(0);
  });
});

describe("getInitials", () => {
  it("takes the first letter of the first two words", () => {
    expect(getInitials("Alex Rivera")).toBe("AR");
  });

  it("takes one letter from a single name", () => {
    expect(getInitials("Prince")).toBe("P");
  });

  it("uppercases and ignores extra whitespace", () => {
    expect(getInitials("  jean   luc  ")).toBe("JL");
  });

  it("falls back to a question mark rather than a blank avatar", () => {
    expect(getInitials("")).toBe("?");
    expect(getInitials("   ")).toBe("?");
  });
});

describe("replyToggleLabel", () => {
  it("counts replies while collapsed", () => {
    expect(replyToggleLabel(1, false)).toBe("1 reply");
    expect(replyToggleLabel(3, false)).toBe("3 replies");
  });

  it("offers to hide them while expanded, whatever the count", () => {
    expect(replyToggleLabel(1, true)).toBe("Hide replies");
    expect(replyToggleLabel(12, true)).toBe("Hide replies");
  });
});

describe("isCommentResourceType", () => {
  it("accepts the kinds the app comments on", () => {
    expect(isCommentResourceType("video")).toBe(true);
    expect(isCommentResourceType("lecture")).toBe(true);
  });

  it("rejects anything else, including near misses", () => {
    expect(isCommentResourceType("videos")).toBe(false);
    expect(isCommentResourceType(null)).toBe(false);
    expect(isCommentResourceType(7)).toBe(false);
  });
});

describe("MAX_COMMENT_BODY_LENGTH", () => {
  it("is a limit a form can enforce and a server can enforce the same", () => {
    // The composer and the API both read this one number; a second copy of it
    // is the drift this constant exists to prevent.
    expect(MAX_COMMENT_BODY_LENGTH).toBe(5000);
  });
});
