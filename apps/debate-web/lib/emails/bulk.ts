/**
 * @fileoverview Pure helpers for the admin Emails section's bulk sends:
 * batching, send outcomes, and masking the Resend API key.
 */

/** Resend's batch endpoint takes at most 100 emails per call. */
export const RESEND_BATCH_SIZE = 100;

/**
 * The Cloudflare `send_email` binding sends one message per call, and a
 * Worker request makes a bounded number of subrequests, so its batches stay small.
 */
export const CLOUDFLARE_BATCH_SIZE = 25;

export const EMAIL_PROVIDERS = ["resend", "cloudflare"] as const;
export type EmailProvider = (typeof EMAIL_PROVIDERS)[number];

export function isEmailProvider(value: unknown): value is EmailProvider {
  return EMAIL_PROVIDERS.includes(value as EmailProvider);
}

export function batchSizeFor(provider: EmailProvider): number {
  return provider === "cloudflare" ? CLOUDFLARE_BATCH_SIZE : RESEND_BATCH_SIZE;
}

/** Splits `items` into consecutive groups of at most `size`. */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  if (!Number.isInteger(size) || size < 1) throw new RangeError("Batch size must be a positive integer.");
  const groups: T[][] = [];
  for (let start = 0; start < items.length; start += size) groups.push(items.slice(start, start + size));
  return groups;
}

/** One address's outcome in a bulk send. */
export interface SendResult {
  email: string;
  status: "sent" | "failed" | "skipped";
  /** The provider's message id, when it gave one. */
  id?: string;
  /** Why it failed or was skipped. */
  error?: string;
}

export interface SendTotals {
  sent: number;
  failed: number;
  skipped: number;
}

export function tallyResults(results: readonly SendResult[]): SendTotals {
  const totals: SendTotals = { sent: 0, failed: 0, skipped: 0 };
  for (const result of results) totals[result.status] += 1;
  return totals;
}

/** What a Resend key must look like before it is saved. */
export function isValidResendKey(key: string): boolean {
  return /^re_[A-Za-z0-9_-]{8,200}$/.test(key);
}

/** How many trailing characters the admin UI may show. */
const VISIBLE_TAIL = 4;

/**
 * The only part of an API key that ever leaves the server: its last four
 * characters. A key too short to hide behind those yields `""`, so a short or
 * malformed value is never revealed.
 */
export function keyTail(key: string): string {
  const trimmed = key.trim();
  return trimmed.length >= VISIBLE_TAIL * 3 ? trimmed.slice(-VISIBLE_TAIL) : "";
}

/** A display form such as `re_••••••••wxyz`. */
export function maskApiKey(key: string): string {
  const tail = keyTail(key);
  const prefix = key.startsWith("re_") ? "re_" : "";
  return `${prefix}${"•".repeat(8)}${tail}`;
}
