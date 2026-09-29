/**
 * @fileoverview The comment API's request validation.
 *
 * These are the checks standing between a request body and a query, so the
 * cases worth pinning down are the ones a client gets wrong on purpose or by
 * accident: an empty body, a body that is nothing but whitespace, a
 * `parentId` that is not an id at all, and a `resourceId` long enough to be an
 * attempt to put a payload in the index.
 */

import { describe, it, expect } from "vitest";

import {
  isCommentId,
  parseCommentBody,
  parseParentId,
  parseResourceId,
  parseResourceType,
  MAX_COMMENT_BODY_LENGTH,
  MAX_RESOURCE_ID_LENGTH,
} from "../../../src/lib/comments/validation";

describe("parseResourceType", () => {
  it("accepts a type the UI can ask for", () => {
    expect(parseResourceType("video")).toEqual({ ok: true, value: "video" });
    expect(parseResourceType("lecture")).toEqual({ ok: true, value: "lecture" });
  });

  it("refuses an unknown type instead of storing a comment against it", () => {
    // A comment on a resource nothing reads is a comment nobody sees, and a
    // `resourceType` that is a free-text string is a way to write to a table
    // nobody is reading on purpose.
    const result = parseResourceType("../user");
    expect(result.ok).toBe(false);
  });

  it("refuses a missing type", () => {
    expect(parseResourceType(null).ok).toBe(false);
    expect(parseResourceType(undefined).ok).toBe(false);
  });
});

describe("parseResourceId", () => {
  it("accepts a trimmed id", () => {
    expect(parseResourceId("  dQw4w9WgXcQ ")).toEqual({ ok: true, value: "dQw4w9WgXcQ" });
  });

  it("refuses an empty or whitespace-only id", () => {
    expect(parseResourceId("").ok).toBe(false);
    expect(parseResourceId("   ").ok).toBe(false);
  });

  it("refuses an id past the length cap", () => {
    expect(parseResourceId("x".repeat(MAX_RESOURCE_ID_LENGTH)).ok).toBe(true);
    expect(parseResourceId("x".repeat(MAX_RESOURCE_ID_LENGTH + 1)).ok).toBe(false);
  });

  it("refuses a non-string", () => {
    expect(parseResourceId(42).ok).toBe(false);
    expect(parseResourceId(["v1"]).ok).toBe(false);
  });
});

describe("parseCommentBody", () => {
  it("trims the body it stores", () => {
    expect(parseCommentBody("  good read  ")).toEqual({ ok: true, value: "good read" });
  });

  it("refuses a body that is only whitespace", () => {
    // 5,000 spaces is not a comment, and it would be stored, shipped to every
    // reader of the thread, and rendered as a blank row.
    expect(parseCommentBody(" ".repeat(MAX_COMMENT_BODY_LENGTH)).ok).toBe(false);
  });

  it("refuses an empty body", () => {
    expect(parseCommentBody("").ok).toBe(false);
    expect(parseCommentBody(null).ok).toBe(false);
  });

  it("refuses a body past the cap, and says what the cap is", () => {
    const result = parseCommentBody("x".repeat(MAX_COMMENT_BODY_LENGTH + 1));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("5,000");
  });

  it("accepts a body exactly at the cap", () => {
    expect(parseCommentBody("x".repeat(MAX_COMMENT_BODY_LENGTH)).ok).toBe(true);
  });
});

describe("parseParentId", () => {
  const UUID = "0f8fad5b-d9cb-469f-a165-70867728950e";

  it("treats an absent, null or empty parent as a top-level comment", () => {
    expect(parseParentId(undefined)).toEqual({ ok: true, value: null });
    expect(parseParentId(null)).toEqual({ ok: true, value: null });
    expect(parseParentId("")).toEqual({ ok: true, value: null });
  });

  it("accepts a UUID", () => {
    expect(parseParentId(UUID)).toEqual({ ok: true, value: UUID });
    expect(isCommentId(UUID)).toBe(true);
  });

  it("refuses a parent id that could never exist, so the query is not spent", () => {
    expect(parseParentId("1 OR 1=1").ok).toBe(false);
    expect(parseParentId("../../secrets").ok).toBe(false);
    expect(parseParentId(123).ok).toBe(false);
  });
});

describe("isCommentId", () => {
  it("is false for anything that is not a UUID", () => {
    expect(isCommentId("")).toBe(false);
    expect(isCommentId(null)).toBe(false);
    expect(isCommentId("0f8fad5b-d9cb-469f-a165-70867728950")).toBe(false); // too short
  });
});
