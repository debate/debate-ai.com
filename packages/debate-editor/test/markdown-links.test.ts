import { describe, expect, it } from "vitest";
import {
  getHashTargetId,
  isHashLink,
  isInternalUrl,
} from "../src/markdown/markdown-links";

describe("isInternalUrl", () => {
  it("treats absolute app paths and hashes as internal", () => {
    expect(isInternalUrl("/videos")).toBe(true);
    expect(isInternalUrl("#warrants")).toBe(true);
  });

  it("treats anything with a protocol as external", () => {
    expect(isInternalUrl("https://example.com")).toBe(false);
    expect(isInternalUrl("http://example.com")).toBe(false);
    expect(isInternalUrl("mailto:coach@example.com")).toBe(false);
    expect(isInternalUrl("tel://5551234")).toBe(false);
  });

  it("treats relative paths as not internal", () => {
    expect(isInternalUrl("videos/1")).toBe(false);
    expect(isInternalUrl("./notes")).toBe(false);
  });

  it("handles a missing href", () => {
    expect(isInternalUrl(undefined)).toBe(false);
    expect(isInternalUrl("")).toBe(false);
  });
});

describe("isHashLink", () => {
  it("is true only for same-page anchors", () => {
    expect(isHashLink("#top")).toBe(true);
    expect(isHashLink("/top")).toBe(false);
    expect(isHashLink(undefined)).toBe(false);
  });
});

describe("getHashTargetId", () => {
  it("returns the element id a hash link points at", () => {
    expect(getHashTargetId("#impact-calc")).toBe("impact-calc");
  });

  it("returns null for non-hash links and bare hashes", () => {
    expect(getHashTargetId("/impact-calc")).toBeNull();
    expect(getHashTargetId("#")).toBeNull();
    expect(getHashTargetId(undefined)).toBeNull();
  });
});
