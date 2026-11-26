import { getDBFromContext } from "@/lib/database/context";
import { adminOnly, fail, forbidden, json, throttle } from "@/lib/env-manager/http";
import { type CredentialsInput, deleteCredentials, loadStatus, recordAudit, saveCredentials } from "@/lib/env-manager/store";

/**
 * Admin → Environment credentials (admins only): the Cloudflare API token,
 * account ID and Worker name, and the GitHub token, repository, branch and
 * deploy workflow. Tokens are stored encrypted and never sent back; responses
 * carry only whether each is set and its last four characters.
 *
 * GET                         — `{ status }`.
 * POST { …fields }            — saves the fields that are present; a blank token keeps the saved one.
 * DELETE ?which=cloudflare|github — forgets that side's token and settings.
 */

const FIELDS: Array<keyof CredentialsInput> = [
  "cloudflareToken",
  "accountId",
  "script",
  "githubToken",
  "owner",
  "repo",
  "branch",
  "workflow",
  "wranglerPath",
];

export async function GET() {
  if (!(await adminOnly())) return forbidden();
  return json({ status: await loadStatus(await getDBFromContext()) });
}

export async function POST(request: Request) {
  const access = await adminOnly();
  if (!access) return forbidden();
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") return fail("Send the credentials as JSON.", 400);
  const input: CredentialsInput = {};
  for (const field of FIELDS) {
    if (body[field] !== undefined && typeof body[field] !== "string") return fail(`${field} must be text.`, 400);
    if (typeof body[field] === "string") input[field] = body[field] as string;
  }
  const db = await getDBFromContext();
  const limited = await throttle(db, "credentials", 2000);
  if (limited) return limited;
  const secrets = [input.cloudflareToken, input.githubToken];
  const error = await saveCredentials(db, input, access.email);
  if (error) return fail(error, 400, secrets);
  const saved = FIELDS.filter((field) => input[field]?.trim()).map((field) => field);
  await recordAudit(db, { actor: access.email, action: "credentials", names: saved });
  return json({ ok: true, status: await loadStatus(db) });
}

export async function DELETE(request: Request) {
  const access = await adminOnly();
  if (!access) return forbidden();
  const which = new URL(request.url).searchParams.get("which");
  if (which !== "cloudflare" && which !== "github") return fail('which must be "cloudflare" or "github".', 400);
  const db = await getDBFromContext();
  await deleteCredentials(db, which);
  await recordAudit(db, { actor: access.email, action: "credentials-removed", names: [which] });
  return json({ ok: true, status: await loadStatus(db) });
}
