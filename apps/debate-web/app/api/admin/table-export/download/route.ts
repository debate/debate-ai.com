import { NextResponse } from "next/server";
import { getAdminAccess } from "@/lib/auth/admin";
import { getDBFromContext } from "@/lib/database/context";
import type { BackupDb } from "@/lib/admin/db-backup";
import { zipFilesStream } from "@/lib/admin/zip";
import {
  exportTableExists,
  isExportFormat,
  parseExportTables,
  tableExportFileName,
  tableExportStream,
} from "@/lib/admin/table-export";

const CONTENT_TYPES = { csv: "text/csv; charset=utf-8", json: "application/json; charset=utf-8" } as const;

/**
 * Streams every row of the picked tables — no cap.
 *
 * `?tables=videos,school_profiles&format=csv|json` (CSV by default). One table
 * downloads as a plain file; several (or `&zip=1`) as a zip with one file per
 * table. Only tables on the export allowlist are accepted.
 */
export async function GET(request: Request) {
  const { isAdmin } = await getAdminAccess();
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const params = new URL(request.url).searchParams;
  const rawFormat = params.get("format") ?? "csv";
  if (!isExportFormat(rawFormat)) {
    return NextResponse.json({ error: "Unknown format", details: "Use csv or json." }, { status: 400 });
  }
  const format = rawFormat;
  const requested = parseExportTables(params.get("tables"));
  if (requested.length === 0) {
    return NextResponse.json({ error: "No exportable tables picked" }, { status: 400 });
  }

  const db = (await getDBFromContext()) as unknown as BackupDb;
  const tables = [];
  for (const table of requested) {
    if (await exportTableExists(db, table.name)) tables.push(table);
  }
  if (tables.length === 0) {
    return NextResponse.json({ error: "None of those tables exist in this database" }, { status: 404 });
  }

  const now = new Date();
  if (tables.length === 1 && params.get("zip") !== "1") {
    const [table] = tables;
    return new Response(tableExportStream(db, table, format), {
      headers: {
        "Content-Type": CONTENT_TYPES[format],
        "Content-Disposition": `attachment; filename="${tableExportFileName(table.name, format, now)}"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const zip = zipFilesStream(
    tables.map((table) => ({ name: `${table.name}.${format}`, open: () => tableExportStream(db, table, format) })),
    now,
  );
  return new Response(zip, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${tableExportFileName("debate-ai-tables", "zip", now)}"`,
      "Cache-Control": "no-store",
    },
  });
}
