import { NextResponse } from "next/server";
import { getAdminAccess } from "@/lib/auth/admin";
import { getDBFromContext } from "@/lib/database/context";
import { deleteResendKey, resendKeyStatus, saveResendKey } from "@/lib/emails/settings";
import { isValidResendKey } from "@/lib/emails/bulk";

/**
 * The Resend API key for the admin Emails section — admins only. The key is
 * stored encrypted and never sent back: every response carries only the
 * status (`ResendKeyStatus`: whether one is saved and its last four characters).
 *
 * GET                  — `{ status }`.
 * POST { key }         — saves (or replaces) the key.
 * DELETE               — removes the saved key; the `RESEND_API_KEY` env secret, if any, takes over.
 */
const noStore = { "Cache-Control": "no-store" };

async function adminEmail() {
  const { isAdmin, email } = await getAdminAccess();
  return isAdmin ? { email } : null;
}

export async function GET() {
  if (!(await adminEmail())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json({ status: await resendKeyStatus(await getDBFromContext()) }, { headers: noStore });
}

export async function POST(request: Request) {
  const access = await adminEmail();
  if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = (await request.json().catch(() => null)) as { key?: unknown } | null;
  const key = typeof body?.key === "string" ? body.key.trim() : "";
  if (!isValidResendKey(key)) {
    return NextResponse.json({ error: "That does not look like a Resend API key (it starts with re_)." }, { status: 400 });
  }
  const db = await getDBFromContext();
  await saveResendKey(db, key, access.email);
  return NextResponse.json({ status: await resendKeyStatus(db) }, { headers: noStore });
}

export async function DELETE() {
  if (!(await adminEmail())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const db = await getDBFromContext();
  await deleteResendKey(db);
  return NextResponse.json({ status: await resendKeyStatus(db) }, { headers: noStore });
}
