import { NextResponse } from "next/server";
import { getStaffAccess } from "@/lib/auth/admin";

/**
 * The signed-in viewer's staff role, for client UI that shows edit controls
 * (e.g. the "Edit video" button on a watch page) only to admins and
 * moderators. Public pages stay cacheable because they ask here instead of
 * reading the session server-side.
 */
export async function GET() {
  const { role, isAdmin, isModerator, canEditContent } = await getStaffAccess();
  return NextResponse.json(
    { role, isAdmin, isModerator, canEditContent },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
