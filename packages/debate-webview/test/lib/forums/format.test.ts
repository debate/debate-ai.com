/**
 * @fileoverview The forum's presentation helpers, and the unit boundary they
 * exist to hold.
 *
 * The API sends Unix seconds; `debate-comments` formats milliseconds. Taking a
 * seconds value into a millisecond formatter renders "in 1970" without an
 * error, so these are asserted against a known instant rather than a wall
 * clock.
 */

import { describe, expect, it } from "vitest";

import {
  formatAbsoluteTime,
  formatRelativeTime,
  getInitials,
  replyCountLabel,
} from "../../../src/lib/forums/format";

/** 2023-11-14T22:13:20Z, in the units the forum API sends. */
const CREATED = 1_700_000_000;
const CREATED_MS = CREATED * 1000;

describe("formatRelativeTime", () => {
  it("reads seconds, not milliseconds", () => {
    // A seconds value handed to a millisecond formatter is the bug this module
    // exists to prevent: 1,700,000,000 ms is 1970, and the row says so.
    expect(formatRelativeTime(CREATED, CREATED_MS + 5 * 60 * 1000)).toBe("5m ago");
  });

  it("rounds to the unit it is in", () => {
    expect(formatRelativeTime(CREATED, CREATED_MS + 30 * 1000)).toBe("just now");
    expect(formatRelativeTime(CREATED, CREATED_MS + 3 * 3600 * 1000)).toBe("3h ago");
    expect(formatRelativeTime(CREATED, CREATED_MS + 6 * 86400 * 1000)).toBe("6d ago");
  });

  it("falls back to an absolute date past a week", () => {
    const old = formatRelativeTime(CREATED, CREATED_MS + 30 * 86400 * 1000);
    expect(old).not.toMatch(/ago$/);
    expect(old.length).toBeGreaterThan(0);
  });

  it("does not answer a clock skewed into the future with a negative age", () => {
    expect(formatRelativeTime(CREATED, CREATED_MS - 60_000)).toBe("just now");
  });
});

describe("formatAbsoluteTime", () => {
  it("renders a real date rather than 1970", () => {
    expect(formatAbsoluteTime(CREATED)).toBe(new Date(CREATED_MS).toLocaleString());
  });
});

describe("getInitials", () => {
  it("takes at most two initials", () => {
    expect(getInitials("Ada Lovelace")).toBe("AL");
    expect(getInitials("Grace Brewster Murray Hopper")).toBe("GB");
  });

  it("never renders a blank circle", () => {
    expect(getInitials("   ")).toBe("?");
  });
});

describe("replyCountLabel", () => {
  it("says so when there is nothing to read", () => {
    expect(replyCountLabel(0)).toBe("No replies yet");
  });

  it("agrees with itself about the singular", () => {
    expect(replyCountLabel(1)).toBe("1 reply");
    expect(replyCountLabel(2)).toBe("2 replies");
  });
});
