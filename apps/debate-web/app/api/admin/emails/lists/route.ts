import { NextResponse, type NextRequest } from "next/server";
import { getAdminAccess } from "@/lib/auth/admin";
import { getDBFromContext } from "@/lib/database/context";
import { EmailListError, deleteEmailList, getEmailList, listEmailLists, saveEmailList, validateListInput } from "@/lib/emails/lists";

/**
 * Saved email lists for the admin Emails section — admins only.
 *
 * GET                          — `{ lists }` (name and count of each).
 * GET ?id=<id>                 — `{ list }` with its addresses.
 * POST { id?, name, emails }   — creates a list, or replaces `id`. `emails` is the pasted
 *                                text; it is validated and deduplicated, and any invalid
 *                                entry rejects the save (400 with `invalid`).
 * DELETE ?id=<id>              — deletes a list.
 */
const noStore = { "Cache-Control": "no-store" };

async function adminEmail() {
  const { isAdmin, email } = await getAdminAccess();
  return isAdmin ? { email } : null;
}

export async function GET(req: NextRequest) {
  if (!(await adminEmail())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const db = await getDBFromContext();
  const id = req.nextUrl.searchParams.get("id");
  if (id === null) return NextResponse.json({ lists: await listEmailLists(db) }, { headers: noStore });
  const list = await getEmailList(db, id);
  if (!list) return NextResponse.json({ error: "List not found." }, { status: 404 });
  return NextResponse.json({ list }, { headers: noStore });
}

export async function POST(req: NextRequest) {
  const access = await adminEmail();
  if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = (await req.json().catch(() => null)) as { id?: unknown; name?: unknown; emails?: unknown } | null;
  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  if (body.id !== undefined && typeof body.id !== "string") {
    return NextResponse.json({ error: "id must be a string." }, { status: 400 });
  }

  let input;
  try {
    input = validateListInput(body.name, body.emails);
  } catch (error) {
    if (error instanceof EmailListError) {
      return NextResponse.json({ error: error.message, invalid: error.invalid }, { status: 400 });
    }
    throw error;
  }
  const db = await getDBFromContext();
  const list = await saveEmailList(db, { id: body.id, name: input.name, emails: input.emails }, access.email);
  if (!list) return NextResponse.json({ error: "List not found." }, { status: 404 });
  return NextResponse.json({ list, duplicates: input.duplicates }, { headers: noStore });
}

export async function DELETE(req: NextRequest) {
  if (!(await adminEmail())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Provide a list id." }, { status: 400 });
  await deleteEmailList(await getDBFromContext(), id);
  return NextResponse.json({ ok: true }, { headers: noStore });
}
