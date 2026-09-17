import { NextRequest, NextResponse } from "next/server";
import { getAdminAccess } from "@/lib/auth/admin";
import { getDBFromContext } from "@/lib/database/context";
import { loadUserUsage } from "@/lib/admin/user-usage";

/**
 * Single-user detail for the admin directory. Returns the same usage counters
 * the list view shows plus `updatedAt`, so the admin can inspect one account's
 * full activity snapshot.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { isAdmin } = await getAdminAccess();
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const db = await getDBFromContext();

  const user = await loadUserUsage(db, id);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  return NextResponse.json(user);
}
