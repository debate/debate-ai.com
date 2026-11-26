import { type Change, BindingsLostError, applyVarChanges, getScriptSettings } from "@/lib/env-manager/cloudflare";
import { startRebuild } from "@/lib/env-manager/deploy";
import { fetchWranglerInfo } from "@/lib/env-manager/github";
import { adminOnly, fail, forbidden, json, loadAll, secretsOf, throttle } from "@/lib/env-manager/http";
import { redact } from "@/lib/env-manager/redact";
import { recordAudit } from "@/lib/env-manager/store";
import { PROTECTED_VARS, effectiveChanges, planChanges, validateChanges } from "@/lib/env-manager/vars";

/**
 * Admin → Environment apply (admins only). POST
 * `{ changes, dryRun?, confirmDelete?, confirmProtected?, rebuild? }`.
 *
 * `changes` are `{ op: "set", name, kind: "plain_text" | "secret_text" | "json", value }`
 * and `{ op: "delete", name }`. The route reads the Worker's current settings,
 * builds the diff (secrets by name only) and:
 *  - `dryRun`: returns `{ plan }` and changes nothing;
 *  - otherwise refuses with 409 until `confirmDelete` (the diff deletes a
 *    variable) and `confirmProtected` (it touches a protected name) are set,
 *    then PATCHes the Worker settings once, leaving every other binding as it
 *    was, and records the variable names (never values) in the audit log;
 *  - `rebuild`: then syncs build-time NEXT_PUBLIC_* variables to GitHub and
 *    dispatches the deploy workflow.
 */
export async function POST(request: Request) {
  const access = await adminOnly();
  if (!access) return forbidden();
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") return fail("Send the changes as JSON.", 400);
  const parsed = validateChanges(body.changes);
  if ("error" in parsed) return fail(parsed.error, 400, valuesOf(body.changes));
  const { changes } = parsed;
  const secretValues = changes.filter((c): c is Extract<Change, { op: "set" }> => c.op === "set" && c.kind === "secret_text").map((c) => c.value);

  const { db, config, cf, gh } = await loadAll();
  if (!cf) return fail("Save the Cloudflare API token and account ID first.", 400);
  const scrub = [...secretsOf(config), ...secretValues];

  try {
    const settings = await getScriptSettings(cf);
    let wrangler: { varNames: string[]; keepVars: boolean } | null = null;
    if (gh) wrangler = await fetchWranglerInfo(gh).catch(() => null);
    const planned = planChanges(settings.bindings, changes, wrangler);
    if ("error" in planned) return fail(planned.error, 400, scrub);
    const { plan } = planned;

    if (body.dryRun === true) return json({ plan, protectedVars: PROTECTED_VARS });

    if (plan.hasDeletes && body.confirmDelete !== true) {
      return fail("Confirm deleting the listed variables first.", 409, scrub, { needs: "confirmDelete", plan });
    }
    if (plan.hasProtected && body.confirmProtected !== true) {
      return fail("Confirm changing the protected variables first.", 409, scrub, { needs: "confirmProtected", plan });
    }
    if (body.rebuild === true && !gh) return fail("Save the GitHub token first to rebuild.", 400);

    const limited = await throttle(db, "apply", 10_000);
    if (limited) return limited;

    const toSend = effectiveChanges(changes, plan);
    if (toSend.length === 0) return json({ applied: 0, plan, rebuild: null });

    const labels = plan.entries
      .filter((entry) => toSend.some((c) => c.name === entry.name))
      .map((entry) => `${entry.action}:${entry.name}${entry.kind === "secret_text" ? " (secret)" : ""}${entry.protected ? " (protected)" : ""}`);
    await recordAudit(db, { actor: access.email, action: "apply", names: labels });
    try {
      await applyVarChanges(cf, toSend);
    } catch (error) {
      const message = redact(error, scrub);
      await recordAudit(db, { actor: access.email, action: "apply-result", names: labels, detail: `failed: ${message}` });
      return fail(message, error instanceof BindingsLostError ? 500 : 502, scrub);
    }
    await recordAudit(db, { actor: access.email, action: "apply-result", names: labels, detail: "ok" });

    const rebuild = body.rebuild === true && gh ? await startRebuild(db, gh, access.email, toSend) : null;
    return json({ applied: toSend.length, plan, rebuild });
  } catch (error) {
    return fail(error, 502, scrub);
  }
}

function valuesOf(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.map((item) => (typeof item?.value === "string" ? item.value : "")).filter(Boolean) : [];
}
