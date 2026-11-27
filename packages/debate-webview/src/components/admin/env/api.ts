export type VarKind = "plain_text" | "secret_text" | "json";

export interface TokenStatus {
  set: boolean;
  endsIn: string;
  unreadable: boolean;
  updatedAt: number | null;
  updatedBy: string | null;
}

export interface EnvStatus {
  cloudflare: TokenStatus & { accountId: string; script: string };
  github: TokenStatus & { owner: string; repo: string; branch: string; workflow: string; wranglerPath: string };
}

export interface EnvVar {
  name: string;
  kind: VarKind;
  value?: string;
  protected: boolean;
  inWrangler: boolean;
}

export interface VarsResponse {
  script: string;
  vars: EnvVar[];
  bindings: Array<{ name: string; type: string; protected: boolean }>;
  protectedVars: Record<string, string>;
  wrangler: { path: string; name: string | null; keepVars: boolean; varNames: string[] } | null;
  wranglerError: string | null;
  warnings: string[];
}

export type Change = { op: "set"; name: string; kind: VarKind; value: string } | { op: "delete"; name: string };

export interface DiffEntry {
  name: string;
  action: "add" | "update" | "delete" | "unchanged";
  kind: VarKind | null;
  previousKind: VarKind | null;
  before: string | null;
  after: string | null;
  protected: boolean;
  missing?: boolean;
  warnings: string[];
}

export interface Plan {
  entries: DiffEntry[];
  hasDeletes: boolean;
  hasProtected: boolean;
  needsRebuild: string[];
  warnings: string[];
}

export interface WorkflowRun {
  id: number;
  status: string;
  conclusion: string | null;
  url: string;
  createdAt: string;
  sha: string | null;
}

export interface RebuildResult {
  run: WorkflowRun | null;
  dispatchedAt: number;
  variables: Array<{ name: string; ok: boolean; error?: string }>;
  error?: string;
}

export interface AuditEntry {
  id: number;
  at: number;
  actor: string | null;
  action: string;
  names: string[];
  detail: string | null;
}

export interface ConnectionTest {
  target: "cloudflare" | "github";
  ok: boolean;
  checks: Array<{ name: string; ok: boolean | null; detail: string }>;
  missing: string[];
  required: string[];
}

export const ENDPOINT = "/api/admin/env";

/** Calls an `/api/admin/env/*` route; a non-2xx answer throws its `error`. */
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${ENDPOINT}${path}`, {
    credentials: "include",
    ...init,
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    const error = new Error(data.error || `The request failed (${res.status}).`) as Error & { data?: unknown };
    error.data = data;
    throw error;
  }
  return data;
}

export const when = (ms: number | null) => (ms ? new Date(ms).toLocaleString() : "—");
