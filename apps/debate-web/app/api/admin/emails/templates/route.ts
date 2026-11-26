import { NextResponse, type NextRequest } from "next/server";
import { WELCOME_TEMPLATE_STARTER } from "@debate-ai/emails";
import { getAdminAccess } from "@/lib/auth/admin";
import { getDBFromContext } from "@/lib/database/context";
import { renderCustomEmail } from "@/lib/emails/render";
import {
  TemplateInputError,
  deleteSavedTemplate,
  listSavedTemplates,
  saveSavedTemplate,
  validateTemplateInput,
} from "@/lib/emails/saved-templates";

/**
 * Saved email templates (subject and plain-text body) for the admin Emails
 * section — admins only.
 *
 * GET                                      — `{ templates, starter }`; `starter` is the Welcome email as text.
 * POST { id?, name, subject, body }        — creates a template, or replaces `id`.
 * POST { action: "preview", subject, body } — `{ subject, html, text }` rendered like a real send.
 * DELETE ?id=<id>                          — deletes a template.
 */
const noStore = { "Cache-Control": "no-store" };

async function adminEmail() {
  const { isAdmin, email } = await getAdminAccess();
  return isAdmin ? { email } : null;
}

export async function GET() {
  if (!(await adminEmail())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const templates = await listSavedTemplates(await getDBFromContext());
  return NextResponse.json({ templates, starter: WELCOME_TEMPLATE_STARTER }, { headers: noStore });
}

export async function POST(req: NextRequest) {
  const access = await adminEmail();
  if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });

  let input;
  try {
    input =
      body.action === "preview"
        ? validateTemplateInput({ name: "preview", subject: body.subject, body: body.body })
        : validateTemplateInput(body);
  } catch (error) {
    if (error instanceof TemplateInputError) return NextResponse.json({ error: error.message }, { status: 400 });
    throw error;
  }

  if (body.action === "preview") {
    try {
      return NextResponse.json(
        await renderCustomEmail({ subject: input.subject, body: input.body, baseUrl: req.nextUrl.origin }),
        { headers: noStore },
      );
    } catch (error) {
      console.error("Failed to render a custom email preview:", error);
      return NextResponse.json({ error: "Failed to render the email." }, { status: 500 });
    }
  }

  if (body.id !== undefined && typeof body.id !== "string") {
    return NextResponse.json({ error: "id must be a string." }, { status: 400 });
  }
  const template = await saveSavedTemplate(await getDBFromContext(), { id: body.id as string | undefined, ...input }, access.email);
  if (!template) return NextResponse.json({ error: "Template not found." }, { status: 404 });
  return NextResponse.json({ template }, { headers: noStore });
}

export async function DELETE(req: NextRequest) {
  if (!(await adminEmail())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Provide a template id." }, { status: 400 });
  await deleteSavedTemplate(await getDBFromContext(), id);
  return NextResponse.json({ ok: true }, { headers: noStore });
}
