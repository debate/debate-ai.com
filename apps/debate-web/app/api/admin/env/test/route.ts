import { testCloudflare, CLOUDFLARE_REQUIRED } from "@/lib/env-manager/cloudflare";
import { GITHUB_REQUIRED, testGithub } from "@/lib/env-manager/github";
import { adminOnly, fail, forbidden, json, loadAll, secretsOf, throttle } from "@/lib/env-manager/http";

/**
 * Admin → Environment "Test connection" (admins only). POST `{ target:
 * "cloudflare" | "github" }` checks the saved token against that API without
 * changing anything and reports which permissions are missing. Never returns
 * the token.
 */
export async function POST(request: Request) {
  if (!(await adminOnly())) return forbidden();
  const body = (await request.json().catch(() => null)) as { target?: unknown } | null;
  const target = body?.target;
  if (target !== "cloudflare" && target !== "github") return fail('target must be "cloudflare" or "github".', 400);
  const { db, config, cf, gh } = await loadAll();
  const limited = await throttle(db, "test-connection", 2000);
  if (limited) return limited;
  try {
    if (target === "cloudflare") {
      if (!cf) return fail("Save the Cloudflare API token and account ID first.", 400);
      return json({ target, required: CLOUDFLARE_REQUIRED, ...(await testCloudflare(cf)) });
    }
    if (!gh) return fail("Save the GitHub token first.", 400);
    return json({ target, required: GITHUB_REQUIRED, ...(await testGithub(gh)) });
  } catch (error) {
    return fail(error, 502, secretsOf(config));
  }
}
