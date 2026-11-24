import { NextResponse } from "next/server";
import { getAdminAccess } from "@/lib/auth/admin";
import { getDBFromContext } from "@/lib/database/context";
import { deleteFeedback, ensureFeedbackTable, listFeedback } from "@/lib/feedback/store";

/**
 * The admin page's Feedback tab (admins only).
 *
 * GET           — the newest submissions from the Settings footer's Feedback dialog.
 * DELETE ?id=N  — removes one submission.
 */

export async function GET() {
  const { isAdmin } = await getAdminAccess();
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const db = await getDBFromContext();
  await ensureFeedbackTable(db);
  return NextResponse.json({ feedback: await listFeedback(db) }, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(request: Request) {
  const { isAdmin } = await getAdminAccess();
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "id must be a positive integer." }, { status: 400 });
  const db = await getDBFromContext();
  await ensureFeedbackTable(db);
  await deleteFeedback(db, id);
  return NextResponse.json({ ok: true });
}
