/**
 * @fileoverview Covers the mapping from a Parquet corpus card to the reuse
 * index entry that makes its source page read as already cut, and the
 * details and annotation the reuse check returns for it.
 */

import { describe, expect, it } from "vitest";

import {
  buildCardReuseAnnotationContent,
  parseCardReuseAnnotation,
} from "../src/lib/card-reuse-annotation";
import {
  buildParquetCardReuseEntry,
  buildReuseCardDetails,
  parquetCardReuseId,
  parseParquetCardReuseId,
} from "../src/lib/parquet-card-reuse";

const card = {
  id: 42,
  tag: "Automation displaces workers",
  cite: "Smith 23",
  fullcite: "Smith 23 [Jane Smith, Professor of Economics at MIT, https://www.Example.com/story/?utm=x]",
  markup: "<p><mark>Automation will displace</mark> millions <mark>by 2030</mark></p>",
  spoken: "",
  fulltext: "Automation will displace millions by 2030",
  caselistDisplayName: "NDT/CEDA 2023-24",
  event: "cx",
  level: "college",
  side: "A",
  duplicateCount: 3,
};

describe("buildParquetCardReuseEntry", () => {
  it("registers the cite's URL under a card: id, normalized for the reuse lookup", () => {
    expect(buildParquetCardReuseEntry(card)).toEqual({
      id: "card:42",
      sourceUrl: "https://www.Example.com/story/?utm=x",
      normalizedUrl: "example.com/story",
      cite: "Smith 23",
      argBlock: "Automation displaces workers",
      topic: "NDT/CEDA 2023-24",
      contributorId: "",
    });
  });

  it("skips a card whose citation names no URL", () => {
    expect(buildParquetCardReuseEntry({ ...card, fullcite: "Smith 23, MIT, 2023" })).toBeNull();
  });
});

describe("reuse ids", () => {
  it("round-trips a card id and rejects ids that are not corpus cards", () => {
    expect(parseParquetCardReuseId(parquetCardReuseId(7))).toBe(7);
    expect(parseParquetCardReuseId("entry-abc")).toBeNull();
    expect(parseParquetCardReuseId("card:0")).toBeNull();
    expect(parseParquetCardReuseId("card:x")).toBeNull();
  });
});

describe("buildReuseCardDetails", () => {
  it("returns parsed author, year and quotes with the card's labels", () => {
    expect(buildReuseCardDetails(card)).toMatchObject({
      cardId: 42,
      author: "Smith",
      year: 2023,
      quotes: ["Automation will displace", "by 2030"],
      caselist: "NDT/CEDA 2023-24",
      duplicateCount: 3,
    });
  });
});

describe("buildCardReuseAnnotationContent", () => {
  it("puts tag, citation and highlighting ahead of the card text", () => {
    const content = buildCardReuseAnnotationContent(card);
    expect(content.indexOf("Tag:")).toBeLessThan(content.indexOf("Citation:"));
    expect(content).toContain("Highlighted (read aloud):\nAutomation will displace … by 2030");
    expect(content).toContain("Full card text:\nAutomation will displace millions by 2030");
  });
});

describe("parseCardReuseAnnotation", () => {
  const valid = {
    claim: "Automation will displace millions of workers by 2030.",
    supportScore: 6,
    authorQuality: { rating: "strong", qualifications: "MIT economist", concerns: "" },
    flaws: [{ flaw: "Overclaims", severity: "high", explanation: "Tag says workers; card says jobs." }],
  };

  it("parses a valid JSON answer", () => {
    expect(parseCardReuseAnnotation(JSON.stringify(valid))).toEqual(valid);
  });

  it("clamps the score and repairs unknown enum values", () => {
    const parsed = parseCardReuseAnnotation({
      ...valid,
      supportScore: 14,
      authorQuality: { rating: "excellent" },
      flaws: [{ flaw: "Dated", severity: "critical" }, { severity: "low" }],
    });
    expect(parsed).toMatchObject({
      supportScore: 10,
      authorQuality: { rating: "unknown", qualifications: "", concerns: "" },
      flaws: [{ flaw: "Dated", severity: "medium", explanation: "" }],
    });
  });

  it("rejects text that is not an annotation", () => {
    expect(parseCardReuseAnnotation("## Claim\nMarkdown")).toBeNull();
    expect(parseCardReuseAnnotation({ supportScore: 5 })).toBeNull();
  });
});
