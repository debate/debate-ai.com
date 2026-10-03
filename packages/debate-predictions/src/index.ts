/**
 * @fileoverview Play-money prediction markets on debates, tournament winners
 * and Glicko rating moves.
 *
 * This package is the framework-free core: the LMSR pricing engine, payout
 * and settlement rules, request validation and wire types, plus the D1
 * migration in `migrations/`. The routes and queries live in
 * `apps/debate-ai.com` (`app/api/predictions`, `lib/predictions`); the page is
 * `debate-webview`'s `/practice/predictions`. The browser calls are exported
 * separately from `debate-predictions/client`.
 *
 * @module debate-predictions
 */

export * from "./types";
export * from "./lmsr";
export * from "./settle";
export * from "./validation";
export * from "./format";
export * from "./presets";
