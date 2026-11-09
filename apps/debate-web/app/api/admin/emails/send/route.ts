import { NextResponse, type NextRequest } from "next/server";
import { Resend } from "resend";
import { renderEmail } from "@/lib/emails/render";
import { getAdminAccess } from "@/lib/auth/admin";
import { getEnv } from "@/lib/env";
import { APP_EMAIL, APP_NAME } from "@debate-ai/webview/lib/config/site";
import { MAX_BULK_RECIPIENTS, parseRecipientList } from "@debate-ai/webview/lib/admin/email-recipients";

/** Templates an admin may send to a list. Others need per-recipient data (a file, a round). */
const LIST_SENDABLE_TEMPLATES = ["welcome"] as const;
type ListSendableTemplate = (typeof LIST_SENDABLE_TEMPLATES)[number];

/** Resend's batch endpoint takes at most 100 emails per call. */
const RESEND_BATCH_SIZE = 100;

interface RecipientResult {
  email: string;
  ok: boolean;
  /** Resend's email id when sent. */
  id?: string;
  error?: string;
}

function isListSendable(value: unknown): value is ListSendableTemplate {
  return LIST_SENDABLE_TEMPLATES.includes(value as ListSendableTemplate);
}

/**
 * POST { template: "welcome", recipients } — admins only. Sends the template
 * to every address in `recipients` (a string of comma / newline separated
 * addresses, or an array), one email per address so nobody sees anyone
 * else's address. Addresses are validated and deduplicated first; any invalid
 * entry rejects the whole request so nothing goes out half-checked.
 *
 * Emails go through Resend's batch endpoint in groups of 100 with permissive
 * validation, so one address Resend refuses doesn't stop the others, and the
 * response lists each address with `ok` and an error when it failed.
 */
export async function POST(req: NextRequest) {
  const { isAdmin } = await getAdminAccess();
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { template?: unknown; recipients?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const template = body?.template ?? "welcome";
  if (!isListSendable(template)) {
    return NextResponse.json(
      { error: `Only ${LIST_SENDABLE_TEMPLATES.join(", ")} can be sent to a list.` },
      { status: 400 },
    );
  }
  const raw = body?.recipients;
  const isStringArray = Array.isArray(raw) && raw.every((entry) => typeof entry === "string");
  if (typeof raw !== "string" && !isStringArray) {
    return NextResponse.json({ error: "Provide recipients as a string or a list of addresses." }, { status: 400 });
  }

  const { valid, invalid } = parseRecipientList(raw as string | string[]);
  if (invalid.length > 0) {
    return NextResponse.json(
      { error: `Not email addresses: ${invalid.slice(0, 10).join(", ")}${invalid.length > 10 ? "…" : ""}`, invalid },
      { status: 400 },
    );
  }
  if (valid.length === 0) {
    return NextResponse.json({ error: "Add at least one email address." }, { status: 400 });
  }
  if (valid.length > MAX_BULK_RECIPIENTS) {
    return NextResponse.json(
      { error: `At most ${MAX_BULK_RECIPIENTS} addresses per send (got ${valid.length}).` },
      { status: 400 },
    );
  }

  const resendKey = getEnv("RESEND_API_KEY") || getEnv("AUTH_RESEND_KEY");
  if (!resendKey) {
    return NextResponse.json({ error: "RESEND_API_KEY is not set, so no email can be sent." }, { status: 503 });
  }

  let rendered;
  try {
    rendered = await renderEmail(template, { baseUrl: req.nextUrl.origin });
  } catch (error) {
    console.error(`Failed to render the "${template}" email:`, error);
    return NextResponse.json({ error: `Failed to render the "${template}" email.` }, { status: 500 });
  }

  const resend = new Resend(resendKey);
  const from = `${APP_NAME} <${APP_EMAIL}>`;
  const results: RecipientResult[] = [];
  for (let start = 0; start < valid.length; start += RESEND_BATCH_SIZE) {
    const chunk = valid.slice(start, start + RESEND_BATCH_SIZE);
    try {
      const { data, error } = await resend.batch.send(
        chunk.map((email) => ({ from, to: [email], subject: rendered.subject, html: rendered.html, text: rendered.text })),
        { batchValidation: "permissive" },
      );
      if (error || !data) {
        const message = error?.message || "Resend refused the batch.";
        for (const email of chunk) results.push({ email, ok: false, error: message });
        continue;
      }
      const failed = new Map((data.errors ?? []).map(({ index, message }) => [index, message]));
      const ids = data.data ?? [];
      let next = 0;
      chunk.forEach((email, index) => {
        const message = failed.get(index);
        if (message !== undefined) results.push({ email, ok: false, error: message });
        else results.push({ email, ok: true, id: ids[next++]?.id });
      });
    } catch (caught) {
      const message = (caught as Error)?.message ?? String(caught);
      for (const email of chunk) results.push({ email, ok: false, error: message });
    }
  }

  const sent = results.filter((result) => result.ok).length;
  if (sent < results.length) console.error(`Bulk ${template} email: ${results.length - sent} of ${results.length} failed.`);
  return NextResponse.json({ template, sent, failed: results.length - sent, results });
}
