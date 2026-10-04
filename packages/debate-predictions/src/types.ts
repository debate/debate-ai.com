/**
 * @fileoverview Wire types for prediction markets — what the API returns and
 * accepts, shared by the routes in `apps/debate-ai.com` and the page in
 * `debate-webview`.
 *
 * Every amount is in **points**: play money with no cash value. Each account
 * is granted {@link STARTING_BALANCE} once, the first time it opens the
 * markets; nothing buys more and nothing cashes out.
 *
 * Times on the wire are Unix seconds.
 *
 * The type definitions (and their field docs) live in `@types/debate`; the
 * constants that go with them stay here.
 *
 * @module debate-predictions/types
 */

import type { MarketKind, MarketOutcome } from "debate";

export type {
  MarketKind,
  MarketStatus,
  MarketSource,
  ArgumentWager,
  ArgumentSettlement,
  MarketOutcome,
  MarketOutcomeView,
  MarketPerson,
  MarketPosition,
  PredictionMarket,
  PredictionWallet,
  PredictionLeader,
  PredictionBoardResponse,
  NewMarket,
  NewBet,
  BetResult,
  ResolveRequest,
  TabroomEntryOption,
  TabroomPanelOption,
  TabroomEventOption,
  PredictionSourcesResponse,
} from "debate";

/** Points granted to every account, once, on its first visit. */
export const STARTING_BALANCE = 1000;

/** The smallest stake a bet may carry. */
export const MIN_STAKE = 1;

/** The most outcomes one market may list (a tournament's field, say). */
export const MAX_OUTCOMES = 32;

/**
 * Default LMSR liquidity `b`. Larger means prices move less per point staked.
 * The most a market can ever pay out beyond what was staked is `b · ln(n)`
 * for `n` outcomes, which is minted, so `b` also bounds how many points one
 * market can create.
 */
export const DEFAULT_LIQUIDITY = 150;

/** How many markets one account may have open at once. */
export const MAX_OPEN_MARKETS_PER_CREATOR = 10;

/** The kinds the new-market form offers. `argument` markets are opened by the round workspace instead. */
export const MARKET_KINDS: readonly MarketKind[] = ["debate", "tournament", "rating"];

/** The two outcomes of an argument market. */
export const ARGUMENT_OUTCOMES: readonly MarketOutcome[] = [
  { id: "extended", label: "Extended" },
  { id: "dropped", label: "Not extended" },
];
