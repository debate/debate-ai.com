/**
 * @fileoverview How the site logs into Tabroom and openCaselist with a
 * username and password, and which cookie each session travels in.
 *
 * - Tabroom: `POST https://api.tabroom.com/v1/auth/login` with
 *   `{ username, password }` answers `{ token }` and sets the `TabroomToken`
 *   cookie (indexcards' `authController.login`). The cookie has no expiry,
 *   so a Tabroom session is replaced only when Tabroom rejects it.
 * - openCaselist: `POST https://api.opencaselist.com/v1/login` with a
 *   Tabroom login sets the `caselist_token` cookie, with an expiry.
 *
 * @module lib/service-logins/providers
 */

import { tabroomCookie } from "@debate-ai/tournaments/server";
import { CASELIST_API_ORIGIN, CASELIST_TOKEN_COOKIE } from "@debate-ai/research-evidence/src/caselist/caselist-api";
import { type LoginResult, ServiceLoginError } from "./session";

export const SERVICE_IDS = ["tabroom", "opencaselist"] as const;
export type ServiceId = (typeof SERVICE_IDS)[number];

export function isServiceId(value: unknown): value is ServiceId {
  return typeof value === "string" && (SERVICE_IDS as readonly string[]).includes(value);
}

export const SERVICE_LABELS: Record<ServiceId, string> = {
  tabroom: "Tabroom",
  opencaselist: "openCaselist",
};

export const TABROOM_LOGIN_URL = "https://api.tabroom.com/v1/auth/login";
export const OPENCASELIST_LOGIN_URL = `${CASELIST_API_ORIGIN}/login`;
const LOGIN_TIMEOUT_MS = 15_000;

/** Every `Set-Cookie` header of a response, one per cookie. */
export function setCookieHeaders(headers: Headers): string[] {
  const all = (headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.();
  if (all && all.length > 0) return all;
  const joined = headers.get("set-cookie");
  // A joined header separates cookies with ", " — but `Expires` dates hold commas too.
  return joined ? joined.split(/,(?=\s*[^;,=\s]+=)/).map((part) => part.trim()) : [];
}

/** The named cookie's value and expiry (ms, from `Max-Age` or `Expires`) in a response's `Set-Cookie`. */
export function readSetCookie(headers: Headers, name: string, now = Date.now()): { value: string; expiresAt: number | null } | null {
  for (const header of setCookieHeaders(headers)) {
    const [pair, ...attributes] = header.split(";");
    const eq = pair.indexOf("=");
    if (eq < 0 || pair.slice(0, eq).trim() !== name) continue;
    let value = pair.slice(eq + 1).trim();
    try {
      value = decodeURIComponent(value);
    } catch {
      // Not URL-encoded: keep it raw.
    }
    let expiresAt: number | null = null;
    for (const attribute of attributes) {
      const [key, ...rest] = attribute.split("=");
      const attrValue = rest.join("=").trim();
      if (key.trim().toLowerCase() === "max-age" && /^-?\d+$/.test(attrValue)) {
        expiresAt = now + Number(attrValue) * 1000;
        break;
      }
      if (key.trim().toLowerCase() === "expires") {
        const parsed = Date.parse(attrValue);
        if (Number.isFinite(parsed)) expiresAt = parsed;
      }
    }
    if (!value) return null;
    return { value, expiresAt };
  }
  return null;
}

async function postLogin(label: string, url: string, body: Record<string, unknown>, fetchImpl: typeof fetch): Promise<Response> {
  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json", "user-agent": "debate-ai.com" },
      body: JSON.stringify(body),
      redirect: "manual",
      signal: AbortSignal.timeout(LOGIN_TIMEOUT_MS),
    });
  } catch (error) {
    throw new ServiceLoginError(`${label} login could not reach the server: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (response.status === 401 || response.status === 403) {
    throw new ServiceLoginError(`${label} refused the username or password (${response.status}).`, response.status);
  }
  if (!response.ok) throw new ServiceLoginError(`${label} login failed (${response.status}).`, response.status);
  return response;
}

/** Logs into Tabroom's API; the token is the `TabroomToken` session value. */
export async function loginTabroom(username: string, password: string, fetchImpl: typeof fetch = fetch): Promise<LoginResult> {
  const response = await postLogin("Tabroom", TABROOM_LOGIN_URL, { username, password }, fetchImpl);
  const cookie = readSetCookie(response.headers, "TabroomToken");
  const body = (await response.json().catch(() => null)) as { token?: unknown } | null;
  const token = cookie?.value || (typeof body?.token === "string" ? body.token : "");
  if (!token) throw new ServiceLoginError("Tabroom login returned no session token.");
  return { token, expiresAt: cookie?.expiresAt ?? null };
}

/** Logs into openCaselist (with a Tabroom login); the token is the `caselist_token` cookie. */
export async function loginOpenCaselist(username: string, password: string, fetchImpl: typeof fetch = fetch): Promise<LoginResult> {
  const response = await postLogin("openCaselist", OPENCASELIST_LOGIN_URL, { username, password, remember: true }, fetchImpl);
  const cookie = readSetCookie(response.headers, CASELIST_TOKEN_COOKIE);
  const body = (await response.json().catch(() => null)) as { token?: unknown } | null;
  const token = cookie?.value || (typeof body?.token === "string" ? body.token : "");
  if (!token) throw new ServiceLoginError("openCaselist login returned no session token.");
  return { token, expiresAt: cookie?.expiresAt ?? null };
}

/** Puts a Tabroom session on a request (`TabroomToken`, or `cookieName`). */
export function applyTabroomToken(headers: Headers, token: string, cookieName?: string): void {
  headers.set("cookie", tabroomCookie({ token, cookieName }));
}

/** Puts an openCaselist session on a request. */
export function applyOpenCaselistToken(headers: Headers, token: string): void {
  headers.set("cookie", `${CASELIST_TOKEN_COOKIE}=${token}`);
}

export const LOGIN: Record<ServiceId, (username: string, password: string, fetchImpl?: typeof fetch) => Promise<LoginResult>> = {
  tabroom: loginTabroom,
  opencaselist: loginOpenCaselist,
};
