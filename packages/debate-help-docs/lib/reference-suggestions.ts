/**
 * @file reference-suggestions.ts
 * @description The rules the "suggest the full text" dialog on a References
 * entry (`components/guides/reference-quote-status.tsx`) and the app's
 * `POST /api/reference-quote-suggestions` share: field limits, the cleaning of
 * what a visitor typed, and the checks that turn away obvious junk.
 *
 * Anyone, signed in or not, may suggest text, so everything here assumes a
 * hostile caller: the reference is identified only by its docs page path and
 * its `ref-…` anchor id, text is capped and stripped of control characters,
 * links are limited, and a hidden honeypot field catches form-filling bots.
 * Suggestions are only ever shown as plain text in the admin panel.
 *
 * No imports, so the client dialog, the API route and the tests all use it.
 */

/** Longest suggested card text, in characters (a long card with its context). */
export const MAX_SUGGESTION_TEXT_LENGTH = 20_000;
/** Shortest text worth reviewing: a sentence, not a word. */
export const MIN_SUGGESTION_TEXT_LENGTH = 40;
export const MIN_SUGGESTION_WORDS = 8;
export const MAX_SUGGESTION_TITLE_LENGTH = 500;
/** Links allowed in one suggestion; a pasted card rarely needs more than its source. */
export const MAX_SUGGESTION_LINKS = 3;

/** One anonymous sender may file this many suggestions per window. */
export const SUGGESTION_RATE_LIMIT = { perHour: 5, perDay: 20 } as const;
/** Pending suggestions kept per reference; past this, new ones wait until an admin clears some. */
export const MAX_PENDING_PER_REFERENCE = 25;

/** A docs page path, `/docs/journal/synergy-slayer-critiques/references`. */
const PAGE_PATTERN = /^\/docs\/[A-Za-z0-9][A-Za-z0-9\-_/]{0,180}$/;
/** An entry's anchor id on its References page, `ref-ackerman-2020`. */
const REF_ID_PATTERN = /^ref-[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const SUGGESTION_STATUSES = ['pending', 'approved', 'dismissed'] as const;
export type SuggestionStatus = (typeof SUGGESTION_STATUSES)[number];

export function isSuggestionStatus(value: unknown): value is SuggestionStatus {
  return typeof value === 'string' && (SUGGESTION_STATUSES as readonly string[]).includes(value);
}

/** A validated suggestion, ready to store. */
export interface ReferenceSuggestionInput {
  /** The docs page the entry is on, without a hash. */
  page: string;
  /** The entry's anchor id on that page. */
  refId: string;
  /** The entry's bibliography line as plain text, so the admin can recognise it. */
  title: string;
  text: string;
}

export type ParsedSuggestion =
  | { ok: true; value: ReferenceSuggestionInput }
  | { ok: false; error: string; /** A bot filled the honeypot; answer as if it worked. */ honeypot?: boolean };

/** Drops control characters (keeping tabs and newlines) and normalises line endings. */
export function cleanSuggestionText(value: string): string {
  return value
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
}

function field(raw: Record<string, unknown>, key: string): string {
  const value = raw[key];
  return typeof value === 'string' ? cleanSuggestionText(value) : '';
}

/** `{ page, refId }` from a `/docs/…/references#ref-…` link, or undefined when it is not one. */
export function splitReferenceHref(href: string): { page: string; refId: string } | undefined {
  const hash = href.indexOf('#');
  if (hash < 0) return undefined;
  const page = href.slice(0, hash).replace(/\/+$/, '');
  const refId = href.slice(hash + 1);
  return PAGE_PATTERN.test(page) && REF_ID_PATTERN.test(refId) && refId.length <= 120 ? { page, refId } : undefined;
}

function countLinks(text: string): number {
  return (text.match(/(?:https?:\/\/|www\.)\S+/gi) ?? []).length;
}

/** Checks a request body; returns the cleaned suggestion or the first problem. */
export function parseReferenceSuggestion(body: unknown): ParsedSuggestion {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'Send the reference and the text you are suggesting.' };
  }
  const raw = body as Record<string, unknown>;

  if (typeof raw.website === 'string' && raw.website.trim() !== '') {
    return { ok: false, error: 'Could not send that.', honeypot: true };
  }

  const page = typeof raw.page === 'string' ? raw.page.trim().replace(/\/+$/, '') : '';
  const refId = typeof raw.refId === 'string' ? raw.refId.trim() : '';
  if (!PAGE_PATTERN.test(page) || !REF_ID_PATTERN.test(refId) || refId.length > 120) {
    return { ok: false, error: 'That reference could not be identified.' };
  }

  const text = field(raw, 'text');
  if (!text) return { ok: false, error: 'Paste the card text first.' };
  if (text.length > MAX_SUGGESTION_TEXT_LENGTH) {
    return {
      ok: false,
      error: `The text is limited to ${MAX_SUGGESTION_TEXT_LENGTH.toLocaleString('en-US')} characters.`,
    };
  }
  const words = text.split(/\s+/).filter(Boolean).length;
  if (text.length < MIN_SUGGESTION_TEXT_LENGTH || words < MIN_SUGGESTION_WORDS) {
    return { ok: false, error: 'That is too short to be a card. Paste the quoted passage.' };
  }
  if (countLinks(text) > MAX_SUGGESTION_LINKS) {
    return { ok: false, error: 'Too many links in the text. Paste only the card text.' };
  }

  const title = field(raw, 'title').replace(/\s+/g, ' ').slice(0, MAX_SUGGESTION_TITLE_LENGTH);

  return { ok: true, value: { page, refId, title, text } };
}

/** "in 1 hour" / "in 12 minutes" / "in a minute" for a wait of `seconds`. */
export function describeSuggestionWait(seconds: number): string {
  const minutes = Math.ceil(Math.max(0, seconds) / 60);
  if (minutes >= 120) return `in ${Math.ceil(minutes / 60)} hours`;
  if (minutes >= 60) return 'in 1 hour';
  if (minutes <= 1) return 'in a minute';
  return `in ${minutes} minutes`;
}

/** One row of `GET /api/admin/reference-suggestions`. */
export interface AdminReferenceSuggestion {
  id: string;
  page: string;
  refId: string;
  title: string;
  text: string;
  status: SuggestionStatus;
  userId: string | null;
  userName: string | null;
  createdAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
}
