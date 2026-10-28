/**
 * @fileoverview Judge paradigms on this site — the wire format of
 * `/api/judge-paradigms` and `/api/admin/judge-paradigms`, and the checks
 * both ends share.
 *
 * ## What the feature is made of
 *
 * - **The paradigm cache** (`judge_paradigms`): each Tabroom judge's
 *   paradigm and judging record, fetched from Tabroom's API with the site's
 *   own Tabroom session and kept so pairings open instantly. Filled on demand
 *   when a judge is clicked, and in bulk by the admin sync.
 * - **Own paradigms** (`judge_own_paradigms`): one per account, written in
 *   Markdown in the paradigm editor. It is shown in place of the Tabroom one
 *   only once the account is verified as that Tabroom judge — by putting a
 *   code in their Tabroom paradigm, or by an admin — so nobody can publish a
 *   paradigm under someone else's name.
 *
 * @module debate-tournaments/judge-paradigms/types
 */

/** Longest paradigm the editor accepts, in characters of Markdown. */
export const MAX_PARADIGM_LENGTH = 30_000;

/** How long a cached Tabroom paradigm is served before it is fetched again. */
export const PARADIGM_REFRESH_MS = 7 * 24 * 60 * 60 * 1000;

/** The viewer's own paradigm, as `GET /api/judge-paradigms/me` answers it. */
export interface OwnParadigm {
  /** The Tabroom judge this account says it is, or `null`. */
  tabroomPersonId: number | null;
  /** Whether that link has been verified; only then is the paradigm shown to others. */
  verified: boolean;
  /** Put this anywhere in your Tabroom paradigm, then verify. */
  verifyCode: string;
  markdown: string;
  /** The Markdown rendered and sanitized, as others see it. */
  html: string;
  /** ISO time of the last save, or `null` before the first. */
  updatedAt: string | null;
}

/** What the paradigm editor saves: `PUT /api/judge-paradigms/me`. */
export interface OwnParadigmInput {
  tabroomPersonId: number | null;
  markdown: string;
}

/** A claim waiting on an admin: an account linked to a Tabroom judge but not yet verified. */
export interface ParadigmClaim {
  userId: string;
  userName: string;
  userEmail: string;
  tabroomPersonId: number;
  /** The judge's name in the paradigm cache, when synced. */
  tabroomName: string | null;
  verified: boolean;
  updatedAt: string;
}

/** `GET /api/admin/judge-paradigms`. */
export interface ParadigmSyncStatus {
  /** Whether a Tabroom session is configured — without one Tabroom refuses every paradigm read. */
  credentialsConfigured: boolean;
  cached: number;
  withParadigm: number;
  failed: number;
  /** Cached judges older than the refresh window. */
  stale: number;
  /** Where the discovery walk over Tabroom's paradigm search has got to. */
  discoveryOffset: number;
  discoveryDone: boolean;
  lastRunAt: string | null;
  lastError: string | null;
  claims: ParadigmClaim[];
}

/** One batch of the admin sync: `POST /api/admin/judge-paradigms`. */
export interface ParadigmSyncBatch {
  mode: "discover" | "refresh";
  /** Judges fetched from Tabroom in this batch. */
  fetched: number;
  saved: number;
  failed: number;
  /** For `discover`: the next search offset, or `null` when the walk is done. */
  nextOffset: number | null;
  /** For `refresh`: stale judges left after this batch. */
  remaining: number;
  error: string | null;
}

/** A Tabroom person id from a number, a numeric string, or a paradigm URL. */
export function parseTabroomPersonId(value: unknown): number | null {
  if (typeof value === "number") return Number.isInteger(value) && value > 0 && value < 1e10 ? value : null;
  if (typeof value !== "string") return null;
  const text = value.trim();
  const match = /judge_person_id=(\d+)/.exec(text) ?? /^(\d+)$/.exec(text) ?? /\/paradigms?\/(\d+)/.exec(text);
  const id = match ? Number(match[1]) : NaN;
  return Number.isInteger(id) && id > 0 && id < 1e10 ? id : null;
}

/** Checks a `PUT /api/judge-paradigms/me` body. */
export function parseOwnParadigmInput(body: unknown): { ok: true; value: OwnParadigmInput } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "Send { tabroomPersonId, markdown }." };
  const raw = body as Record<string, unknown>;
  if (typeof raw.markdown !== "string") return { ok: false, error: "The paradigm must be text." };
  if (raw.markdown.length > MAX_PARADIGM_LENGTH) {
    return { ok: false, error: `Keep the paradigm under ${MAX_PARADIGM_LENGTH.toLocaleString("en-US")} characters.` };
  }
  const blank = raw.tabroomPersonId === null || raw.tabroomPersonId === undefined || raw.tabroomPersonId === "";
  const tabroomPersonId = blank ? null : parseTabroomPersonId(raw.tabroomPersonId);
  if (!blank && tabroomPersonId === null) return { ok: false, error: "That isn't a Tabroom judge id or paradigm link." };
  return { ok: true, value: { tabroomPersonId, markdown: raw.markdown.replace(/\r\n/g, "\n") } };
}

/** `"Jane Q. Doe"` → `{ first: "jane", last: "doe" }`, lower-cased, for matching names across sources. */
export function nameKey(name: string): { first: string; last: string } {
  const parts = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  return { first: parts[0] ?? "", last: parts.length > 1 ? parts[parts.length - 1] : "" };
}

/** Whether a Tabroom paradigm (HTML or text) carries an account's verification code. */
export function paradigmHasCode(paradigm: string | null | undefined, code: string): boolean {
  return Boolean(paradigm && code && paradigm.replace(/<[^>]*>/g, " ").includes(code));
}
