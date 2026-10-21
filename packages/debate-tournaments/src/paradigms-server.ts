/**
 * Fetches judges' paradigms and judging records from live Tabroom, for the
 * host app's paradigm cache and its admin sync. Server-only: it sends a
 * Tabroom session cookie and sanitizes HTML with `sanitize-html`.
 *
 * Every paradigm route on Tabroom wants a signed-in user — the API's
 * `paradigmsRouter` answers 401 to anyone else, and the classic
 * `index/paradigm.mhtml` redirects to the login page — so each call takes the
 * session token of a Tabroom account the site signs in as. Without one,
 * {@link fetchTabroomJudge} answers `unauthorized` rather than guessing.
 *
 * The API is tried first. When it refuses or fails, the classic page is read
 * with the same cookie, since it holds both the paradigm and the record.
 */

/// <reference path="./sanitize-html.d.ts" />

import sanitizeHtml from "sanitize-html";
import {
  isTabroomLoginPage,
  parseClassicParadigmPage,
  readJudgeRecord,
  readParadigmDetails,
  tabroomParadigmPageUrl,
  type JudgeProfile,
} from "./paradigms";

export const TABROOM_API_V1 = "https://api.tabroom.com/v1";
/** The session cookie Tabroom's API and classic site both read. */
export const DEFAULT_TABROOM_COOKIE = "TabroomToken";
const TIMEOUT_MS = 12_000;

/** A Tabroom session to read paradigms as. */
export interface TabroomCredentials {
  token: string;
  /** The cookie's name; {@link DEFAULT_TABROOM_COOKIE} unless Tabroom renames it. */
  cookieName?: string;
}

export interface TabroomFetchOptions {
  credentials?: TabroomCredentials | null;
  fetchImpl?: typeof fetch;
}

export type TabroomJudgeResult =
  | { ok: true; profile: JudgeProfile }
  | { ok: false; reason: "unauthorized" | "not-found" | "unreachable"; detail?: string };

/** Tags and attributes a paradigm keeps: Tabroom's editor writes basic rich text. */
export function sanitizeParadigmHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ["p", "br", "hr", "b", "strong", "i", "em", "u", "s", "strike", "sub", "sup", "blockquote", "code", "pre", "ul", "ol", "li", "h1", "h2", "h3", "h4", "h5", "h6", "a", "span", "div", "table", "thead", "tbody", "tr", "th", "td"],
    allowedAttributes: { a: ["href", "title", "target", "rel"], td: ["colspan", "rowspan"], th: ["colspan", "rowspan"] },
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: { a: sanitizeHtml.simpleTransform("a", { target: "_blank", rel: "noopener noreferrer nofollow" }, true) },
  }).trim();
}

function headers(credentials: TabroomCredentials | null | undefined, accept: string): HeadersInit {
  const out: Record<string, string> = { accept, "user-agent": "debate-ai.com paradigm sync" };
  if (credentials?.token) out.cookie = `${credentials.cookieName || DEFAULT_TABROOM_COOKIE}=${credentials.token}`;
  return out;
}

async function getJson(url: string, options: TabroomFetchOptions): Promise<{ status: number; body: unknown }> {
  const res = await (options.fetchImpl ?? fetch)(url, { headers: headers(options.credentials, "application/json"), signal: AbortSignal.timeout(TIMEOUT_MS) });
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // An error page instead of JSON: the status says enough.
  }
  return { status: res.status, body };
}

/** Reads one judge through the API: paradigm (404 when they have none) and record. */
async function fromApi(personId: number, options: TabroomFetchOptions): Promise<TabroomJudgeResult> {
  const [details, record] = await Promise.all([
    getJson(`${TABROOM_API_V1}/rest/paradigms/${personId}`, options),
    getJson(`${TABROOM_API_V1}/rest/paradigms/${personId}/record`, options),
  ]);
  if (details.status === 401 || details.status === 403 || record.status === 401 || record.status === 403) {
    return { ok: false, reason: "unauthorized", detail: `Tabroom API answered ${details.status}` };
  }
  if (record.status !== 200 && details.status !== 200) {
    return { ok: false, reason: details.status === 404 ? "not-found" : "unreachable", detail: `Tabroom API answered ${details.status}` };
  }
  const paradigm = details.status === 200 ? readParadigmDetails(details.body) : null;
  const rows = record.status === 200 ? readJudgeRecord(record.body) : [];
  if (!paradigm && rows.length === 0) return { ok: false, reason: "not-found" };
  return {
    ok: true,
    profile: {
      personId,
      name: paradigm?.name ?? "",
      paradigmHtml: paradigm?.paradigm ? sanitizeParadigmHtml(paradigm.paradigm) || null : null,
      lastReviewed: paradigm?.lastReviewed ?? null,
      record: rows,
      certifications: paradigm?.certifications ?? [],
      source: "tabroom-api",
      syncedAt: new Date().toISOString(),
    },
  };
}

/** Reads one judge off the classic paradigm page. */
async function fromPage(personId: number, options: TabroomFetchOptions): Promise<TabroomJudgeResult> {
  const res = await (options.fetchImpl ?? fetch)(tabroomParadigmPageUrl(personId), {
    headers: headers(options.credentials, "text/html"),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) return { ok: false, reason: res.status === 404 ? "not-found" : "unreachable", detail: `tabroom.com answered ${res.status}` };
  const html = await res.text();
  if (/\/user\/login\//.test(res.url) || isTabroomLoginPage(html)) return { ok: false, reason: "unauthorized", detail: "tabroom.com asked to sign in" };
  const page = parseClassicParadigmPage(html);
  if (!page.name && !page.paradigmHtml && page.record.length === 0) return { ok: false, reason: "not-found" };
  return {
    ok: true,
    profile: {
      personId,
      name: page.name ?? "",
      paradigmHtml: page.paradigmHtml ? sanitizeParadigmHtml(page.paradigmHtml) || null : null,
      lastReviewed: page.lastReviewed,
      record: page.record,
      certifications: [],
      source: "tabroom-page",
      syncedAt: new Date().toISOString(),
    },
  };
}

/**
 * A judge's paradigm and judging record from live Tabroom: the API, then the
 * classic page. Answers `unauthorized` straight away without credentials,
 * since both refuse anonymous readers.
 */
export async function fetchTabroomJudge(personId: number, options: TabroomFetchOptions = {}): Promise<TabroomJudgeResult> {
  if (!Number.isInteger(personId) || personId <= 0) return { ok: false, reason: "not-found" };
  if (!options.credentials?.token) return { ok: false, reason: "unauthorized", detail: "No Tabroom session is configured" };
  let api: TabroomJudgeResult;
  try {
    api = await fromApi(personId, options);
  } catch (error) {
    api = { ok: false, reason: "unreachable", detail: (error as Error).message };
  }
  if (api.ok || api.reason === "not-found") return api;
  try {
    const page = await fromPage(personId, options);
    return page.ok ? page : api;
  } catch {
    return api;
  }
}

/** One row of the API's paradigm search. */
export interface TabroomParadigmHit {
  id: number;
  name: string;
  tournJudged: number;
}

/**
 * One page of `GET /rest/paradigms?search=&limit=&offset=` — every judge
 * with a current paradigm whose name matches `search` (all of them for an
 * empty search). The admin sync walks it to find who to fetch.
 */
export async function searchTabroomParadigms(
  search: string,
  page: { limit?: number; offset?: number },
  options: TabroomFetchOptions,
): Promise<{ ok: true; hits: TabroomParadigmHit[] } | { ok: false; reason: "unauthorized" | "unreachable"; detail?: string }> {
  if (!options.credentials?.token) return { ok: false, reason: "unauthorized", detail: "No Tabroom session is configured" };
  const url = new URL(`${TABROOM_API_V1}/rest/paradigms`);
  url.searchParams.set("search", search);
  url.searchParams.set("limit", String(Math.min(100, Math.max(1, page.limit ?? 100))));
  url.searchParams.set("offset", String(Math.max(0, page.offset ?? 0)));
  let result: { status: number; body: unknown };
  try {
    result = await getJson(url.toString(), options);
  } catch (error) {
    return { ok: false, reason: "unreachable", detail: (error as Error).message };
  }
  if (result.status === 401 || result.status === 403) return { ok: false, reason: "unauthorized", detail: `Tabroom API answered ${result.status}` };
  if (result.status !== 200 || !Array.isArray(result.body)) return { ok: false, reason: "unreachable", detail: `Tabroom API answered ${result.status}` };
  const hits = result.body.flatMap((row) => {
    const r = row as Record<string, unknown> | null;
    return r && typeof r.id === "number" ? [{ id: r.id, name: typeof r.name === "string" ? r.name : "", tournJudged: typeof r.tournJudged === "number" ? r.tournJudged : 0 }] : [];
  });
  return { ok: true, hits };
}
