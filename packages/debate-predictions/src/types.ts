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
 * @module debate-predictions/types
 */

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

/**
 * What a market is about.
 *
 * - `debate` — who wins one round.
 * - `tournament` — who wins a tournament (an event's champion).
 * - `rating` — whether a team's Glicko rating is higher at close than when
 *   the market opened.
 */
export type MarketKind = "debate" | "tournament" | "rating";

export const MARKET_KINDS: readonly MarketKind[] = ["debate", "tournament", "rating"];

/** `open` takes bets; `resolved` paid the winners; `void` refunded every stake. */
export type MarketStatus = "open" | "resolved" | "void";

/**
 * Where the result comes from.
 *
 * - `manual` — the creator (if they hold no position) or a moderator picks it.
 * - `tabroom-panel` — a round hosted on the site's Tabroom tables: the entry
 *   that wins the majority of ballots.
 * - `tabroom-event` — an event hosted on the site's Tabroom tables: the entry
 *   placed first in its final published results.
 * - `rating` — a `debate-rankings` entry, compared against its rating when
 *   the market opened.
 */
export type MarketSource =
  | { type: "manual" }
  | { type: "tabroom-panel"; panelId: number }
  | { type: "tabroom-event"; eventId: number }
  | {
      type: "rating";
      /** A `debate-rankings` dataset id, e.g. `hspf`. */
      dataset: string;
      /** The entry's stable hash across tournaments. */
      hash: string;
      name: string;
      school: string;
      /** The site-scale rating when the market opened. */
      baseline: number;
    };

/** One way a market can resolve. */
export interface MarketOutcome {
  /** Stable within the market: `yes`/`no`, `entry:<tabroom id>`, or `o<n>`. */
  id: string;
  label: string;
}

/** An outcome as the board shows it, with its live price. */
export interface MarketOutcomeView extends MarketOutcome {
  /** The LMSR price, 0–1 — the market's implied probability. */
  price: number;
  /** Outstanding shares sold on this outcome. */
  shares: number;
}

/** A person as the board shows them. Never carries an email. */
export interface MarketPerson {
  id: string;
  name: string;
  imageUrl: string | null;
}

/** The viewer's holding in one outcome. */
export interface MarketPosition {
  outcomeId: string;
  /** Shares held; each pays one point if this outcome wins. */
  shares: number;
  /** Points spent buying them. */
  staked: number;
}

export interface PredictionMarket {
  id: string;
  kind: MarketKind;
  title: string;
  description: string;
  status: MarketStatus;
  outcomes: MarketOutcomeView[];
  liquidity: number;
  /** When betting closes (Unix seconds). */
  closesAt: number;
  createdAt: number;
  creator: MarketPerson | null;
  source: MarketSource;
  /** Total points staked. */
  volume: number;
  /** The winning outcome id once `resolved`. */
  resolvedOutcome: string | null;
  resolvedAt: number | null;
  /** Why it resolved or was voided, in a sentence. */
  resolutionNote: string | null;
  /** The viewer's positions; empty when they hold none or are signed out. */
  positions: MarketPosition[];
  /** What the viewer was paid when it settled, if they held a position. */
  payout: number | null;
  /** Whether the viewer may resolve or void it by hand. */
  canResolve: boolean;
}

export interface PredictionWallet {
  balance: number;
  /** When the starting grant landed (Unix seconds). */
  grantedAt: number;
}

export interface PredictionLeader extends MarketPerson {
  balance: number;
}

export interface PredictionBoardResponse {
  /** Null when signed out. */
  viewer: (MarketPerson & { isAnonymous: boolean }) | null;
  /** Null when signed out or a guest account. */
  wallet: PredictionWallet | null;
  markets: PredictionMarket[];
  /** The richest wallets, highest first. */
  leaders: PredictionLeader[];
}

/** What the create form sends. */
export interface NewMarket {
  kind: MarketKind;
  title: string;
  description?: string;
  /** Outcome labels; ignored for `rating` and for a linked Tabroom source. */
  outcomes?: string[];
  closesAt: number;
  /** A hosted Tabroom round to resolve a `debate` market from. */
  tabroomPanelId?: number | null;
  /** A hosted Tabroom event to resolve a `tournament` market from. */
  tabroomEventId?: number | null;
  /** The rankings entry a `rating` market is about. */
  rating?: { dataset: string; hash: string } | null;
}

export interface NewBet {
  outcomeId: string;
  stake: number;
}

/** What the bet route answers with. */
export interface BetResult {
  market: PredictionMarket;
  wallet: PredictionWallet;
  /** Shares this bet bought. */
  shares: number;
}

/** A manual resolution: an outcome id, or `null` to void and refund. */
export interface ResolveRequest {
  outcomeId: string | null;
  note?: string;
}

/** A hosted Tabroom entry, as a market outcome candidate. */
export interface TabroomEntryOption {
  id: number;
  label: string;
}

/** A hosted Tabroom round that can back a `debate` market. */
export interface TabroomPanelOption {
  id: number;
  label: string;
  entries: TabroomEntryOption[];
}

/** A hosted Tabroom event that can back a `tournament` market. */
export interface TabroomEventOption {
  id: number;
  tournament: string;
  event: string;
  /** ISO date the tournament starts, if known. */
  start: string | null;
  end: string | null;
}

export interface PredictionSourcesResponse {
  events: TabroomEventOption[];
  /** Filled when the request named an event. */
  entries?: TabroomEntryOption[];
  panels?: TabroomPanelOption[];
}
