import { NextResponse } from "next/server";
import { getAdminAccess } from "@/lib/auth/admin";
import { getDBFromContext } from "@/lib/database/context";
import { loadBuyers } from "@/lib/admin/buyers";

/**
 * Everyone who has paid for something — Stripe plan subscribers, wallet
 * top-ups and file-market purchases — for the admin page's Buyers section.
 */
export async function GET() {
  const { isAdmin } = await getAdminAccess();
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const db = await getDBFromContext();
  return NextResponse.json(await loadBuyers(db));
}
