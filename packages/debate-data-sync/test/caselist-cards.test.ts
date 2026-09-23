import { describe, expect, it } from "vitest";
import { caselistCardId, caselistDocumentToCardRows } from "../src/caselist/caselist-cards";
import { caselistFor } from "../src/caselist/caselist-config";

const caselist = caselistFor("hspolicy", 26)!;

const document = {
  path: "Glenbrook North/Chen-Patel/Aff Week 1.docx",
  fileName: "Aff Week 1.docx",
  school: "Glenbrook North",
  team: "Chen-Patel",
  side: "Aff" as const,
  html: "",
  outline: [
    { type: 1 as const, text: "1AC" },
    { type: 2 as const, text: "Advantage" },
    { type: 3 as const, text: "Warming" },
    {
      summary: "Warming causes extinction",
      author: "Blum",
      author_type: null as any,
      cite: "Blum 18",
      year: null as any,
      url: null,
      html: "<p>Warming <mark>is bad</mark> &amp; real</p>",
      marked: "is bad",
    },
    { type: 1 as const, text: "2AC" },
    { summary: "", author: null, author_type: null as any, cite: null, year: null as any, url: null, html: "" },
  ],
};

describe("caselistDocumentToCardRows", () => {
  it("files each card under its headings with caselist labels", () => {
    const rows = caselistDocumentToCardRows(document, caselist);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      tag: "Warming causes extinction",
      cite: "Blum 18",
      spoken: "is bad",
      fulltext: "Warming is bad & real",
      pocket: "1AC",
      hat: "Advantage",
      block: "Warming",
      side: "A",
      caselistDisplayName: "HS Policy 2026-27",
      year: 2026,
      event: "cx",
      level: "hs",
    });
    expect(rows[0].textLength).toBe(rows[0].fulltext.length);
  });

  it("gives the same card the same id on every import", () => {
    const [first] = caselistDocumentToCardRows(document, caselist);
    const [second] = caselistDocumentToCardRows(document, caselist);
    expect(first.id).toBe(second.id);
  });
});

describe("caselistCardId", () => {
  it("stays inside the safe-integer range, above the dump's ids", () => {
    for (const key of ["", "a", "hspolicy26|x.docx|0|tag", "z".repeat(5000)]) {
      const id = caselistCardId(key);
      expect(Number.isSafeInteger(id)).toBe(true);
      expect(id).toBeGreaterThanOrEqual(2 ** 51);
      expect(id).toBeLessThan(2 ** 52);
    }
    expect(caselistCardId("a")).not.toBe(caselistCardId("b"));
  });
});
