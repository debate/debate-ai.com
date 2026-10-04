/**
 * Wire types for prediction markets — what the API returns and accepts.
 *
 * Every amount is in **points**: play money with no cash value. Times on the
 * wire are Unix seconds.
 */

/**
 * What a market is about.
 *
 * - `debate` — who wins one round.
 * - `tournament` — who wins a tournament (an event's champion).
 * - `rating` — whether a team's Glicko rating is higher at close than when
 *   the market opened.
 * - `argument` — whether one flowed argument gets extended by its own side in
 *   a later speech. Opened by the round workspace, never by the new-market form.
 */
export type MarketKind = "debate" | "tournament" | "rating" | "argument";

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
 * - `argument` — a flowed argument, settled from the flow.
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
      /** The team's name. */
      name: string;
      /** The team's school. */
      school: string;
      /** The site-scale rating when the market opened. */
      baseline: number;
    }
  | {
      type: "argument";
      /** The round's id on the flow (the same id `savedRounds` use). */
      roundId: string;
      /** The flow row the argument sits on. */
      rowIndex: number;
      /** The speech it was introduced in, e.g. `1NC`. */
      speech: string;
    };

/** A wager on one flowed argument: `POST /api/predictions/arguments`. */
export interface ArgumentWager {
  /** The round's id on the flow. */
  roundId: string;
  /** The flow row the argument sits on. */
  rowIndex: number;
  /** The speech it was introduced in. */
  speech: string;
  /** The argument as flowed, for the market's title. */
  text: string;
  /** Which outcome is being backed. */
  outcomeId: "extended" | "dropped";
  /** Points staked. */
  stake: number;
}

/** Settling an argument market from the flow: `POST /api/predictions/arguments/settle`. */
export interface ArgumentSettlement {
  /** The round's id on the flow. */
  roundId: string;
  /** The flow row the argument sits on. */
  rowIndex: number;
  /** The speech it was introduced in. */
  speech: string;
  /** The outcome that happened. */
  outcomeId: "extended" | "dropped";
}

/** One way a market can resolve. */
export interface MarketOutcome {
  /** Stable within the market: `yes`/`no`, `entry:<tabroom id>`, or `o<n>`. */
  id: string;
  /** Text shown for the outcome. */
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
  /** The person's user id. */
  id: string;
  /** Display name. */
  name: string;
  /** Avatar URL, or null when they have none. */
  imageUrl: string | null;
}

/** The viewer's holding in one outcome. */
export interface MarketPosition {
  /** The outcome held. */
  outcomeId: string;
  /** Shares held; each pays one point if this outcome wins. */
  shares: number;
  /** Points spent buying them. */
  staked: number;
}

/** Which preset section a market belongs to, read back from its id. */
export interface PresetInfo {
  /** The featured section the market sits in. */
  group: "top-teams" | "majors";
  /** The rankings dataset id. */
  dataset: string;
  /** The tournament's slug, for `majors`. */
  tournament: string | null;
}

/** A market as the board shows it. */
export interface PredictionMarket {
  /** Market id. */
  id: string;
  /** What the market is about. */
  kind: MarketKind;
  /** Headline question. */
  title: string;
  /** Longer explanation of how it resolves. */
  description: string;
  /** Whether it takes bets, paid out, or was refunded. */
  status: MarketStatus;
  /** The ways it can resolve, with live prices. */
  outcomes: MarketOutcomeView[];
  /** The LMSR liquidity `b`; larger means prices move less per point staked. */
  liquidity: number;
  /** When betting closes (Unix seconds). */
  closesAt: number;
  /** When the market was opened (Unix seconds). */
  createdAt: number;
  /** Who opened it; null for a market the site opened. */
  creator: MarketPerson | null;
  /** Where the result comes from. */
  source: MarketSource;
  /** Total points staked. */
  volume: number;
  /** The winning outcome id once `resolved`. */
  resolvedOutcome: string | null;
  /** When it resolved (Unix seconds). */
  resolvedAt: number | null;
  /** Why it resolved or was voided, in a sentence. */
  resolutionNote: string | null;
  /** The viewer's positions; empty when they hold none or are signed out. */
  positions: MarketPosition[];
  /** What the viewer was paid when it settled, if they held a position. */
  payout: number | null;
  /** Whether the viewer may resolve or void it by hand. */
  canResolve: boolean;
  /** Set when the site opened it: which featured section it belongs to. */
  preset: PresetInfo | null;
}

/** An account's points balance. */
export interface PredictionWallet {
  /** Points available to stake. */
  balance: number;
  /** When the starting grant landed (Unix seconds). */
  grantedAt: number;
}

/** A leaderboard row: a person and their balance. */
export interface PredictionLeader extends MarketPerson {
  /** Points held. */
  balance: number;
}

/** `GET /api/predictions`: the whole board for the viewer. */
export interface PredictionBoardResponse {
  /** Null when signed out. */
  viewer: (MarketPerson & { isAnonymous: boolean }) | null;
  /** Null when signed out or a guest account. */
  wallet: PredictionWallet | null;
  /** Markets on the board. */
  markets: PredictionMarket[];
  /** The richest wallets, highest first. */
  leaders: PredictionLeader[];
}

/** What the create form sends. */
export interface NewMarket {
  /** What the market is about. */
  kind: MarketKind;
  /** Headline question. */
  title: string;
  /** Longer explanation. */
  description?: string;
  /** Outcome labels; ignored for `rating` and for a linked Tabroom source. */
  outcomes?: string[];
  /** When betting closes (Unix seconds). */
  closesAt: number;
  /** A hosted Tabroom round to resolve a `debate` market from. */
  tabroomPanelId?: number | null;
  /** A hosted Tabroom event to resolve a `tournament` market from. */
  tabroomEventId?: number | null;
  /** The rankings entry a `rating` market is about. */
  rating?: {
    /** Rankings dataset id. */
    dataset: string;
    /** The entry's stable hash. */
    hash: string;
  } | null;
}

/** A bet on one outcome. */
export interface NewBet {
  /** The outcome backed. */
  outcomeId: string;
  /** Points staked. */
  stake: number;
}

/** What the bet route answers with. */
export interface BetResult {
  /** The market after the bet. */
  market: PredictionMarket;
  /** The bettor's wallet after the bet. */
  wallet: PredictionWallet;
  /** Shares this bet bought. */
  shares: number;
}

/** A manual resolution: an outcome id, or `null` to void and refund. */
export interface ResolveRequest {
  /** The winning outcome, or null to void. */
  outcomeId: string | null;
  /** Why, shown on the market. */
  note?: string;
}

/** A hosted Tabroom entry, as a market outcome candidate. */
export interface TabroomEntryOption {
  /** Tabroom entry id. */
  id: number;
  /** Display name. */
  label: string;
}

/** A hosted Tabroom round that can back a `debate` market. */
export interface TabroomPanelOption {
  /** Tabroom panel id. */
  id: number;
  /** Display name. */
  label: string;
  /** The entries competing in the round. */
  entries: TabroomEntryOption[];
}

/** A hosted Tabroom event that can back a `tournament` market. */
export interface TabroomEventOption {
  /** Tabroom event id. */
  id: number;
  /** Tournament name. */
  tournament: string;
  /** Event name, e.g. "Varsity PF". */
  event: string;
  /** ISO date the tournament starts, if known. */
  start: string | null;
  /** ISO date the tournament ends, if known. */
  end: string | null;
}

/** Events, and entries or panels, offered as market sources. */
export interface PredictionSourcesResponse {
  /** Hosted events that can back a market. */
  events: TabroomEventOption[];
  /** Filled when the request named an event. */
  entries?: TabroomEntryOption[];
  /** Rounds of the named event. */
  panels?: TabroomPanelOption[];
}
