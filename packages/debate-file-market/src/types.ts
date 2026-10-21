/**
 * @fileoverview The wire types of the file market: what `/api/market` routes
 * answer and what they accept.
 *
 * Money is always whole US cents, as an integer, so wallet arithmetic never
 * meets a float.
 *
 * @module debate-file-market/types
 */

/** Heading depth in a Debate Editor document: 1 pocket, 2 hat, 3 block, 4 tag. */
export type OutlineLevel = 1 | 2 | 3 | 4;

/** One line of a file's table of contents — a heading, never a card body. */
export interface OutlineEntry {
  level: OutlineLevel;
  text: string;
}

/** A signed-in account's spendable balance. */
export interface Wallet {
  balanceCents: number;
}

/** A fixed amount a reader can add to their wallet through Stripe Checkout. */
export interface TopUpOption {
  id: TopUpId;
  amountCents: number;
  label: string;
}

export type TopUpId = "usd-10" | "usd-20";

export interface ListingSeller {
  id: string;
  name: string;
  image: string | null;
}

/** A file for sale, as the market lists it — no contents, no outline. */
export interface ListingSummary {
  id: string;
  title: string;
  priceCents: number;
  seller: ListingSeller;
  /** How many headings the preview shows. */
  headings: number;
  sales: number;
  /** ISO timestamps. */
  createdAt: string;
  updatedAt: string;
}

/**
 * One listing as its page shows it. `outline` is the free preview; `content`
 * (the stored document, in its row's `format`) is present only for the seller
 * and for readers who bought it.
 */
export interface ListingDetail extends ListingSummary {
  outline: OutlineEntry[];
  owned: boolean;
  isSeller: boolean;
  active: boolean;
  content?: { content: string; format: string };
}

/** `GET /api/market` — the wallet and the open listings. */
export interface MarketBoardResponse {
  /** `null` signed out or on a guest account. */
  wallet: Wallet | null;
  topUps: TopUpOption[];
  /** False when the deployment has no Stripe key, so top-ups can't start. */
  topUpsEnabled: boolean;
  listings: ListingSummary[];
}

/** `POST /api/market/listings` — put one of your own files up for sale. */
export interface SellRequest {
  documentId: number;
  priceCents: number;
  /**
   * The preview, worked out in the browser for a `.cmir` file (the server
   * can only read HTML headings itself). Sanitized server-side; omitted, the
   * server derives it from an HTML document.
   */
  outline?: OutlineEntry[];
}

export interface SellResult {
  listing: ListingDetail;
}

/** `POST /api/market/listings/[id]/purchase`. */
export interface PurchaseResult {
  listing: ListingDetail;
  wallet: Wallet;
  /** The copy saved to the buyer's own files. */
  documentId: number;
}

/** `POST /api/market/listings/[id]/copy` — another copy of a file you own. */
export interface CopyResult {
  documentId: number;
}

/** `POST /api/market/top-up` — where to send the reader to pay. */
export interface TopUpCheckout {
  url: string;
}
