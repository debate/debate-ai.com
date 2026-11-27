/**
 * @fileoverview The slice of the GitHub REST API Admin → Environment uses:
 * read `wrangler.jsonc`, keep build-time Actions variables in step, and
 * trigger and follow a run of the deploy workflow.
 *
 * Rebuilds go through `workflow_dispatch` on `cloudflare-workers-deploy.yml`:
 * that workflow is what builds and `wrangler deploy`s the Worker (see
 * `.github/workflows/cloudflare-workers-deploy.yml`), and a dispatch needs
 * only the GitHub token this panel already holds.
 */

import { type Check, type ConnectionTest } from "./cloudflare";
import { type WranglerInfo, readWranglerInfo } from "./jsonc";
import { redact } from "./redact";

const API = "https://api.github.com";

export interface GithubCredentials {
  token: string;
  owner: string;
  repo: string;
  branch: string;
  workflow: string;
  wranglerPath: string;
}

export class GithubError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "GithubError";
  }
}

async function raw(creds: GithubCredentials, path: string, init: RequestInit = {}, accept = "application/vnd.github+json"): Promise<Response> {
  try {
    return await fetch(`${API}${path}`, {
      ...init,
      headers: {
        Accept: accept,
        Authorization: `Bearer ${creds.token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "debate-ai-admin-env",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(init.headers as Record<string, string> | undefined),
      },
    });
  } catch (error) {
    throw new GithubError(`Could not reach GitHub: ${redact(error, [creds.token])}`, 0);
  }
}

async function fail(creds: GithubCredentials, res: Response): Promise<never> {
  const body = (await res.json().catch(() => null)) as { message?: string } | null;
  throw new GithubError(redact(body?.message || `GitHub answered ${res.status}.`, [creds.token]), res.status);
}

const repoPath = (c: GithubCredentials) => `/repos/${c.owner}/${c.repo}`;

/** `wrangler.jsonc` from the configured branch: which vars the file owns, and whether `keep_vars` is on. */
export async function fetchWranglerInfo(creds: GithubCredentials): Promise<WranglerInfo> {
  const res = await raw(
    creds,
    `${repoPath(creds)}/contents/${creds.wranglerPath.split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(creds.branch)}`,
    {},
    "application/vnd.github.raw+json",
  );
  if (!res.ok) return fail(creds, res);
  try {
    return readWranglerInfo(creds.wranglerPath, await res.text());
  } catch {
    throw new GithubError(`${creds.wranglerPath} is not valid JSONC.`, 422);
  }
}

export interface VariableSync {
  name: string;
  ok: boolean;
  error?: string;
}

/** Sets (or, with `value: null`, removes) a GitHub Actions repository variable. */
export async function syncActionsVariable(creds: GithubCredentials, name: string, value: string | null): Promise<VariableSync> {
  try {
    if (value === null) {
      const res = await raw(creds, `${repoPath(creds)}/actions/variables/${encodeURIComponent(name)}`, { method: "DELETE" });
      if (!res.ok && res.status !== 404) await fail(creds, res);
      return { name, ok: true };
    }
    const patch = await raw(creds, `${repoPath(creds)}/actions/variables/${encodeURIComponent(name)}`, {
      method: "PATCH",
      body: JSON.stringify({ name, value }),
    });
    if (patch.status === 404) {
      const created = await raw(creds, `${repoPath(creds)}/actions/variables`, { method: "POST", body: JSON.stringify({ name, value }) });
      if (!created.ok) await fail(creds, created);
    } else if (!patch.ok) {
      await fail(creds, patch);
    }
    return { name, ok: true };
  } catch (error) {
    return { name, ok: false, error: redact(error, [creds.token]) };
  }
}

export interface WorkflowRun {
  id: number;
  status: string;
  conclusion: string | null;
  url: string;
  createdAt: string;
  sha: string | null;
}

function toRun(run: Record<string, unknown>): WorkflowRun {
  return {
    id: Number(run.id),
    status: String(run.status ?? "unknown"),
    conclusion: (run.conclusion as string | null) ?? null,
    url: String(run.html_url ?? ""),
    createdAt: String(run.created_at ?? ""),
    sha: (run.head_sha as string | null) ?? null,
  };
}

/** The deploy workflow's `app` input, taken from the wrangler path (`apps/<app>/wrangler.jsonc`). */
export function appInput(wranglerPath: string): string | null {
  return /^apps\/([^/]+)\/wrangler\.(jsonc?|toml)$/.exec(wranglerPath)?.[1] ?? null;
}

/**
 * Dispatches the deploy workflow on the configured branch. Returns the run
 * when GitHub reports it (`return_run_details`); otherwise `run` is null and
 * `findDispatchedRun` finds it.
 */
export async function dispatchDeploy(creds: GithubCredentials, now = Date.now()): Promise<{ run: WorkflowRun | null; dispatchedAt: number }> {
  const app = appInput(creds.wranglerPath);
  const res = await raw(creds, `${repoPath(creds)}/actions/workflows/${encodeURIComponent(creds.workflow)}/dispatches`, {
    method: "POST",
    body: JSON.stringify({ ref: creds.branch, return_run_details: true, ...(app ? { inputs: { app } } : {}) }),
  });
  if (!res.ok) return fail(creds, res);
  const body = (await res.json().catch(() => null)) as { workflow_run_id?: number; html_url?: string } | null;
  if (body?.workflow_run_id) {
    const run = await getRun(creds, body.workflow_run_id).catch(() => null);
    return { run: run ?? { id: body.workflow_run_id, status: "queued", conclusion: null, url: body.html_url ?? "", createdAt: new Date(now).toISOString(), sha: null }, dispatchedAt: now };
  }
  return { run: null, dispatchedAt: now };
}

export async function getRun(creds: GithubCredentials, id: number): Promise<WorkflowRun> {
  const res = await raw(creds, `${repoPath(creds)}/actions/runs/${id}`);
  if (!res.ok) return fail(creds, res);
  return toRun((await res.json()) as Record<string, unknown>);
}

/** The newest `workflow_dispatch` run of the deploy workflow created at or after `since` (ms). */
export async function findDispatchedRun(creds: GithubCredentials, since: number): Promise<WorkflowRun | null> {
  const res = await raw(
    creds,
    `${repoPath(creds)}/actions/workflows/${encodeURIComponent(creds.workflow)}/runs?event=workflow_dispatch&branch=${encodeURIComponent(creds.branch)}&per_page=10`,
  );
  if (!res.ok) return fail(creds, res);
  const body = (await res.json()) as { workflow_runs?: Array<Record<string, unknown>> };
  const runs = (body.workflow_runs ?? []).map(toRun).filter((run) => Date.parse(run.createdAt) >= since - 15_000);
  return runs.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0] ?? null;
}

export const GITHUB_REQUIRED = [
  "Fine-grained token on the repository: Actions · Read and write (trigger and follow the deploy workflow)",
  "Contents · Read (read wrangler.jsonc)",
  "Variables · Read and write (keep NEXT_PUBLIC_* build variables in step)",
  "Metadata · Read",
  "Classic token alternative: the `repo` scope",
] as const;

/** Validates the token against the repo, the workflow, the branch and wrangler.jsonc, without changing anything. */
export async function testGithub(creds: GithubCredentials): Promise<ConnectionTest> {
  const checks: Check[] = [];
  const missing: string[] = [];
  const base = repoPath(creds);

  const probe = async (name: string, path: string, okDetail: string, permission: string, notFound: string) => {
    const res = await raw(creds, path);
    if (res.ok) {
      checks.push({ name, ok: true, detail: okDetail });
      return res;
    }
    const body = (await res.clone().json().catch(() => null)) as { message?: string } | null;
    const detail =
      res.status === 401
        ? "GitHub rejected the token (expired or revoked)."
        : res.status === 404
          ? notFound
          : res.status === 403
            ? `Forbidden: ${redact(body?.message ?? "missing permission", [creds.token])}`
            : redact(body?.message ?? `GitHub answered ${res.status}.`, [creds.token]);
    checks.push({ name, ok: false, detail });
    if (res.status === 401) missing.push("A valid, unexpired GitHub token");
    else if (res.status === 403 || res.status === 404) missing.push(permission);
    return null;
  };

  let repoRes: Response | null;
  try {
    repoRes = await probe(
      `Repository ${creds.owner}/${creds.repo} reachable`,
      base,
      "The token can see the repository.",
      "Metadata · Read, with the token granted access to this repository",
      "Repository not found, or the token has no access to it.",
    );
  } catch (error) {
    return { ok: false, checks: [{ name: "GitHub reachable", ok: false, detail: (error as Error).message }], missing: [] };
  }

  const scopes = repoRes?.headers.get("x-oauth-scopes");
  if (repoRes) {
    if (scopes !== null && scopes !== undefined) {
      const hasRepo = scopes.split(",").map((s) => s.trim()).includes("repo");
      checks.push({
        name: "Classic token scopes",
        ok: hasRepo,
        detail: hasRepo ? `Scopes: ${scopes}.` : `Scopes: ${scopes || "none"}. Dispatching workflows and Actions variables need the \`repo\` scope.`,
      });
      if (!hasRepo) missing.push("Classic token scope: repo");
    }
    await probe(
      `Branch ${creds.branch} exists`,
      `${base}/branches/${encodeURIComponent(creds.branch)}`,
      "Branch found.",
      "Contents · Read",
      `No branch named ${creds.branch}.`,
    );
    await probe(
      `Workflow ${creds.workflow} found`,
      `${base}/actions/workflows/${encodeURIComponent(creds.workflow)}`,
      "The deploy workflow can be dispatched.",
      "Actions · Read",
      `No workflow file named ${creds.workflow} on the default branch.`,
    );
    await probe(
      `${creds.wranglerPath} readable`,
      `${base}/contents/${creds.wranglerPath.split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(creds.branch)}`,
      "Used to warn about variables the file overrides.",
      "Contents · Read",
      `${creds.wranglerPath} not found on ${creds.branch}.`,
    );
    await probe(
      "Actions variables readable",
      `${base}/actions/variables?per_page=1`,
      "Build-time NEXT_PUBLIC_* variables can be kept in step.",
      "Variables · Read and write",
      "Actions variables are not available to this token.",
    );
    checks.push({
      name: "Can dispatch workflows",
      ok: null,
      detail: "GitHub has no safe way to probe write access. It is confirmed by the first rebuild; the token needs Actions · Read and write (or the `repo` scope).",
    });
  }

  return { ok: checks.every((check) => check.ok !== false), checks, missing: [...new Set(missing)] };
}
