/**
 * @fileoverview `parseRoundDecision`: the watch page trusts nothing from
 * `/api/videos/decision` beyond its shape, and anything unusable reads as
 * unknown ("?") rather than throwing.
 */
import { describe, expect, it } from "vitest";
import { UNKNOWN_DECISION, parseRoundDecision } from "../src/lib/round-decision";

describe("parseRoundDecision", () => {
  it("reads garbage as unknown", () => {
    for (const value of [null, undefined, "x", 3, []]) expect(parseRoundDecision(value)).toEqual(UNKNOWN_DECISION);
  });

  it("keeps a known decision with its judges", () => {
    expect(
      parseRoundDecision({
        status: "known",
        source: "tabroom",
        affWin: false,
        decision: " 2-1 ",
        judges: [
          { name: "Ann Lee", side: "neg", squirreled: false },
          { name: "Cy Diaz", side: "sideways", squirreled: 1 },
          { name: "  " },
        ],
        url: "https://www.tabroom.com/x",
      }),
    ).toEqual({
      status: "known",
      source: "tabroom",
      affWin: false,
      decision: "2-1",
      judges: [
        { name: "Ann Lee", side: "neg", squirreled: false },
        { name: "Cy Diaz", side: null, squirreled: false },
      ],
      url: "https://www.tabroom.com/x",
    });
  });

  it("downgrades 'known' with no winner or decision, and drops non-http links", () => {
    const parsed = parseRoundDecision({ status: "known", source: "stored", affWin: null, decision: "", url: "javascript:alert(1)" });
    expect(parsed.status).toBe("unknown");
    expect(parsed.url).toBeNull();
  });
});
