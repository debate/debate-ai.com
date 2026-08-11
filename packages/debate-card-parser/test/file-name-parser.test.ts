import { describe, expect, it } from "vitest";
import { parseFileNameParts } from "../src/extractors/file-name-parser";

describe("parseFileNameParts", () => {
  it("splits category, topic, organization and year", () => {
    expect(
      parseFileNameParts("Aff - China Relations - Michigan 2024.docx"),
    ).toEqual({
      category: "Aff",
      topic: "China Relations",
      organization: "Michigan",
      year: 2024,
    });
  });

  it("ignores directories in front of the file name", () => {
    expect(
      parseFileNameParts("/camp/files/Neg - Arctic - GDI 2019.docx").organization,
    ).toBe("GDI");
  });

  it("joins multi-segment topics back together", () => {
    expect(
      parseFileNameParts("Neg - Space - Arms Race - Wake 2023.docx").topic,
    ).toBe("Space - Arms Race");
  });

  it("returns a null year when the name has no trailing year", () => {
    expect(parseFileNameParts("Aff - Topic - Michigan.docx")).toEqual({
      category: "Aff",
      topic: "Topic",
      organization: "Michigan",
      year: null,
    });
  });

  it("normalizes an empty name to all nulls", () => {
    expect(parseFileNameParts("")).toEqual({
      category: null,
      topic: null,
      organization: null,
      year: null,
    });
  });
});
