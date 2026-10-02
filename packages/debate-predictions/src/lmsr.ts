/**
 * @fileoverview The pricing engine: Hanson's logarithmic market scoring rule.
 *
 * A market holds `q`, the shares outstanding on each outcome, and a liquidity
 * parameter `b`. The automated market maker always quotes a price, so a bet
 * never waits for a counterparty:
 *
 *     C(q)     = b · ln Σ exp(qᵢ / b)          (cost function)
 *     priceᵢ   = exp(qᵢ / b) / Σ exp(qⱼ / b)   (prices sum to 1)
 *
 * Buying shares of outcome `i` costs `C(q′) − C(q)`. Every share of the
 * winning outcome then pays one point. Bettors stake whole points, so the
 * engine solves for how many shares a stake buys; that has a closed form:
 *
 *     qᵢ′ = b · ln( Σ·e^(s/b) − (Σ − e^(qᵢ/b)) )
 *
 * Everything is computed in log space so balances in the hundreds of
 * thousands never overflow `exp`.
 *
 * @module debate-predictions/lmsr
 */

/** `ln Σ exp(xᵢ)` without overflow. */
function logSumExp(values: readonly number[]): number {
  const max = Math.max(...values);
  if (!Number.isFinite(max)) return max;
  let sum = 0;
  for (const value of values) sum += Math.exp(value - max);
  return max + Math.log(sum);
}

/** The LMSR cost function `C(q)`. */
export function lmsrCost(shares: readonly number[], liquidity: number): number {
  return liquidity * logSumExp(shares.map((q) => q / liquidity));
}

/** Every outcome's price (implied probability); they sum to 1. */
export function lmsrPrices(shares: readonly number[], liquidity: number): number[] {
  if (shares.length === 0) return [];
  const scaled = shares.map((q) => q / liquidity);
  const total = logSumExp(scaled);
  return scaled.map((x) => Math.exp(x - total));
}

/** What buying `amount` shares of `outcome` costs, in points. */
export function lmsrCostToBuy(
  shares: readonly number[],
  liquidity: number,
  outcome: number,
  amount: number,
): number {
  const after = shares.slice();
  after[outcome] += amount;
  return lmsrCost(after, liquidity) - lmsrCost(shares, liquidity);
}

/**
 * How many shares of `outcome` a stake of `stake` points buys — the inverse of
 * {@link lmsrCostToBuy}.
 */
export function lmsrSharesForStake(
  shares: readonly number[],
  liquidity: number,
  outcome: number,
  stake: number,
): number {
  if (!(stake > 0)) return 0;
  if (outcome < 0 || outcome >= shares.length) throw new RangeError(`No outcome at index ${outcome}`);
  const scaled = shares.map((q) => q / liquidity);
  const logTotal = logSumExp(scaled);
  // ln(Σ·e^(s/b) − Σ + e^(qᵢ/b)) = ln Σ + s/b + ln(1 − (1 − pᵢ)·e^(−s/b)),
  // where pᵢ = e^(qᵢ/b)/Σ is the outcome's current price.
  const price = Math.exp(scaled[outcome] - logTotal);
  const inner = Math.log1p(-(1 - price) * Math.exp(-stake / liquidity));
  const after = liquidity * (logTotal + stake / liquidity + inner);
  return after - shares[outcome];
}

/** A quote for one prospective bet. */
export interface BetQuote {
  shares: number;
  /** Average points paid per share. */
  averagePrice: number;
  /** The outcome's price after the bet. */
  priceAfter: number;
  /** Points the bet returns if this outcome wins. */
  payoutIfWin: number;
}

/** Quotes a bet of `stake` points on `outcome` without placing it. */
export function quoteBet(
  shares: readonly number[],
  liquidity: number,
  outcome: number,
  stake: number,
): BetQuote {
  const bought = lmsrSharesForStake(shares, liquidity, outcome, stake);
  const after = shares.slice();
  after[outcome] += bought;
  return {
    shares: bought,
    averagePrice: bought > 0 ? stake / bought : 0,
    priceAfter: lmsrPrices(after, liquidity)[outcome],
    payoutIfWin: Math.floor(bought),
  };
}
