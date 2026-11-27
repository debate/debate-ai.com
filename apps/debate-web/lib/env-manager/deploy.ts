/**
 * @fileoverview "Apply and rebuild": the Worker settings change, the build-time
 * variable sync and the workflow dispatch, shared by the apply and rebuild routes.
 */

import type { Change } from "./cloudflare";
import { type GithubCredentials, type VariableSync, type WorkflowRun, dispatchDeploy, syncActionsVariable } from "./github";
import { redact } from "./redact";
import type { Database } from "../emails/tables";
import { recordAudit } from "./store";
import { isBuildTimeVar } from "./vars";

export interface RebuildResult {
  run: WorkflowRun | null;
  /** Epoch ms; with no `run` yet, poll `GET /api/admin/env/rebuild?since=` with it. */
  dispatchedAt: number;
  variables: VariableSync[];
  error?: string;
}

/**
 * Keeps GitHub Actions repository variables in step with the staged
 * NEXT_PUBLIC_* changes (the deploy workflow exports them into the build),
 * then dispatches the deploy workflow on the configured branch.
 */
export async function startRebuild(
  db: Database,
  gh: GithubCredentials,
  actor: string | null,
  changes: Change[] = [],
): Promise<RebuildResult> {
  const variables: VariableSync[] = [];
  for (const change of changes.filter((c) => isBuildTimeVar(c.name))) {
    if (change.op === "delete") variables.push(await syncActionsVariable(gh, change.name, null));
    else if (change.kind === "secret_text") {
      variables.push({ name: change.name, ok: false, error: "NEXT_PUBLIC_ values are public by design; a secret's value is never sent to GitHub." });
    } else variables.push(await syncActionsVariable(gh, change.name, change.value));
  }
  const synced = variables.filter((v) => v.ok).map((v) => v.name);
  if (synced.length) await recordAudit(db, { actor, action: "build-variables", names: synced, detail: "GitHub Actions repository variables" });

  await recordAudit(db, { actor, action: "rebuild", names: [], detail: `${gh.owner}/${gh.repo}@${gh.branch} ${gh.workflow}` });
  try {
    const { run, dispatchedAt } = await dispatchDeploy(gh);
    await recordAudit(db, { actor, action: "rebuild-result", detail: run ? `dispatched: run ${run.id} ${run.url}` : "dispatched" });
    return { run, dispatchedAt, variables };
  } catch (error) {
    const message = redact(error, [gh.token]);
    await recordAudit(db, { actor, action: "rebuild-result", detail: `failed: ${message}` });
    return { run: null, dispatchedAt: Date.now(), variables, error: message };
  }
}
