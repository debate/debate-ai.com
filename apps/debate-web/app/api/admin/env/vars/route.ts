import { getScriptSettings } from "@/lib/env-manager/cloudflare";
import { fetchWranglerInfo } from "@/lib/env-manager/github";
import { adminOnly, fail, forbidden, json, loadAll, secretsOf } from "@/lib/env-manager/http";
import { redact } from "@/lib/env-manager/redact";
import { PROTECTED_VARS, listVars } from "@/lib/env-manager/vars";

/**
 * Admin → Environment variable list (admins only): the Worker's variables and
 * secrets as Cloudflare reports them, plus its other bindings by name. Plain
 * text and JSON values are included; a secret is only a name. When a GitHub
 * token is saved, `wrangler.jsonc` is read from the configured branch to flag
 * variables the file owns (a `wrangler deploy` writes over those).
 */
export async function GET() {
  if (!(await adminOnly())) return forbidden();
  const { config, cf, gh } = await loadAll();
  if (!cf) return fail("Save the Cloudflare API token and account ID first.", 400);
  try {
    const settings = await getScriptSettings(cf);
    let wrangler: { path: string; name: string | null; keepVars: boolean; varNames: string[] } | null = null;
    let wranglerError: string | null = null;
    if (gh) {
      try {
        wrangler = await fetchWranglerInfo(gh);
      } catch (error) {
        wranglerError = redact(error, secretsOf(config));
      }
    }
    const warnings: string[] = [];
    if (wrangler && !wrangler.keepVars) {
      warnings.push("wrangler.jsonc has no `keep_vars: true`: a deploy deletes dashboard variables that are not listed in `vars`.");
    }
    if (wrangler?.name && wrangler.name !== cf.script) {
      warnings.push(`wrangler.jsonc deploys a Worker named "${wrangler.name}", not "${cf.script}": the rebuild will not update the Worker you are editing.`);
    }
    return json({
      script: cf.script,
      ...listVars(settings.bindings, wrangler?.varNames ?? []),
      protectedVars: PROTECTED_VARS,
      wrangler,
      wranglerError,
      warnings,
    });
  } catch (error) {
    return fail(error, 502, secretsOf(config));
  }
}
