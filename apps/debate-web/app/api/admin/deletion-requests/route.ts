import { NextResponse } from "next/server";
import {
  DELETION_STATUSES,
  validateDeletionStatusUpdate,
  type DeletionStatus,
} from "@debate-ai/webview/lib/privacy/recording-release";
import { getAdminAccess } from "@/lib/auth/admin";
import { getDBFromContext } from "@/lib/database/context";
import { listAllDeletionRequests, updateDeletionRequestStatus } from "@/lib/privacy/store";

/**
 * The admin page's Deletion requests queue (admins only).
 *
 * GET   — every user's requests, pending first; `?status=` narrows to one.
 * PATCH — `{ id, status, note? }` records the admin's decision and notifies
 *         the requester. It deletes nothing: the admin does the deletion.
 */

export async function GET(request: Request) {
  const { isAdmin } = await getAdminAccess();
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const status = new URL(request.url).searchParams.get("status");
  if (status && !(DELETION_STATUSES as readonly string[]).includes(status)) {
    return NextResponse.json({ error: `status must be one of ${DELETION_STATUSES.join(", ")}.` }, { status: 400 });
  }
  const db = await getDBFromContext();
  const requests = await listAllDeletionRequests(db, status ? { status: status as DeletionStatus } : {});
  return NextResponse.json({ requests });
}

export async function PATCH(request: Request) {
  const { isAdmin } = await getAdminAccess();
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { value, errors } = validateDeletionStatusUpdate(await request.json().catch(() => null));
  if (!value) return NextResponse.json({ error: errors.join(" "), errors }, { status: 400 });

  const db = await getDBFromContext();
  const updated = await updateDeletionRequestStatus(db, value);
  if (!updated) return NextResponse.json({ error: "No deletion request has that id." }, { status: 404 });
  return NextResponse.json({ request: updated });
}
