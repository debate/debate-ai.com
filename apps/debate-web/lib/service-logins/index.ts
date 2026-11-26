/**
 * @fileoverview The site's signed-in sessions to Tabroom and openCaselist,
 * from the logins an admin saves under Admin → Service logins.
 *
 * {@link serviceSession} is one {@link ServiceSession} per service per
 * isolate, so concurrent requests share its cached token and its single
 * in-flight login. With no saved login, or while a saved one can't sign in,
 * the env secrets are the fallback: `TABROOM_API_KEY` (or
 * `TABROOM_SESSION_TOKEN`) for Tabroom, `OPENCASELIST_API_KEY` for
 * openCaselist.
 *
 * @module lib/service-logins
 */

import { parseCaselistKey } from "@debate-ai/research-evidence/src/caselist/caselist-api";
import { getDBFromContext } from "@/lib/database/context";
import { getEnv } from "@/lib/env";
import { decryptSecret } from "./crypto";
import {
  LOGIN,
  SERVICE_IDS,
  SERVICE_LABELS,
  type ServiceId,
  applyOpenCaselistToken,
  applyTabroomToken,
} from "./providers";
import { type Database, d1LoginStore, readServiceLoginRow } from "./store";
import { ServiceSession } from "./session";

export { SERVICE_IDS, SERVICE_LABELS, isServiceId, type ServiceId } from "./providers";
export { ServiceLoginError, ServiceSession } from "./session";

/** The env vars the Tabroom session is read from when no login is saved, first match wins. */
export const TABROOM_TOKEN_ENV = ["TABROOM_API_KEY", "TABROOM_SESSION_TOKEN"] as const;

/** The secret service logins are encrypted with. */
export function serviceLoginSecret(): string {
  return getEnv("SERVICE_LOGINS_SECRET") || getEnv("BETTER_AUTH_SECRET") || "dev-secret-change-in-production";
}

/** The Tabroom token from `TABROOM_API_KEY` / `TABROOM_SESSION_TOKEN`, or `null`. */
export function tabroomEnvToken(): string | null {
  for (const key of TABROOM_TOKEN_ENV) {
    const token = getEnv(key)?.trim();
    if (token) return token;
  }
  return null;
}

/** `OPENCASELIST_API_KEY` when it is a `caselist_token` (not a `username:password` login). */
export function openCaselistEnvToken(): string | null {
  const key = parseCaselistKey(getEnv("OPENCASELIST_API_KEY"));
  return key && "token" in key ? key.token : null;
}

const FALLBACK: Record<ServiceId, () => string | null> = {
  tabroom: tabroomEnvToken,
  opencaselist: openCaselistEnvToken,
};

const APPLY: Record<ServiceId, (headers: Headers, token: string) => void> = {
  tabroom: (headers, token) => applyTabroomToken(headers, token, getEnv("TABROOM_COOKIE_NAME")?.trim() || undefined),
  opencaselist: applyOpenCaselistToken,
};

const sessions = new Map<ServiceId, ServiceSession>();

/** The isolate's session for `service`. */
export function serviceSession(service: ServiceId): ServiceSession {
  let session = sessions.get(service);
  if (!session) {
    session = new ServiceSession({
      label: SERVICE_LABELS[service],
      store: d1LoginStore(service, getDBFromContext, serviceLoginSecret),
      login: (username, password) => LOGIN[service](username, password),
      applyToken: APPLY[service],
      fallbackToken: FALLBACK[service],
    });
    sessions.set(service, session);
  }
  return session;
}

/** Drops every isolate session (tests, and after an admin changes a login). */
export function resetServiceSessions(service?: ServiceId): void {
  if (service) sessions.get(service)?.reset();
  else sessions.clear();
}

/** What the admin panel shows for one service. Never holds the password or token. */
export interface ServiceLoginStatus {
  service: ServiceId;
  label: string;
  /** A username and password are saved (and readable with the current secret). */
  configured: boolean;
  username: string | null;
  /** A saved session token that hasn't expired. */
  connected: boolean;
  lastLoginAt: number | null;
  expiresAt: number | null;
  lastError: string | null;
  lastFailureAt: number | null;
  /** When the next automatic login may run after failures (ms); `null` when it may now. */
  retryAt: number | null;
  /** The env secret the service falls back to is set. */
  envFallback: boolean;
  updatedAt: number | null;
  updatedBy: string | null;
}

export async function serviceLoginStatus(db: Database, service: ServiceId, now = Date.now()): Promise<ServiceLoginStatus> {
  const row = await readServiceLoginRow(db, service);
  const secret = serviceLoginSecret();
  const password = row ? await decryptSecret(row.passwordEnc, secret) : null;
  const token = row ? await decryptSecret(row.tokenEnc, secret) : null;
  const unreadable = Boolean(row?.passwordEnc && !password);
  const expired = row?.tokenExpiresAt != null && now >= row.tokenExpiresAt;
  const retryAfter = row ? serviceSession(service).retryAfterMs({ ...row, password, token }) : 0;
  return {
    service,
    label: SERVICE_LABELS[service],
    configured: Boolean(row?.username && password),
    username: row?.username ?? null,
    connected: Boolean(token) && !expired,
    lastLoginAt: row?.lastLoginAt ?? null,
    expiresAt: row?.tokenExpiresAt ?? null,
    lastError: unreadable ? "The saved login can't be decrypted (the server secret changed). Enter it again." : (row?.lastError ?? null),
    lastFailureAt: row?.lastFailureAt ?? null,
    retryAt: retryAfter > 0 ? now + retryAfter : null,
    envFallback: Boolean(FALLBACK[service]() || (service === "opencaselist" && getEnv("OPENCASELIST_API_KEY"))),
    updatedAt: row?.updatedAt ?? null,
    updatedBy: row?.updatedBy ?? null,
  };
}

export async function allServiceLoginStatuses(db: Database): Promise<ServiceLoginStatus[]> {
  return Promise.all(SERVICE_IDS.map((service) => serviceLoginStatus(db, service)));
}
