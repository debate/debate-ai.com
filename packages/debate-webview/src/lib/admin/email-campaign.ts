/**
 * @fileoverview Client side of the admin Emails section's bulk send: the
 * shapes `/api/admin/emails/campaign` returns, and the loop that sends a list
 * one batch at a time so the panel can show progress and stop on an error.
 */

export type EmailProvider = "resend" | "cloudflare";

export const EMAIL_PROVIDER_LABELS: Record<EmailProvider, string> = {
  resend: "Resend",
  cloudflare: "Cloudflare Worker",
};

/** One address's outcome. `skipped` means it had unsubscribed. */
export interface SendResult {
  email: string;
  status: "sent" | "failed" | "skipped";
  id?: string;
  error?: string;
}

export interface SendTotals {
  sent: number;
  failed: number;
  skipped: number;
}

/** One `/api/admin/emails/campaign` POST response. */
export interface BatchResponse {
  results: SendResult[];
  totals: SendTotals;
  /** Addresses in the whole list. */
  total: number;
  /** Where the next batch starts, or `null` after the last. */
  nextOffset: number | null;
}

export function tally(results: readonly SendResult[]): SendTotals {
  const totals: SendTotals = { sent: 0, failed: 0, skipped: 0 };
  for (const result of results) totals[result.status] += 1;
  return totals;
}

export interface BatchRun {
  results: SendResult[];
  /** Every batch went out. */
  completed: boolean;
  /** Why the run stopped early (a request failed or `shouldStop` returned true). */
  error: string | null;
  /** Where a resumed run would start. */
  nextOffset: number | null;
}

/**
 * Calls `sendBatch(offset)` from `startOffset` until a response has no
 * `nextOffset`, collecting every result. A batch that throws ends the run with
 * its message, keeping the results so far; `onBatch` sees each batch as it
 * lands.
 */
export async function sendInBatches(
  sendBatch: (offset: number) => Promise<BatchResponse>,
  options: {
    startOffset?: number;
    onBatch?: (batch: BatchResponse, all: SendResult[]) => void;
    shouldStop?: () => boolean;
  } = {},
): Promise<BatchRun> {
  const results: SendResult[] = [];
  let offset: number | null = options.startOffset ?? 0;
  while (offset !== null) {
    if (options.shouldStop?.()) return { results, completed: false, error: "Stopped.", nextOffset: offset };
    let batch: BatchResponse;
    try {
      batch = await sendBatch(offset);
    } catch (error) {
      return { results, completed: false, error: (error as Error).message || "The send failed.", nextOffset: offset };
    }
    results.push(...batch.results);
    options.onBatch?.(batch, results);
    offset = batch.nextOffset;
  }
  return { results, completed: true, error: null, nextOffset: null };
}

/** Fetches an admin email endpoint and returns its JSON, throwing the route's `error` message otherwise. */
export async function adminEmailApi<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: init?.body ? { "Content-Type": "application/json", ...init.headers } : init?.headers,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((data as { error?: string }).error || `Request failed (${response.status}).`);
  return data as T;
}
