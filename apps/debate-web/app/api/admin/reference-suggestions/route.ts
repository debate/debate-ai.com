import { NextResponse } from "next/server";
import { isSuggestionStatus } from "@debate-ai/help-docs/lib/reference-suggestions";
import { getStaffAccess } from "@/lib/auth/admin";
import { getDBFromContext } from "@/lib/database/context";
import {
  countSuggestionsByStatus,
  deleteSuggestion,
  ensureSuggestionsTable,
  listSuggestions,
  setSuggestionStatus,
} from "@/lib/reference-suggestions/store";

/**
 * The admin page's Reference text tab: card text readers suggested for
 * References entries (admins and moderators).
 *
 * GET ?status=pending|approved|dismissed — the newest suggestions (all when omitted), with counts per status.
 * PATCH { id, status }                   — approve, dismiss or reopen one.
 * DELETE ?id=…                           — removes one.
 */

export async function GET(request: Request) {
  const { canEditContent } = await getStaffAccess();
  if (!canEditContent) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const status = new URL(request.url).searchParams.get("status");
  if (status && !isSuggestionStatus(status)) {
    return NextResponse.json({ error: "status must be pending, approved or dismissed." }, { status: 400 });
  }
  const db = await getDBFromContext();
  await ensureSuggestionsTable(db);
  const [suggestions, counts] = await Promise.all([
    listSuggestions(db, status && isSuggestionStatus(status) ? status : undefined),
    countSuggestionsByStatus(db),
  ]);
  return NextResponse.json({ suggestions, counts }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: Request) {
  const { canEditContent, email } = await getStaffAccess();
  if (!canEditContent) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = (await request.json().catch(() => null)) as { id?: unknown; status?: unknown } | null;
  const id = typeof body?.id === "string" ? body.id.trim() : "";
  if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });
  if (!isSuggestionStatus(body?.status)) {
    return NextResponse.json({ error: "status must be pending, approved or dismissed." }, { status: 400 });
  }
  const db = await getDBFromContext();
  await ensureSuggestionsTable(db);
  const found = await setSuggestionStatus(db, id, body.status, email);
  if (!found) return NextResponse.json({ error: "Suggestion not found." }, { status: 404 });
  return NextResponse.json({ ok: true, id, status: body.status });
}

export async function DELETE(request: Request) {
  const { canEditContent } = await getStaffAccess();
  if (!canEditContent) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const id = new URL(request.url).searchParams.get("id")?.trim() ?? "";
  if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });
  const db = await getDBFromContext();
  await ensureSuggestionsTable(db);
  const found = await deleteSuggestion(db, id);
  if (!found) return NextResponse.json({ error: "Suggestion not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
