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
import { authorizedFetch, isSignedIn } from '@/src/auth/session';
import { getSettings } from '@/src/settings/settings';

/**
 * A matched card from the Parquet card corpus, parsed server-side by
 * debate-card-parser. Mirrors `ReuseCardDetails` in
 * packages/debate-search-evidence/src/lib/parquet-card-reuse.ts.
 */
export interface ReuseCardDetails {
  cardId: number;
  tag: string;
  cite: string;
  fullcite: string;
  author: string | null;
  year: number | 'ND' | null;
  /** Highlighted runs, in card order. */
  quotes: string[];
  caselist: string;
  event: string;
  level: string;
  side: string;
  duplicateCount: number;
}

/**
 * The LLM's read of a matched card. Mirrors `CardReuseAnnotation` in
 * packages/debate-search-evidence/src/lib/card-reuse-annotation.ts.
 */
export interface CardAnnotation {
  claim: string;
  /** 0-10: how well the highlighted text supports the tag. */
  supportScore: number;
  authorQuality: {
    rating: 'strong' | 'adequate' | 'weak' | 'unknown';
    qualifications: string;
    concerns: string;
  };
  flaws: Array<{ flaw: string; severity: 'high' | 'medium' | 'low'; explanation: string }>;
}

/** One already-cut card the shared index knows about for this page. */
export interface ReuseMatch {
  id?: string;
  sourceUrl?: string;
  argBlock?: string;
  cite?: string;
  topic?: string;
  /** Present when the match came from the card corpus. */
  card?: ReuseCardDetails;
  /** Present when that card has already been annotated. */
  annotation?: CardAnnotation;
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

/**
 * The flaws/author-quality annotation for a corpus card, via
 * POST `${apiBase}/api/evidence-reuse-check/annotate`. A saved annotation is
 * served to anyone; generating a new one needs a session, so a signed-in
 * reader's bearer token is sent when there is one, and the server's "sign in"
 * message is what a signed-out reader sees for a card nobody has annotated.
 */
export async function annotateReuseCard(cardId: number, apiBase: string): Promise<CardAnnotation> {
  const path = '/api/evidence-reuse-check/annotate';
  const init: RequestInit = {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ cardId }),
  };
  const res = (await isSignedIn())
    ? await authorizedFetch(path, init)
    : await fetch(`${apiBase.replace(/\/$/, '')}${path}`, init);
  const payload = (await res.json().catch(() => ({}))) as {
    annotation?: CardAnnotation;
    error?: string;
  };
  if (!res.ok || !payload.annotation) {
    throw new Error(payload.error || `Annotation request failed (${res.status}).`);
  }
  return payload.annotation;
}
