/**
 * @fileoverview D1 storage for Admin → Environment: the Cloudflare and GitHub
 * credentials, the audit log and the cooldown clock.
 *
 * Tokens are AES-GCM encrypted with the same key as the service logins and the
 * Resend key (`SERVICE_LOGINS_SECRET`, else `BETTER_AUTH_SECRET`;
 * `../emails/secret-crypto.ts`); only their last four characters stay readable.
 * Nothing here ever returns a token to a caller outside the server: `loadConfig`
 * is for server-side API clients, `loadStatus` is what routes send to the browser.
 *
 * The app ships no migrations folder, so the tables are created here once per
 * isolate.
 */

import { sql } from "drizzle-orm";
import { getEnv } from "@/lib/env";
import { decryptSecret, emailSecret, encryptSecret } from "../emails/secret-crypto";
import type { Database } from "../emails/tables";
import { redact, tail } from "./redact";

const DDL = [
  `CREATE TABLE IF NOT EXISTS "env_manager_settings" (
  "key" text PRIMARY KEY NOT NULL,
  "value" text NOT NULL,
  "encrypted" integer DEFAULT 0 NOT NULL,
  "hint" text,
  "updated_at" integer NOT NULL,
  "updated_by" text
)`,
  `CREATE TABLE IF NOT EXISTS "env_manager_audit" (
  "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  "at" integer NOT NULL,
  "actor" text,
  "action" text NOT NULL,
  "names" text NOT NULL DEFAULT '[]',
  "detail" text
)`,
];

let ensured: Promise<void> | null = null;

export function ensureEnvManagerTables(db: Database): Promise<void> {
  const pending = (ensured ??= (async () => {
    for (const statement of DDL) await db.run(sql.raw(statement));
  })());
  pending.catch(() => {
    if (ensured === pending) ensured = null;
  });
  return pending;
}

/** Forgets that the tables exist (tests, which swap databases). */
export function resetEnvManagerTables(): void {
  ensured = null;
}

export interface EnvManagerConfig {
  cloudflare: { token: string | null; accountId: string; script: string };
  github: { token: string | null; owner: string; repo: string; branch: string; workflow: string; wranglerPath: string };
}

export const DEFAULTS = {
  script: "d-ebate-app",
  owner: "debate",
  repo: "debate-ai.com",
  branch: "master",
  workflow: "cloudflare-workers-deploy.yml",
  wranglerPath: "apps/debate-web/wrangler.jsonc",
} as const;

type SettingKey =
  | "cloudflare_token"
  | "cloudflare_account_id"
  | "cloudflare_script"
  | "github_token"
  | "github_owner"
  | "github_repo"
  | "github_branch"
  | "github_workflow"
  | "github_wrangler_path";

const SECRET_KEYS = new Set<SettingKey>(["cloudflare_token", "github_token"]);

interface Row {
  value: string;
  encrypted: boolean;
  hint: string | null;
  updatedAt: number;
  updatedBy: string | null;
}

async function readRows(db: Database): Promise<Map<string, Row>> {
  await ensureEnvManagerTables(db);
  const rows = (await db.all(
    sql`SELECT key, value, encrypted, hint, updated_at AS updatedAt, updated_by AS updatedBy FROM env_manager_settings`,
  )) as Record<string, unknown>[];
  return new Map(
    rows.map((row) => [
      String(row.key),
      {
        value: String(row.value),
        encrypted: Number(row.encrypted) === 1,
        hint: (row.hint as string | null) ?? null,
        updatedAt: Number(row.updatedAt ?? 0),
        updatedBy: (row.updatedBy as string | null) ?? null,
      },
    ]),
  );
}

async function putSetting(db: Database, key: SettingKey, value: string, by: string | null, now: number): Promise<void> {
  const secret = SECRET_KEYS.has(key);
  const stored = secret ? await encryptSecret(value, emailSecret()) : value;
  await db.run(
    sql`INSERT INTO env_manager_settings (key, value, encrypted, hint, updated_at, updated_by)
        VALUES (${key}, ${stored}, ${secret ? 1 : 0}, ${secret ? tail(value) : null}, ${now}, ${by})
        ON CONFLICT (key) DO UPDATE SET value = excluded.value, encrypted = excluded.encrypted, hint = excluded.hint,
          updated_at = excluded.updated_at, updated_by = excluded.updated_by`,
  );
}

async function plain(rows: Map<string, Row>, key: SettingKey): Promise<string | null> {
  const row = rows.get(key);
  if (!row) return null;
  return row.encrypted ? decryptSecret(row.value, emailSecret()) : row.value;
}

/** Server-side only: decrypted tokens for the Cloudflare and GitHub clients. */
export async function loadConfig(db: Database): Promise<EnvManagerConfig> {
  const rows = await readRows(db);
  return {
    cloudflare: {
      token: await plain(rows, "cloudflare_token"),
      accountId: (await plain(rows, "cloudflare_account_id")) ?? getEnv("CLOUDFLARE_ACCOUNT_ID") ?? "",
      script: (await plain(rows, "cloudflare_script")) ?? DEFAULTS.script,
    },
    github: {
      token: await plain(rows, "github_token"),
      owner: (await plain(rows, "github_owner")) ?? DEFAULTS.owner,
      repo: (await plain(rows, "github_repo")) ?? DEFAULTS.repo,
      branch: (await plain(rows, "github_branch")) ?? DEFAULTS.branch,
      workflow: (await plain(rows, "github_workflow")) ?? DEFAULTS.workflow,
      wranglerPath: (await plain(rows, "github_wrangler_path")) ?? DEFAULTS.wranglerPath,
    },
  };
}

export interface TokenStatus {
  set: boolean;
  endsIn: string;
  /** Saved, but the server secret changed since, so it can't be read; enter it again. */
  unreadable: boolean;
  updatedAt: number | null;
  updatedBy: string | null;
}

/** What the panel shows. Never holds a token. */
export interface EnvManagerStatus {
  cloudflare: TokenStatus & { accountId: string; script: string };
  github: TokenStatus & { owner: string; repo: string; branch: string; workflow: string; wranglerPath: string };
}

async function tokenStatus(rows: Map<string, Row>, key: SettingKey): Promise<TokenStatus> {
  const row = rows.get(key);
  const value = row ? await decryptSecret(row.value, emailSecret()) : null;
  return {
    set: Boolean(value),
    endsIn: value ? (row?.hint ?? tail(value)) : "",
    unreadable: Boolean(row && !value),
    updatedAt: row?.updatedAt ?? null,
    updatedBy: row?.updatedBy ?? null,
  };
}

export async function loadStatus(db: Database): Promise<EnvManagerStatus> {
  const rows = await readRows(db);
  const config = await loadConfig(db);
  return {
    cloudflare: { ...(await tokenStatus(rows, "cloudflare_token")), accountId: config.cloudflare.accountId, script: config.cloudflare.script },
    github: {
      ...(await tokenStatus(rows, "github_token")),
      owner: config.github.owner,
      repo: config.github.repo,
      branch: config.github.branch,
      workflow: config.github.workflow,
      wranglerPath: config.github.wranglerPath,
    },
  };
}

const PATTERNS = {
  accountId: /^[a-f0-9]{32}$/i,
  script: /^[A-Za-z0-9_-]{1,63}$/,
  owner: /^[A-Za-z0-9_.-]{1,100}$/,
  repo: /^[A-Za-z0-9_.-]{1,100}$/,
  branch: /^[A-Za-z0-9._/-]{1,200}$/,
  workflow: /^[A-Za-z0-9_.-]{1,100}\.ya?ml$/,
  wranglerPath: /^(?!.*\.\.)[A-Za-z0-9_./-]{1,200}$/,
} as const;

export interface CredentialsInput {
  cloudflareToken?: string;
  accountId?: string;
  script?: string;
  githubToken?: string;
  owner?: string;
  repo?: string;
  branch?: string;
  workflow?: string;
  wranglerPath?: string;
}

/** Fields that are present and non-empty are saved; the rest keep their value. Returns an error message or null. */
export async function saveCredentials(db: Database, input: CredentialsInput, by: string | null, now = Date.now()): Promise<string | null> {
  const fields: Array<[SettingKey, string | undefined, RegExp | null, string]> = [
    ["cloudflare_token", input.cloudflareToken, null, "Cloudflare API token"],
    ["cloudflare_account_id", input.accountId, PATTERNS.accountId, "Cloudflare account ID (32 hex characters)"],
    ["cloudflare_script", input.script, PATTERNS.script, "Worker script name"],
    ["github_token", input.githubToken, null, "GitHub token"],
    ["github_owner", input.owner, PATTERNS.owner, "repository owner"],
    ["github_repo", input.repo, PATTERNS.repo, "repository name"],
    ["github_branch", input.branch, PATTERNS.branch, "branch"],
    ["github_workflow", input.workflow, PATTERNS.workflow, "workflow file name (ends in .yml)"],
    ["github_wrangler_path", input.wranglerPath, PATTERNS.wranglerPath, "wrangler config path"],
  ];
  const toSave: Array<[SettingKey, string]> = [];
  for (const [key, raw, pattern, label] of fields) {
    if (typeof raw !== "string") continue;
    const value = raw.trim();
    if (!value) continue;
    if (SECRET_KEYS.has(key) ? value.length < 8 || value.length > 512 || /\s/.test(value) : !pattern!.test(value)) {
      return `That does not look like a valid ${label}.`;
    }
    toSave.push([key, value]);
  }
  await ensureEnvManagerTables(db);
  for (const [key, value] of toSave) await putSetting(db, key, value, by, now);
  return null;
}

export async function deleteCredentials(db: Database, which: "cloudflare" | "github"): Promise<void> {
  await ensureEnvManagerTables(db);
  await db.run(sql`DELETE FROM env_manager_settings WHERE key LIKE ${`${which}_%`}`);
}

export interface AuditEntry {
  id: number;
  at: number;
  actor: string | null;
  action: string;
  names: string[];
  detail: string | null;
}

/** Records who did what. `names` are variable names only, never values. */
export async function recordAudit(
  db: Database,
  entry: { actor: string | null; action: string; names?: string[]; detail?: string | null },
  now = Date.now(),
): Promise<void> {
  await ensureEnvManagerTables(db);
  await db.run(
    sql`INSERT INTO env_manager_audit (at, actor, action, names, detail)
        VALUES (${now}, ${entry.actor}, ${entry.action}, ${JSON.stringify((entry.names ?? []).slice(0, 500))},
                ${entry.detail ? redact(entry.detail) : null})`,
  );
}

export async function listAudit(db: Database, limit = 50): Promise<AuditEntry[]> {
  await ensureEnvManagerTables(db);
  const rows = (await db.all(
    sql`SELECT id, at, actor, action, names, detail FROM env_manager_audit ORDER BY id DESC LIMIT ${limit}`,
  )) as Record<string, unknown>[];
  return rows.map((row) => {
    let names: string[] = [];
    try {
      names = JSON.parse(String(row.names)) as string[];
    } catch {
      // keep empty
    }
    return {
      id: Number(row.id),
      at: Number(row.at),
      actor: (row.actor as string | null) ?? null,
      action: String(row.action),
      names,
      detail: (row.detail as string | null) ?? null,
    };
  });
}

/**
 * Seconds to wait before `action` may run again, from the newest audit row of
 * that action (so the limit holds across Worker isolates), or 0 when it may run.
 */
export async function cooldownRemaining(db: Database, action: string, windowMs: number, now = Date.now()): Promise<number> {
  await ensureEnvManagerTables(db);
  const [row] = (await db.all(sql`SELECT MAX(at) AS at FROM env_manager_audit WHERE action = ${action}`)) as Record<string, unknown>[];
  const last = Number(row?.at ?? 0);
  return last && now - last < windowMs ? Math.ceil((windowMs - (now - last)) / 1000) : 0;
}
