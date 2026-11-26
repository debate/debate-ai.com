import { NextResponse, type NextRequest } from "next/server";
import { getAdminAccess } from "@/lib/auth/admin";
import { getDBFromContext } from "@/lib/database/context";
import { batchSizeFor, isEmailProvider, tallyResults } from "@/lib/emails/bulk";
import {
  cloudflareTransport,
  deliverBatch,
  getCloudflareEmailBinding,
  resendTransport,
  type Transport,
} from "@/lib/emails/campaign";
import { getEmailList } from "@/lib/emails/lists";
import { renderCustomEmail } from "@/lib/emails/render";
import { getSavedTemplate } from "@/lib/emails/saved-templates";
import { resendKeyStatus, resolveResendKey } from "@/lib/emails/settings";
import { filterSubscribedEmails } from "@/lib/emails/unsubscribe";

/**
 * Sends a saved template to a saved list, one batch per request so the panel
 * can show progress and each batch fits in one Worker request — admins only.
 *
 * GET — `{ providers }`: whether each transport is ready (`resend`: a key is
 *   saved or in the env; `cloudflare`: the Worker has the `EMAIL` binding)
 *   and its `batchSize`.
 * POST { templateId, listId, provider: "resend" | "cloudflare", offset? } —
 *   sends the addresses `offset … offset + batchSize` of the list and returns
 *   `{ results, totals, total, nextOffset }`; `nextOffset` is `null` after the
 *   last batch. Each result is `sent`, `failed` or `skipped` (unsubscribed)
 *   with an `error` when not sent.
 */
const noStore = { "Cache-Control": "no-store" };

export async function GET() {
  const { isAdmin } = await getAdminAccess();
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const key = await resendKeyStatus(await getDBFromContext());
  return NextResponse.json(
    {
      providers: {
        resend: { ready: key.source !== null, batchSize: batchSizeFor("resend"), source: key.source },
        cloudflare: { ready: getCloudflareEmailBinding() !== null, batchSize: batchSizeFor("cloudflare") },
      },
    },
    { headers: noStore },
  );
}

export async function POST(req: NextRequest) {
  const { isAdmin } = await getAdminAccess();
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });

  const { templateId, listId, provider } = body;
  const offset = body.offset === undefined ? 0 : body.offset;
  if (typeof templateId !== "string" || typeof listId !== "string") {
    return NextResponse.json({ error: "Choose a template and a list." }, { status: 400 });
  }
  if (!isEmailProvider(provider)) {
    return NextResponse.json({ error: 'provider must be "resend" or "cloudflare".' }, { status: 400 });
  }
  if (typeof offset !== "number" || !Number.isInteger(offset) || offset < 0) {
    return NextResponse.json({ error: "offset must be a non-negative integer." }, { status: 400 });
  }

  const db = await getDBFromContext();
  const [template, list] = await Promise.all([getSavedTemplate(db, templateId), getEmailList(db, listId)]);
  if (!template) return NextResponse.json({ error: "Template not found." }, { status: 404 });
  if (!list) return NextResponse.json({ error: "List not found." }, { status: 404 });
  if (offset >= list.emails.length) {
    return NextResponse.json({ error: "offset is past the end of the list." }, { status: 400 });
  }

  let transport: Transport;
  if (provider === "resend") {
    const resolved = await resolveResendKey(db);
    if (!resolved) {
      return NextResponse.json(
        { error: "No Resend API key is saved, and RESEND_API_KEY is not set, so no email can be sent." },
        { status: 503 },
      );
    }
    transport = resendTransport(resolved.key);
  } else {
    const binding = getCloudflareEmailBinding();
    if (!binding) {
      return NextResponse.json(
        { error: "This Worker has no EMAIL send_email binding. Declare it in wrangler.jsonc to send through Cloudflare." },
        { status: 503 },
      );
    }
    transport = cloudflareTransport(binding);
  }

  const size = batchSizeFor(provider);
  const recipients = list.emails.slice(offset, offset + size);

  try {
    const rendered = await renderCustomEmail({ subject: template.subject, body: template.body, baseUrl: req.nextUrl.origin });
    const results = await deliverBatch({
      recipients,
      rendered,
      origin: req.nextUrl.origin,
      transport,
      filterSubscribed: (emails) => filterSubscribedEmails(db, emails),
    });
    const totals = tallyResults(results);
    if (totals.failed > 0) console.error(`Bulk "${template.name}" email: ${totals.failed} of ${results.length} failed.`);
    const next = offset + recipients.length;
    return NextResponse.json(
      { results, totals, total: list.emails.length, nextOffset: next < list.emails.length ? next : null },
      { headers: noStore },
    );
  } catch (error) {
    console.error("Failed to send a bulk email batch:", error);
    return NextResponse.json({ error: (error as Error)?.message || "Failed to send the emails." }, { status: 500 });
  }
}
