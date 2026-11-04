import { NextResponse } from "next/server";
import { getAdminAccess } from "@/lib/auth/admin";
import { getDBFromContext } from "@/lib/database/context";
import { describeError } from "@/lib/database/errors";
import type { BackupDb } from "@/lib/admin/db-backup";
import { EXPORT_FORMATS, EXPORT_GROUP_LABELS, EXPORT_GROUPS, listExportTables } from "@/lib/admin/table-export";

/**
 * Table export (lib/admin/table-export.ts).
 *
 * GET — the exportable tables this database has, grouped, with row counts.
 * The files themselves stream from ./download.
 */
export async function GET() {
  const { isAdmin } = await getAdminAccess();
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const db = (await getDBFromContext()) as unknown as BackupDb;
    const tables = await listExportTables(db);
    return NextResponse.json({
      formats: EXPORT_FORMATS,
      groups: EXPORT_GROUPS.map((group) => ({
        key: group,
        label: EXPORT_GROUP_LABELS[group],
        tables: tables.filter((table) => table.group === group).map(({ name, rows }) => ({ name, rows })),
      })),
    });
  } catch (error) {
    console.error("Error listing export tables:", error);
    return NextResponse.json({ error: "Failed to list tables", details: describeError(error) }, { status: 500 });
  }
}
