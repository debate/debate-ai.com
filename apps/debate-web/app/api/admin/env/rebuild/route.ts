import { startRebuild } from "@/lib/env-manager/deploy";
import { findDispatchedRun, getRun } from "@/lib/env-manager/github";
import { adminOnly, fail, forbidden, json, loadAll, secretsOf, throttle } from "@/lib/env-manager/http";

/**
 * Admin → Environment rebuild (admins only).
 *
 * POST        — dispatches the deploy workflow (`workflow_dispatch`) on the configured
 *               branch with the saved GitHub token; one every 30 seconds.
 * GET ?runId= — that run's status and a link to it, for polling.
 * GET ?since= — finds the run dispatched at/after that epoch-ms time, for when GitHub
 *               did not return a run id with the dispatch.
 */
export async function POST() {
  const access = await adminOnly();
  if (!access) return forbidden();
  const { db, gh } = await loadAll();
  if (!gh) return fail("Save the GitHub token first.", 400);
  const limited = await throttle(db, "rebuild", 30_000);
  if (limited) return limited;
  const result = await startRebuild(db, gh, access.email);
  return json(result, result.error ? 502 : 200);
}

export async function GET(request: Request) {
  if (!(await adminOnly())) return forbidden();
  const params = new URL(request.url).searchParams;
  const { config, gh } = await loadAll();
  if (!gh) return fail("Save the GitHub token first.", 400);
  try {
    const runId = params.get("runId");
    if (runId) {
      if (!/^\d{1,15}$/.test(runId)) return fail("runId must be a number.", 400);
      return json({ run: await getRun(gh, Number(runId)) });
    }
    const since = Number(params.get("since"));
    if (!Number.isFinite(since) || since <= 0) return fail("Pass runId or since.", 400);
    return json({ run: await findDispatchedRun(gh, since) });
  } catch (error) {
    return fail(error, 502, secretsOf(config));
  }
}
