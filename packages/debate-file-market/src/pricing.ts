/**
 * @fileoverview Prices and the sell request.
 *
 * @module debate-file-market/pricing
 */

import { sanitizeOutline } from "./outline";
import type { SellRequest } from "./types";

/** The cheapest a file can be listed for: 50¢. */
export const MIN_PRICE_CENTS = 50;
/** The most a file can be listed for: $500. */
export const MAX_PRICE_CENTS = 50_000;

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

/** `1250` → `"$12.50"`. */
export function formatCents(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  return `${sign}$${(Math.abs(cents) / 100).toFixed(2)}`;
}

/** Reads a typed dollar amount (`"12"`, `"$12.50"`) as cents, or `null`. */
export function dollarsToCents(input: string): number | null {
  const cleaned = input.trim().replace(/^\$/, "").replace(/,/g, "");
  if (!/^\d+(\.\d{0,2})?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * 100);
}

export function validatePriceCents(value: unknown): Parsed<number> {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    return { ok: false, error: "Set a price in whole cents." };
  }
  if (value < MIN_PRICE_CENTS) return { ok: false, error: `The lowest price is ${formatCents(MIN_PRICE_CENTS)}.` };
  if (value > MAX_PRICE_CENTS) return { ok: false, error: `The highest price is ${formatCents(MAX_PRICE_CENTS)}.` };
  return { ok: true, value };
}

/** Validates the body of `POST /api/market/listings`. */
export function parseSellRequest(payload: unknown): Parsed<SellRequest> {
  if (!payload || typeof payload !== "object") return { ok: false, error: "Invalid request." };
  const body = payload as Record<string, unknown>;
  const documentId = body.documentId;
  if (typeof documentId !== "number" || !Number.isInteger(documentId) || documentId <= 0) {
    return { ok: false, error: "Pick a file to sell." };
  }
  const price = validatePriceCents(body.priceCents);
  if (!price.ok) return price;
  if (body.outline === undefined) return { ok: true, value: { documentId, priceCents: price.value } };
  const outline = sanitizeOutline(body.outline);
  if (!outline) return { ok: false, error: "The preview must be a list of headings." };
  return { ok: true, value: { documentId, priceCents: price.value, outline } };
}
