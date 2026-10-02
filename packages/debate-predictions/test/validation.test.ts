import { describe, expect, it } from "vitest";
import { canResolveMarket, manualOutcomes, parseNewBet, parseNewMarket, parseResolve, readStoredSource } from "../src/validation";
import { describeClose, formatPercent } from "../src/format";

const NOW = 1_800_000_000;
const DAY = 24 * 60 * 60;

describe("parseNewMarket", () => {
  const base = { title: "Who wins the TOC final?", closesAt: NOW + DAY };

  it("accepts a hand-written debate with exactly two sides", () => {
    const parsed = parseNewMarket({ ...base, kind: "debate", outcomes: [" Aff ", "Neg", ""] }, NOW);
    expect(parsed).toMatchObject({ ok: true, value: { kind: "debate", outcomes: ["Aff", "Neg"], tabroomPanelId: null } });
    expect(parseNewMarket({ ...base, kind: "debate", outcomes: ["Aff", "Neg", "Bye"] }, NOW).ok).toBe(false);
  });

  it("accepts a debate tied to a hosted round without outcomes", () => {
    expect(parseNewMarket({ ...base, kind: "debate", tabroomPanelId: 90001 }, NOW)).toMatchObject({
      ok: true,
      value: { tabroomPanelId: 90001, outcomes: [] },
    });
  });

  it("refuses duplicate tournament outcomes, case-insensitively", () => {
    const parsed = parseNewMarket({ ...base, kind: "tournament", outcomes: ["Harvard-Westlake", "harvard-westlake"] }, NOW);
    expect(parsed).toEqual({ ok: false, error: '"harvard-westlake" is listed twice.' });
  });

  it("requires a rankings entry for a rating market", () => {
    expect(parseNewMarket({ ...base, kind: "rating" }, NOW).ok).toBe(false);
    expect(parseNewMarket({ ...base, kind: "rating", rating: { dataset: "hspf", hash: "abcDEF0123456789" } }, NOW)).toMatchObject({
      ok: true,
      value: { rating: { dataset: "hspf", hash: "abcdef0123456789" }, outcomes: [] },
    });
  });

  it("bounds the close time and the title", () => {
    expect(parseNewMarket({ ...base, kind: "debate", outcomes: ["A", "B"], closesAt: NOW + 60 }, NOW).ok).toBe(false);
    expect(parseNewMarket({ ...base, kind: "debate", outcomes: ["A", "B"], closesAt: NOW + 400 * DAY }, NOW).ok).toBe(false);
    expect(parseNewMarket({ ...base, kind: "debate", outcomes: ["A", "B"], title: "x" }, NOW).ok).toBe(false);
    expect(parseNewMarket({ ...base, kind: "poker" }, NOW).ok).toBe(false);
  });
});

describe("parseNewBet", () => {
  const outcomes = manualOutcomes(["Aff", "Neg"]);

  it("takes a whole-point stake the wallet covers", () => {
    expect(parseNewBet({ outcomeId: "o2", stake: 25 }, outcomes, 1000)).toEqual({ ok: true, value: { outcomeId: "o2", stake: 25 } });
  });

  it("refuses unknown outcomes, fractions, zero and overdrafts", () => {
    expect(parseNewBet({ outcomeId: "o3", stake: 25 }, outcomes, 1000).ok).toBe(false);
    expect(parseNewBet({ outcomeId: "o1", stake: 2.5 }, outcomes, 1000).ok).toBe(false);
    expect(parseNewBet({ outcomeId: "o1", stake: 0 }, outcomes, 1000).ok).toBe(false);
    expect(parseNewBet({ outcomeId: "o1", stake: 1001 }, outcomes, 1000)).toEqual({ ok: false, error: "You only have 1000 points." });
  });
});

describe("parseResolve", () => {
  it("takes an outcome, or null to void", () => {
    const outcomes = manualOutcomes(["A", "B"]);
    expect(parseResolve({ outcomeId: "o1", note: " judges ruled " }, outcomes)).toEqual({ ok: true, value: { outcomeId: "o1", note: "judges ruled" } });
    expect(parseResolve({ outcomeId: null }, outcomes)).toEqual({ ok: true, value: { outcomeId: null, note: "" } });
    expect(parseResolve({ outcomeId: "o9" }, outcomes).ok).toBe(false);
  });
});

describe("canResolveMarket", () => {
  const manual = { type: "manual" } as const;

  it("lets staff settle any open market", () => {
    expect(canResolveMarket({ status: "open", source: { type: "tabroom-panel", panelId: 1 }, isCreator: false, isStaff: true, holdsPosition: true })).toBe(true);
  });

  it("lets the creator settle a manual market only without a position", () => {
    expect(canResolveMarket({ status: "open", source: manual, isCreator: true, isStaff: false, holdsPosition: false })).toBe(true);
    expect(canResolveMarket({ status: "open", source: manual, isCreator: true, isStaff: false, holdsPosition: true })).toBe(false);
    expect(canResolveMarket({ status: "open", source: manual, isCreator: false, isStaff: false, holdsPosition: false })).toBe(false);
  });

  it("never lets a creator settle a market that settles itself, or anyone re-settle one", () => {
    expect(canResolveMarket({ status: "open", source: { type: "tabroom-event", eventId: 1 }, isCreator: true, isStaff: false, holdsPosition: false })).toBe(false);
    expect(canResolveMarket({ status: "resolved", source: manual, isCreator: true, isStaff: true, holdsPosition: false })).toBe(false);
  });
});

describe("readStoredSource", () => {
  it("falls back to manual for anything unreadable", () => {
    expect(readStoredSource("not json")).toEqual({ type: "manual" });
    expect(readStoredSource('{"type":"tabroom-panel","panelId":3}')).toEqual({ type: "tabroom-panel", panelId: 3 });
  });
});

describe("format", () => {
  it("never shows a live outcome as 0% or 100%", () => {
    expect(formatPercent(0.004)).toBe("<1%");
    expect(formatPercent(0.996)).toBe(">99%");
    expect(formatPercent(0.5)).toBe("50%");
  });

  it("describes the close", () => {
    expect(describeClose(NOW - 1, NOW)).toBe("betting closed");
    expect(describeClose(NOW + 90, NOW)).toBe("closes in 1m");
    expect(describeClose(NOW + 5 * 3600, NOW)).toBe("closes in 5h");
    expect(describeClose(NOW + 3 * DAY, NOW)).toBe("closes in 3d");
  });
});
