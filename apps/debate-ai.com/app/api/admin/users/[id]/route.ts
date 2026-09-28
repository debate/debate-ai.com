import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getAdminAccess, isAdminEmail } from "@/lib/auth/admin";
import { getDBFromContext } from "@/lib/database/context";
import { describeError } from "@/lib/database/errors";
import { user } from "@/lib/database/schema";
import { deleteUserAccount } from "@/lib/admin/delete-user";
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

  const usage = await loadUserUsage(db, id);
  if (!usage) return NextResponse.json({ error: "User not found" }, { status: 404 });

  return NextResponse.json(usage);
}

/**
 * Permanently deletes an account, its sessions and everything it saved.
 * Admin accounts (the env allowlist, which includes the caller) are refused:
 * deleting one would only sign that admin out, and the allowlist would let
 * the address straight back in on the next sign-in anyway.
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { isAdmin } = await getAdminAccess();
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  try {
    const db = await getDBFromContext();
    const [target] = await db
      .select({ email: user.email })
      .from(user)
      .where(eq(user.id, id))
      .limit(1);
    if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });
    if (isAdminEmail(target.email)) {
      return NextResponse.json({ error: "Admin accounts can't be deleted from the panel" }, { status: 400 });
    }

    const deleted = await deleteUserAccount(db, id);
    if (!deleted) return NextResponse.json({ error: "User not found" }, { status: 404 });
    return NextResponse.json({ ok: true, user: deleted });
  } catch (error) {
    console.error("Failed to delete user:", describeError(error), error);
    return NextResponse.json(
      { error: "Failed to delete user", details: describeError(error) },
      { status: 500 },
    );
  }
}
