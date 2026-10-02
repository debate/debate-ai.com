import { describe, expect, it } from "vitest";
import { lmsrCost, lmsrCostToBuy, lmsrPrices, lmsrSharesForStake, quoteBet } from "../src/lmsr";

describe("lmsrPrices", () => {
  it("prices every outcome equally in a fresh market", () => {
    expect(lmsrPrices([0, 0], 150)).toEqual([0.5, 0.5]);
    for (const price of lmsrPrices([0, 0, 0, 0], 150)) expect(price).toBeCloseTo(0.25);
  });

  it("sums to 1 and favours the outcome with more shares", () => {
    const prices = lmsrPrices([300, 0, -50], 150);
    expect(prices.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
    expect(prices[0]).toBeGreaterThan(prices[1]);
    expect(prices[1]).toBeGreaterThan(prices[2]);
  });

  it("stays finite for share counts far past where exp() overflows", () => {
    const prices = lmsrPrices([200_000, 0], 150);
    expect(prices[0]).toBeCloseTo(1);
    expect(Number.isFinite(lmsrCost([200_000, 0], 150))).toBe(true);
  });
});

describe("lmsrSharesForStake", () => {
  it("is the exact inverse of the cost to buy", () => {
    for (const shares of [[0, 0], [120, -30], [0, 0, 0, 0, 0], [5000, 10]]) {
      for (const stake of [1, 37, 500, 1000]) {
        const outcome = shares.length - 1;
        const bought = lmsrSharesForStake(shares, 150, outcome, stake);
        expect(lmsrCostToBuy(shares, 150, outcome, bought)).toBeCloseTo(stake, 6);
      }
    }
  });

  it("buys more shares than points staked on an outcome priced under 1", () => {
    const bought = lmsrSharesForStake([0, 0], 150, 0, 100);
    expect(bought).toBeGreaterThan(100);
    // and never more than stake / current price
    expect(bought).toBeLessThan(200);
  });

  it("never lets a stake win more than the market maker's bounded subsidy", () => {
    // Max loss for the maker is b·ln(n): even a huge stake profits less than that.
    const stake = 100_000;
    const bought = lmsrSharesForStake([0, 0], 150, 0, stake);
    expect(bought - stake).toBeLessThanOrEqual(150 * Math.log(2) + 1e-6);
  });

  it("buys nothing for a zero stake and rejects an unknown outcome", () => {
    expect(lmsrSharesForStake([0, 0], 150, 0, 0)).toBe(0);
    expect(() => lmsrSharesForStake([0, 0], 150, 5, 10)).toThrow(RangeError);
  });
});

describe("quoteBet", () => {
  it("reports the shares, average price, new price and whole-point payout", () => {
    const quote = quoteBet([0, 0], 150, 1, 100);
    expect(quote.averagePrice).toBeCloseTo(100 / quote.shares);
    expect(quote.priceAfter).toBeGreaterThan(0.5);
    expect(quote.payoutIfWin).toBe(Math.floor(quote.shares));
  });
});
