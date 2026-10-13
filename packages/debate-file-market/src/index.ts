/**
 * @fileoverview Selling research files for wallet balance.
 *
 * A reader funds a wallet with a fixed $10 or $20 Stripe top-up; a seller
 * lists one of their files from the sidebar's "Sell…" menu item at a price
 * they choose; anyone can read a listing's table of contents for free, and
 * buying it moves the price from the buyer's wallet to the seller's and saves
 * the full file — cards included — to the buyer's files.
 *
 * This package is the framework-free core: the table-of-contents preview,
 * price and request validation, top-up options and Stripe event parsing,
 * wire types, plus the D1 migration in `migrations/`. The routes and queries
 * live in `apps/debate-ai.com` (`app/api/market`, `lib/market`); the pages
 * and the Sell dialog are in `debate-webview`. The browser calls are exported
 * separately from `debate-file-market/client`.
 *
 * @module debate-file-market
 */

export * from "./types";
export * from "./outline";
export * from "./pricing";
export * from "./topups";
