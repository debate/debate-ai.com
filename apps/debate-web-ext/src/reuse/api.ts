/**
 * On-page card reuse check — does the team already have a card cut from the
 * page the debater is looking at?
 *
 * Mirrors packages/debate-card-search/src/lib/evidence-reuse-check-client.ts's
 * request/response shape against the same `GET /api/evidence-reuse-check`
 * route (see packages/debate-help-docs/content/docs/features/on-page-card-reuse-search.mdx). Ported from the
 * pre-merge extension's plain-JS `api.js` when the card-reuse extension and
 * the round timer became one extension; the storage keys are unchanged.
 */
import { getSettings } from '@/src/settings/settings';

/** One already-cut card the shared index knows about for this page. */
export interface ReuseMatch {
  argBlock?: string;
  cite?: string;
  topic?: string;
}

export interface ReuseCheckResult {
  alreadyCut: boolean;
  matches: ReuseMatch[];
}

/** Parses the whitelist's raw newline-separated text into a trimmed, lowercased, blank-line-filtered domain list. */
export function parseSkipDomains(raw: string): string[] {
  return raw
    .split('\n')
    .map((line) => line.trim().toLowerCase())
    .filter((line) => line.length > 0);
}

/**
 * Whether `pageUrl`'s hostname is covered by the whitelist: an exact match, or
 * a subdomain of a whitelisted domain (`"docs.example.com"` matches a
 * whitelisted `"example.com"`, but `"example.com.evil.com"` does not).
 * Returns `false` for an unparseable URL rather than throwing.
 */
export function isUrlDomainSkipped(pageUrl: string, skipDomains: string[]): boolean {
  if (skipDomains.length === 0) return false;
  let hostname: string;
  try {
    hostname = new URL(pageUrl).hostname.toLowerCase();
  } catch {
    return false;
  }
  return skipDomains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
}

/** The configured whitelist, parsed and ready for `isUrlDomainSkipped`. */
export async function getSkipDomains(): Promise<string[]> {
  return parseSkipDomains((await getSettings()).skipDomains);
}

/**
 * Checks whether `pageUrl` has already been cut into the shared evidence
 * repository, via GET `${apiBase}/api/evidence-reuse-check?url=&source=extension`.
 * The `source=extension` param tags this check in the server's reuse-check log
 * as coming from the extension rather than the web app's own "Check this page"
 * box.
 */
export async function checkPageForExistingCards(
  pageUrl: string,
  apiBase: string
): Promise<ReuseCheckResult> {
  const endpoint = `${apiBase.replace(/\/$/, '')}/api/evidence-reuse-check?url=${encodeURIComponent(
    pageUrl
  )}&source=extension`;
  const res = await fetch(endpoint, { method: 'GET' });
  if (!res.ok) {
    let detail = '';
    try {
      const payload = (await res.json()) as { error?: string };
      detail = payload?.error ?? '';
    } catch {
      // Body wasn't JSON.
    }
    throw new Error(detail || `Reuse check request failed (${res.status}).`);
  }
  const payload = (await res.json()) as Partial<ReuseCheckResult>;
  return {
    alreadyCut: Boolean(payload.alreadyCut),
    matches: Array.isArray(payload.matches) ? payload.matches : [],
  };
}
