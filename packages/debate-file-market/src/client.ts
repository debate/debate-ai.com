/**
 * @fileoverview The browser half of the file-market API — the calls the
 * market page, the listing page and the sidebar's "Sell…" dialog make.
 *
 * Every call returns a typed result or throws an `Error` carrying a message
 * fit to show the reader.
 *
 * @module debate-file-market/client
 */

import type {
  CopyResult,
  ListingDetail,
  MarketBoardResponse,
  PurchaseResult,
  SellRequest,
  SellResult,
  TopUpCheckout,
  TopUpId,
} from "./types";
import type {
  FileMetadata,
  FileMetadataResponse,
  PublisherPageResponse,
  PublisherRequest,
  ResearchPublisher,
} from "./publishers";

const DEFAULT_BASE_PATH = "/api/market";

export interface MarketClientOptions {
  /** Prefix for the API routes. Defaults to `/api/market`. */
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

function requester(options: MarketClientOptions | undefined) {
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

/** The viewer's wallet, the top-up options and the files for sale. */
export function fetchMarketBoard(options: MarketClientOptions = {}): Promise<MarketBoardResponse> {
  return requester(options)<MarketBoardResponse>("", undefined, "Could not load the market.");
}

/** One listing: its preview, and its contents when the viewer owns it. */
export async function fetchListing(id: string, options: MarketClientOptions = {}): Promise<ListingDetail> {
  const { listing } = await requester(options)<{ listing: ListingDetail }>(
    `/listings/${encodeURIComponent(id)}`,
    undefined,
    "Could not load that file.",
  );
  return listing;
}

/** Puts one of the viewer's files up for sale, or reprices and refreshes it. */
export function sellFile(request: SellRequest, options: MarketClientOptions = {}): Promise<SellResult> {
  return requester(options)<SellResult>(
    "/listings",
    { method: "POST", body: JSON.stringify(request) },
    "Could not list that file for sale.",
  );
}

/** Takes a listing off the market. Buyers keep what they bought. */
export function stopSelling(id: string, options: MarketClientOptions = {}): Promise<{ ok: true }> {
  return requester(options)<{ ok: true }>(
    `/listings/${encodeURIComponent(id)}`,
    { method: "DELETE" },
    "Could not stop selling that file.",
  );
}

/** Buys a listing from the wallet and saves a copy to the buyer's files. */
export function purchaseListing(id: string, options: MarketClientOptions = {}): Promise<PurchaseResult> {
  return requester(options)<PurchaseResult>(
    `/listings/${encodeURIComponent(id)}/purchase`,
    { method: "POST" },
    "Could not buy that file.",
  );
}

/** Saves another copy of a file the viewer bought (or sells) to their files. */
export function copyListing(id: string, options: MarketClientOptions = {}): Promise<CopyResult> {
  return requester(options)<CopyResult>(
    `/listings/${encodeURIComponent(id)}/copy`,
    { method: "POST" },
    "Could not save a copy of that file.",
  );
}

/** Starts a Stripe Checkout for a top-up; send the reader to the returned URL. */
export function startTopUp(topUp: TopUpId, returnTo?: string, options: MarketClientOptions = {}): Promise<TopUpCheckout> {
  return requester(options)<TopUpCheckout>(
    "/top-up",
    { method: "POST", body: JSON.stringify({ topUp, returnTo }) },
    "Could not start the payment.",
  );
}

// ── Research publishers and file publication details ────────────────────

/** A publisher's page: its details, its files and the viewer's subscription. */
export function fetchPublisherPage(slug: string, options: MarketClientOptions = {}): Promise<PublisherPageResponse> {
  return requester(options)<PublisherPageResponse>(
    `/publishers/${encodeURIComponent(slug)}`,
    undefined,
    "Could not load that publisher.",
  );
}

/** Creates a publisher owned by the viewer. */
export async function createPublisher(request: PublisherRequest, options: MarketClientOptions = {}): Promise<ResearchPublisher> {
  const { publisher } = await requester(options)<{ publisher: ResearchPublisher }>(
    "/publishers",
    { method: "POST", body: JSON.stringify(request) },
    "Could not create that publisher.",
  );
  return publisher;
}

/** Edits a publisher the viewer owns. */
export async function updatePublisher(
  slug: string,
  request: PublisherRequest,
  options: MarketClientOptions = {},
): Promise<ResearchPublisher> {
  const { publisher } = await requester(options)<{ publisher: ResearchPublisher }>(
    `/publishers/${encodeURIComponent(slug)}`,
    { method: "PUT", body: JSON.stringify(request) },
    "Could not save that publisher.",
  );
  return publisher;
}

/** Subscribes to a publisher, paying one month from the wallet when it isn't free. */
export function subscribeToPublisher(slug: string, options: MarketClientOptions = {}): Promise<PublisherPageResponse> {
  return requester(options)<PublisherPageResponse>(
    `/publishers/${encodeURIComponent(slug)}/subscribe`,
    { method: "POST" },
    "Could not subscribe.",
  );
}

/** Saves a copy of one of a publisher's files to the viewer's files (subscribers only). */
export function copyPublishedFile(
  slug: string,
  documentId: number,
  options: MarketClientOptions = {},
): Promise<CopyResult> {
  return requester(options)<CopyResult>(
    `/publishers/${encodeURIComponent(slug)}/files/${documentId}/copy`,
    { method: "POST" },
    "Could not save a copy of that file.",
  );
}

/** A file's publication details, its publisher and the viewer's own publishers. */
export function fetchFileMetadata(documentId: number, options: MarketClientOptions = {}): Promise<FileMetadataResponse> {
  return requester({ basePath: "/api/doc/documents", ...options })<FileMetadataResponse>(
    `/${documentId}/metadata`,
    undefined,
    "Could not load this file's details.",
  );
}

/** Saves a file's publication details. */
export function saveFileMetadata(
  documentId: number,
  metadata: FileMetadata,
  options: MarketClientOptions = {},
): Promise<FileMetadataResponse> {
  return requester({ basePath: "/api/doc/documents", ...options })<FileMetadataResponse>(
    `/${documentId}/metadata`,
    { method: "PUT", body: JSON.stringify(metadata) },
    "Could not save this file's details.",
  );
}

// ── Following a publisher ───────────────────────────────────────────────

/** Follow state of one publisher, as `/api/follows` answers it. */
export interface PublisherFollowState {
  followers: number;
  following: boolean;
  signedIn: boolean;
}

const FOLLOWS_PATH = "/api/follows";

/** Follower count of a publisher (an official camp's `camp-…` slug), and whether the viewer follows it. */
export async function fetchPublisherFollow(
  slug: string,
  fetchImpl: typeof fetch = globalThis.fetch.bind(globalThis),
): Promise<PublisherFollowState> {
  const params = new URLSearchParams({ kind: "publisher", slug });
  const response = await fetchImpl(`${FOLLOWS_PATH}?${params}`, { credentials: "same-origin" });
  if (!response.ok) throw await errorFrom(response, "Couldn't load followers.");
  return (await response.json()) as PublisherFollowState;
}

/** Follows (`follow: true`) or unfollows a publisher; answers with its new state. */
export async function setPublisherFollow(
  publisher: { slug: string; name: string },
  follow: boolean,
  fetchImpl: typeof fetch = globalThis.fetch.bind(globalThis),
): Promise<PublisherFollowState> {
  const response = await fetchImpl(FOLLOWS_PATH, {
    method: "PUT",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind: "publisher", slug: publisher.slug, name: publisher.name, follow }),
  });
  if (!response.ok) throw await errorFrom(response, follow ? "Couldn't follow." : "Couldn't unfollow.");
  return (await response.json()) as PublisherFollowState;
}
