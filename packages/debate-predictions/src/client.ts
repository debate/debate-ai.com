/**
 * @fileoverview The browser half of the prediction-markets API — the calls the
 * markets page makes, and nothing else.
 *
 * Every call returns a typed result or throws an `Error` carrying a message fit
 * to show the reader. A signed-out board read resolves normally (the board
 * still lists markets); a signed-out write throws a sign-in message.
 *
 * @module debate-predictions/client
 */

import type {
  BetResult,
  NewBet,
  NewMarket,
  PredictionBoardResponse,
  PredictionMarket,
  PredictionSourcesResponse,
  ResolveRequest,
} from "./types";

const DEFAULT_BASE_PATH = "/api/predictions";

export interface PredictionsClientOptions {
  /** Prefix for the API routes. Defaults to `/api/predictions`. */
  basePath?: string;
  /** Injected for tests; defaults to the global `fetch`. */
  fetchImpl?: typeof fetch;
}

async function errorFrom(response: Response, fallback: string): Promise<Error> {
  try {
    const payload = (await response.json()) as { error?: unknown };
    if (typeof payload?.error === "string" && payload.error.length > 0) return new Error(payload.error);
  } catch {
    // A non-JSON error body: the fallback says enough.
  }
  return new Error(fallback);
}

function requester(options: PredictionsClientOptions | undefined) {
  const basePath = options?.basePath ?? DEFAULT_BASE_PATH;
  const doFetch = options?.fetchImpl ?? globalThis.fetch.bind(globalThis);
  return async <T>(path: string, init: RequestInit | undefined, fallback: string): Promise<T> => {
    const response = await doFetch(`${basePath}${path}`, {
      ...init,
      headers: { ...(init?.body ? { "Content-Type": "application/json" } : {}), ...init?.headers },
    });
    if (!response.ok) throw await errorFrom(response, fallback);
    return (await response.json()) as T;
  };
}

/** The board: the viewer's wallet, every listed market, and the leaders. */
export function fetchPredictionBoard(options: PredictionsClientOptions = {}): Promise<PredictionBoardResponse> {
  return requester(options)<PredictionBoardResponse>("", undefined, "Could not load the markets.");
}

/** Hosted Tabroom events, and, given one, its entries and open rounds. */
export function fetchPredictionSources(
  eventId: number | null,
  options: PredictionsClientOptions = {},
): Promise<PredictionSourcesResponse> {
  const query = eventId ? `?eventId=${encodeURIComponent(String(eventId))}` : "";
  return requester(options)<PredictionSourcesResponse>(`/sources${query}`, undefined, "Could not load hosted tournaments.");
}

/** Opens a market and returns it as the board shows it. */
export function createMarket(market: NewMarket, options: PredictionsClientOptions = {}): Promise<PredictionMarket> {
  return requester(options)<PredictionMarket>(
    "/markets",
    { method: "POST", body: JSON.stringify(market) },
    "Could not open that market.",
  );
}

/** Places a bet and returns the market and wallet as they now stand. */
export function placeBet(marketId: string, bet: NewBet, options: PredictionsClientOptions = {}): Promise<BetResult> {
  return requester(options)<BetResult>(
    `/markets/${encodeURIComponent(marketId)}/bets`,
    { method: "POST", body: JSON.stringify(bet) },
    "Could not place that bet.",
  );
}

/** Settles (or, with `outcomeId: null`, voids) a market by hand. */
export function resolveMarket(
  marketId: string,
  request: ResolveRequest,
  options: PredictionsClientOptions = {},
): Promise<PredictionMarket> {
  return requester(options)<PredictionMarket>(
    `/markets/${encodeURIComponent(marketId)}/resolve`,
    { method: "POST", body: JSON.stringify(request) },
    "Could not settle that market.",
  );
}
