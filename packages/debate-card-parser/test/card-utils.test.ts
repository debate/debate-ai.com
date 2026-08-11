import { describe, expect, it } from "vitest";
import {
  extractAuthor,
  extractYear,
  getBlueShade,
  getGreenShade,
  getYearShade,
  htmlToText,
} from "../src/utils/card-utils";

describe("extractAuthor", () => {
  it("drops a trailing four-digit year", () => {
    expect(extractAuthor("Mearsheimer 2023")).toBe("Mearsheimer");
  });

  it("keeps the label untouched when there is no trailing year", () => {
    expect(extractAuthor("Mearsheimer")).toBe("Mearsheimer");
  });

  it("only strips the year at the end of the label", () => {
    expect(extractAuthor("Report 2020 Update")).toBe("Report 2020 Update");
  });
});

describe("extractYear", () => {
  it("returns the first four-digit year in the citation", () => {
    expect(extractYear("Mearsheimer 2023")).toBe("2023");
  });

  it("returns an empty string when no year is present", () => {
    expect(extractYear("Mearsheimer")).toBe("");
  });
});

describe("getYearShade", () => {
  it("gets darker as the two-digit year gets more recent", () => {
    expect(getYearShade("25")).toBe("bg-yellow-500 text-yellow-950");
    expect(getYearShade("23")).toBe("bg-yellow-400 text-yellow-900");
    expect(getYearShade("20")).toBe("bg-yellow-100 text-yellow-600");
  });

  it("falls back to the lightest shade for old or unparsable years", () => {
    expect(getYearShade("14")).toBe("bg-yellow-50 text-yellow-500");
    expect(getYearShade("")).toBe("bg-yellow-50 text-yellow-500");
  });
});

describe("count-based badge shades", () => {
  it("scales the blue shade with the read count", () => {
    expect(getBlueShade(1000)).toContain("bg-blue-600");
    expect(getBlueShade(500)).toContain("bg-blue-500");
    expect(getBlueShade(0)).toContain("bg-blue-100");
  });

  it("scales the green shade with the word count", () => {
    expect(getGreenShade(2500)).toContain("bg-green-600");
    expect(getGreenShade(1000)).toContain("bg-green-300");
    expect(getGreenShade(10)).toContain("bg-green-100");
  });
});

describe("htmlToText", () => {
  it("unwraps highlight and underline markup", () => {
    expect(htmlToText("<mark>war</mark> is <u>bad</u>")).toBe("war is bad");
  });

  it("strips remaining tags and decodes common entities", () => {
    expect(htmlToText("<p>A&nbsp;&amp;&nbsp;B</p>")).toBe("A & B");
    expect(htmlToText("<div>&lt;tag&gt;</div>")).toBe("<tag>");
  });

  it("trims surrounding whitespace", () => {
    expect(htmlToText("  <span> spaced </span>  ")).toBe("spaced");
  });
});
