/**
 * @fileoverview The slice of the Cloudflare API Admin → Environment uses: read
 * a Worker's settings, and change its variables and secrets.
 *
 * Cloudflare's `PATCH /accounts/:id/workers/scripts/:script/settings` takes the
 * COMPLETE bindings list: any binding left out of it is removed (D1, R2, KV,
 * Durable Objects, AI, assets, secrets). So `buildBindings` re-sends every
 * plain-text / JSON variable it knows the value of and marks every other
 * binding `{ type: "inherit" }` so it carries over from the current version
 * untouched, and `applyVarChanges` re-reads the settings afterwards and fails
 * loudly if a binding that should have survived is gone.
 */

import { redact } from "./redact";

const API = "https://api.cloudflare.com/client/v4";

export type VarKind = "plain_text" | "secret_text" | "json";
export const VAR_KINDS: readonly VarKind[] = ["plain_text", "secret_text", "json"];

export interface CloudflareCredentials {
  token: string;
  accountId: string;
  script: string;
}

export class CloudflareError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly codes: number[] = [],
  ) {
    super(message);
    this.name = "CloudflareError";
  }
}

interface ApiEnvelope<T> {
  success?: boolean;
  errors?: Array<{ code?: number; message?: string }>;
  result?: T;
}

async function call<T>(creds: CloudflareCredentials, path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      ...init,
      headers: { ...(init.headers as Record<string, string> | undefined), Authorization: `Bearer ${creds.token}` },
    });
  } catch (error) {
    throw new CloudflareError(`Could not reach Cloudflare: ${redact(error, [creds.token])}`, 0);
  }
  const body = (await res.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (!res.ok || body?.success === false) {
    const errors = body?.errors ?? [];
    const message = errors.map((e) => e.message).filter(Boolean).join("; ") || `Cloudflare answered ${res.status}.`;
    throw new CloudflareError(redact(message, [creds.token]), res.status, errors.map((e) => e.code ?? 0));
  }
  return (body?.result ?? null) as T;
}

/** A binding as `GET .../settings` returns it. Secrets carry no `text`. */
export interface Binding {
  name: string;
  type: string;
  text?: string;
  json?: unknown;
  [key: string]: unknown;
}

export interface ScriptSettings {
  bindings: Binding[];
}

export async function getScriptSettings(creds: CloudflareCredentials): Promise<ScriptSettings> {
  const result = await call<{ bindings?: Binding[] }>(
    creds,
    `/accounts/${creds.accountId}/workers/scripts/${encodeURIComponent(creds.script)}/settings`,
  );
  return { bindings: Array.isArray(result?.bindings) ? result.bindings : [] };
}

export type Change = { op: "set"; name: string; kind: VarKind; value: string } | { op: "delete"; name: string };

const VAR_TYPES = new Set<string>(VAR_KINDS);

/** The bindings to PATCH: unchanged variables echoed, everything else inherited, then the new values. */
export function buildBindings(current: Binding[], changes: Change[]): Array<Record<string, unknown>> {
  const touched = new Set(changes.map((change) => change.name));
  const next: Array<Record<string, unknown>> = [];
  for (const binding of current) {
    if (touched.has(binding.name)) continue;
    if (binding.type === "plain_text" && typeof binding.text === "string") {
      next.push({ type: "plain_text", name: binding.name, text: binding.text });
    } else if (binding.type === "json" && binding.json !== undefined) {
      next.push({ type: "json", name: binding.name, json: binding.json });
    } else {
      next.push({ type: "inherit", name: binding.name });
    }
  }
  for (const change of changes) {
    if (change.op !== "set") continue;
    if (change.kind === "json") next.push({ type: "json", name: change.name, json: JSON.parse(change.value) });
    else next.push({ type: change.kind, name: change.name, text: change.value });
  }
  return next;
}

export async function patchBindings(creds: CloudflareCredentials, bindings: Array<Record<string, unknown>>): Promise<void> {
  const form = new FormData();
  form.set("settings", JSON.stringify({ bindings }));
  await call(creds, `/accounts/${creds.accountId}/workers/scripts/${encodeURIComponent(creds.script)}/settings`, {
    method: "PATCH",
    body: form,
  });
}

export class BindingsLostError extends Error {
  constructor(readonly lost: string[]) {
    super(
      `After the update these bindings are missing from the Worker: ${lost.join(", ")}. ` +
        "Roll back in the Cloudflare dashboard (Workers → Deployments → Rollback) and report this.",
    );
    this.name = "BindingsLostError";
  }
}

/** Applies variable changes through one PATCH, then checks no other binding went missing. */
export async function applyVarChanges(creds: CloudflareCredentials, changes: Change[]): Promise<{ before: Binding[]; after: Binding[] }> {
  const before = (await getScriptSettings(creds)).bindings;
  await patchBindings(creds, buildBindings(before, changes));
  const after = (await getScriptSettings(creds)).bindings;
  const afterNames = new Set(after.map((binding) => binding.name));
  const deleted = new Set(changes.filter((change) => change.op === "delete").map((change) => change.name));
  const lost = before.filter((binding) => !deleted.has(binding.name) && !afterNames.has(binding.name)).map((binding) => binding.name);
  const missingNew = changes.filter((change) => change.op === "set" && !afterNames.has(change.name)).map((change) => change.name);
  if (lost.length || missingNew.length) throw new BindingsLostError([...lost, ...missingNew]);
  return { before, after };
}

export interface Check {
  name: string;
  ok: boolean | null;
  detail: string;
}

export interface ConnectionTest {
  ok: boolean;
  checks: Check[];
  /** Permissions the token still needs, named as in the Cloudflare token editor. */
  missing: string[];
}

export const CLOUDFLARE_REQUIRED = ["Account · Workers Scripts · Edit"] as const;

/** Validates the token and what it can reach, without changing anything. */
export async function testCloudflare(creds: CloudflareCredentials): Promise<ConnectionTest> {
  const checks: Check[] = [];
  const missing: string[] = [];

  let verified = false;
  try {
    const status = await call<{ status?: string }>(creds, `/accounts/${creds.accountId}/tokens/verify`).catch(() =>
      call<{ status?: string }>(creds, "/user/tokens/verify"),
    );
    verified = status?.status === "active";
    checks.push({ name: "Token is valid", ok: verified, detail: verified ? "Cloudflare reports the token as active." : `Token status: ${status?.status ?? "unknown"}.` });
  } catch (error) {
    checks.push({ name: "Token is valid", ok: false, detail: (error as Error).message });
  }

  if (verified) {
    try {
      const settings = await getScriptSettings(creds);
      const vars = settings.bindings.filter((binding) => VAR_TYPES.has(binding.type)).length;
      checks.push({
        name: `Worker "${creds.script}" settings readable`,
        ok: true,
        detail: `${settings.bindings.length} bindings, ${vars} of them variables or secrets.`,
      });
    } catch (error) {
      const err = error as CloudflareError;
      const denied = err.status === 403 || err.status === 401 || err.codes.includes(10000);
      checks.push({
        name: `Worker "${creds.script}" settings readable`,
        ok: false,
        detail: err.status === 404 ? `No Worker named "${creds.script}" in this account.` : err.message,
      });
      if (denied) missing.push("Account · Workers Scripts · Read (and Edit to save changes)");
    }
    checks.push({
      name: "Can edit variables",
      ok: null,
      detail: "Cloudflare has no safe way to probe write access. Edit permission is confirmed by the first Apply; the token needs Account · Workers Scripts · Edit.",
    });
  } else {
    missing.push("A valid, active API token for this account ID");
  }

  return { ok: checks.every((check) => check.ok !== false), checks, missing };
}
