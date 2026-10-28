import { describe, expect, it } from "vitest";
import {
  MAX_ARGUMENT_TAGS,
  MAX_ARGUMENT_TAG_LENGTH,
  parseArgumentTags,
} from "../src/round/argument-tags";

describe("parseArgumentTags", () => {
  it("splits on commas and newlines, trimming and lowercasing", () => {
    expect(parseArgumentTags(" Kritik,Topicality\n  Case ")).toEqual(["kritik", "topicality", "case"]);
  });

  it("drops blanks and duplicates", () => {
    expect(parseArgumentTags("kritik, ,Kritik,,")).toEqual(["kritik"]);
    expect(parseArgumentTags("")).toEqual([]);
  });

  it("caps the tag count and each tag's length", () => {
    const many = Array.from({ length: 15 }, (_, i) => `t${i}`).join(",");
    expect(parseArgumentTags(many)).toHaveLength(MAX_ARGUMENT_TAGS);
    expect(parseArgumentTags("x".repeat(100))[0]).toHaveLength(MAX_ARGUMENT_TAG_LENGTH);
  });
});
