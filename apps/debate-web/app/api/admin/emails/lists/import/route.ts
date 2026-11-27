import { NextResponse } from "next/server";
import { getAdminAccess } from "@/lib/auth/admin";
import { getDBFromContext } from "@/lib/database/context";
import { importCustomerList, previewCustomerImport } from "@/lib/emails/customers";
import { EmailListError } from "@/lib/emails/lists";

/**
 * "Import existing emails" for the admin Emails section — admins only.
 *
 * GET           — preview: how many subscribed customer addresses exist, where they come
 *                 from, how many unsubscribed were left out, and what a refresh of the
 *                 saved customers list would add and remove. Counts only; no addresses.
 * POST { name? } — saves every current customer as the "current customers" list, creating
 *                 it or refreshing it in place (no duplicates). `name` renames the list.
 */
const noStore = { "Cache-Control": "no-store" };

export async function GET() {
  if (!(await getAdminAccess()).isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const preview = await previewCustomerImport(await getDBFromContext());
  return NextResponse.json({ preview }, { headers: noStore });
}

export async function POST(req: Request) {
  const { isAdmin, email } = await getAdminAccess();
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as { name?: unknown } | null;
  try {
    const { list, report } = await importCustomerList(await getDBFromContext(), { name: body?.name }, email);
    const { emails: _emails, ...summary } = list;
    return NextResponse.json({ list: summary, report }, { headers: noStore });
  } catch (error) {
    if (error instanceof EmailListError) return NextResponse.json({ error: error.message }, { status: 400 });
    throw error;
  }
}
