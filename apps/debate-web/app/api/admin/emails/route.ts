import { NextResponse, type NextRequest } from "next/server";
import { Resend } from "resend";
import { EMAIL_TEMPLATES, isEmailTemplateId, renderEmailPreview } from "@debate/emails";
import { getAdminAccess } from "@/lib/auth/admin";
import { getEnv } from "@/lib/env";
import { APP_EMAIL, APP_NAME } from "@debate/webview/lib/config/site";

/**
 * Email template previews for the admin Emails section — admins only.
 *
 * GET lists every `@debate/emails` template. GET ?template=<id> renders that
 * template with its sample data, linked to this deployment's origin, and
 * returns `{ subject, html, text }`. Rendering here rather than in the browser
 * previews exactly what the Worker sends.
 *
 * POST { template } sends the sample to the signed-in admin's own address
 * through Resend, so a template can be checked in a real inbox.
 */
export async function GET(req: NextRequest) {
  const { isAdmin } = await getAdminAccess();
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const id = req.nextUrl.searchParams.get("template");
  if (id === null) {
    return NextResponse.json({
      templates: EMAIL_TEMPLATES.map(({ id, name, description, sentFrom }) => ({ id, name, description, sentFrom })),
    });
  }
  if (!isEmailTemplateId(id)) {
    return NextResponse.json({ error: `Unknown email template "${id}".` }, { status: 404 });
  }
  return NextResponse.json(await renderEmailPreview(id, req.nextUrl.origin));
}

export async function POST(req: NextRequest) {
  const { isAdmin, email } = await getAdminAccess();
  if (!isAdmin || !email) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { template?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!isEmailTemplateId(body?.template)) {
    return NextResponse.json({ error: "Provide a known email template." }, { status: 400 });
  }

  const resendKey = getEnv("RESEND_API_KEY") || getEnv("AUTH_RESEND_KEY");
  if (!resendKey) {
    return NextResponse.json({ error: "RESEND_API_KEY is not set, so no email can be sent." }, { status: 503 });
  }

  const rendered = await renderEmailPreview(body.template, req.nextUrl.origin);
  const { error } = await new Resend(resendKey).emails.send({
    from: `${APP_NAME} <${APP_EMAIL}>`,
    to: email,
    subject: `[Test] ${rendered.subject}`,
    html: rendered.html,
    text: rendered.text,
  });
  if (error) {
    console.error("Failed to send test email:", error);
    return NextResponse.json({ error: error.message || "Resend refused the email." }, { status: 502 });
  }
  return NextResponse.json({ ok: true, to: email });
}
