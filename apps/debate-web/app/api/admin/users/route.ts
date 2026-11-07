import { NextRequest, NextResponse } from "next/server";
import { getAdminAccess, getAdminEmails, isAdminEmail } from "@/lib/auth/admin";
import { getDBFromContext } from "@/lib/database/context";
import { DEFAULT_SORT, loadSiteUsageTotals, loadUserUsagePage } from "@/lib/admin/user-usage";

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

/**
 * Paginated user directory with per-user usage counters, for the admin page.
 * Supports search over name/email, an anonymous-account filter, and sorting
 * by any column — usage counters included — so power users and dormant
 * accounts can both be found without paging through the whole directory.
 */
export async function GET(req: NextRequest) {
  const { isAdmin } = await getAdminAccess();
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const db = await getDBFromContext();
  const { searchParams } = new URL(req.url);

  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || DEFAULT_LIMIT, 1), MAX_LIMIT);
  const page = Math.max(Number(searchParams.get("page")) || 1, 1);

  const [{ users, matchedUsers }, totals] = await Promise.all([
    loadUserUsagePage(db, {
      page,
      limit,
      search: searchParams.get("q")?.trim() || undefined,
      hideAnonymous: searchParams.get("hideAnonymous") === "true",
      sort: searchParams.get("sort") ?? DEFAULT_SORT,
      dir: searchParams.get("dir") === "asc" ? "asc" : "desc",
    }),
    loadSiteUsageTotals(db),
  ]);

  // Flags admin accounts so the table can leave out "Impersonate" for them —
  // admins can't impersonate admins (lib/auth/impersonation.ts).
  const adminEmails = getAdminEmails();
  return NextResponse.json({
    users: users.map((row: { email: string | null }) => ({ ...row, isAdmin: isAdminEmail(row.email, adminEmails) })),
    page,
    limit,
    pageCount: Math.max(Math.ceil(matchedUsers / limit), 1),
    matchedUsers,
    totals,
  });
}
