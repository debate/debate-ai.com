/**
 * @fileoverview Shared plumbing for the `/api/admin/env/*` routes: the admin
 * guard (the same one as every other admin route), JSON responses that are
 * never cached, and loading the saved credentials.
 */

import { NextResponse } from "next/server";
import { getAdminAccess } from "@/lib/auth/admin";
import { getDBFromContext } from "@/lib/database/context";
import { redact } from "./redact";
import type { CloudflareCredentials } from "./cloudflare";
import type { GithubCredentials } from "./github";
import { type EnvManagerConfig, cooldownRemaining, loadConfig } from "./store";

const noStore = { "Cache-Control": "no-store" };

export function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return NextResponse.json(body, { status, headers: { ...noStore, ...headers } });
}

/** An error response; the message is redacted for any token it might quote. */
export function fail(message: unknown, status: number, secrets: Array<string | null | undefined> = [], extra: Record<string, unknown> = {}) {
  return json({ error: redact(message, secrets), ...extra }, status);
}

/** Admins only (ADMIN_EMAIL / ADMIN_EMAILS). Moderators and signed-out visitors get null. */
export async function adminOnly(): Promise<{ email: string | null } | null> {
  const { isAdmin, email } = await getAdminAccess();
  return isAdmin ? { email } : null;
}

export const forbidden = () => json({ error: "Forbidden" }, 403);

export function cloudflareCreds(config: EnvManagerConfig): CloudflareCredentials | null {
  const { token, accountId, script } = config.cloudflare;
  return token && accountId ? { token, accountId, script } : null;
}

export function githubCreds(config: EnvManagerConfig): GithubCredentials | null {
  const { token, ...rest } = config.github;
  return token ? { token, ...rest } : null;
}

export async function loadAll() {
  const db = await getDBFromContext();
  const config = await loadConfig(db);
  return { db, config, cf: cloudflareCreds(config), gh: githubCreds(config) };
}

export function secretsOf(config: EnvManagerConfig): string[] {
  return [config.cloudflare.token, config.github.token].filter((s): s is string => Boolean(s));
}

/** 429 when `action` ran inside its window. */
export async function throttle(db: Awaited<ReturnType<typeof getDBFromContext>>, action: string, windowMs: number) {
  const wait = await cooldownRemaining(db, action, windowMs);
  return wait > 0 ? json({ error: `Slow down: try again in ${wait}s.` }, 429, { "Retry-After": String(wait) }) : null;
}
