import { describe, expect, it } from "vitest";
import { isValidEmailAddress, parseRecipientList } from "../../../src/lib/admin/email-recipients";

describe("parseRecipientList", () => {
  it("splits on commas, semicolons, spaces and new lines", () => {
    expect(parseRecipientList("a@x.com, b@y.org;c@z.edu\nd@w.io  e@v.co").valid).toEqual([
      "a@x.com",
      "b@y.org",
      "c@z.edu",
      "d@w.io",
      "e@v.co",
    ]);
  });

  it("lowercases and drops repeats, counting them", () => {
    const parsed = parseRecipientList("Sam@Example.com\nsam@example.com, SAM@EXAMPLE.COM, jo@example.com");
    expect(parsed.valid).toEqual(["sam@example.com", "jo@example.com"]);
    expect(parsed.duplicates).toBe(2);
    expect(parsed.invalid).toEqual([]);
  });

  it("unwraps Name <address> and mailto: entries", () => {
    expect(parseRecipientList('Alex Smith <alex@example.com>, "Kim, Lee" <kim@example.com>, mailto:j@x.co').valid).toEqual([
      "alex@example.com",
      "kim@example.com",
      "j@x.co",
    ]);
  });

  it("reports entries that are not addresses", () => {
    const parsed = parseRecipientList("good@example.com, nope, @missing.com, two@@x.com, a@nodot");
    expect(parsed.valid).toEqual(["good@example.com"]);
    expect(parsed.invalid).toEqual(["nope", "@missing.com", "two@@x.com", "a@nodot"]);
  });

  it("accepts an array and ignores blank input", () => {
    expect(parseRecipientList(["a@x.com", " ", "b@x.com"]).valid).toEqual(["a@x.com", "b@x.com"]);
    expect(parseRecipientList("  \n , ")).toEqual({ valid: [], invalid: [], duplicates: 0 });
  });
});

describe("isValidEmailAddress", () => {
  it("rejects over-long addresses", () => {
    expect(isValidEmailAddress(`${"a".repeat(250)}@x.com`)).toBe(false);
    expect(isValidEmailAddress("first.last+tag@sub.example.co.uk")).toBe(true);
  });
});
