/**
 * @fileoverview Admin-only Topic Starter importer.
 *
 * Accepts one `.docx` or a `.zip` of them, converts each to card HTML and
 * files it under a folder tree mirroring the archive. Imports are
 * fault-tolerant per file: one unreadable DOCX no longer aborts the batch, and
 * every failure comes back with a coded reason the admin UI can show and a
 * structured `console.error` line the server logs can be searched by.
 *
 * @module app/api/admin/topic-starters/route
 */
import { NextRequest, NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import {
  DOCX_IMPORT_LIMITS,
  collectDocxEntries,
  describeDocxImportError,
  docxBytesToHtml,
  formatBytes,
  summarizeImportOutcome,
  type DocxImportFailure,
} from "debate-card-parser";
import { getAdminAccess } from "@/lib/auth/admin";
import { getDBFromContext } from "@/lib/database/context";
import { topicStarterItems } from "@/lib/database/schema";
import { logImportEvent, newImportId } from "@/lib/admin/import-log";

export async function GET() {
  const { isAdmin } = await getAdminAccess();
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const db = await getDBFromContext();
  return NextResponse.json({
    items: await db.select().from(topicStarterItems).orderBy(asc(topicStarterItems.title)),
  });
}

export async function POST(request: NextRequest) {
  const importId = newImportId();
  const startedAt = Date.now();

  const { isAdmin, email } = await getAdminAccess();
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // The whole handler is wrapped so a thrown error can never reach the client
  // as an HTML error page — the uploader parses JSON, and an HTML body there
  // shows up as an unrelated "Unexpected token '<'" instead of the real cause.
  try {
    const form = await request.formData();
    const upload = form.get("file");
    if (!(upload instanceof File)) {
      return failure(importId, "no-file", "Choose a .docx or .zip file.", 400);
    }

    const rootName =
      form.get("title")?.toString().trim() || upload.name.replace(/\.(docx|zip)$/i, "");
    const published = form.get("published") !== "false";

    logImportEvent({
      importId,
      stage: "received",
      admin: email,
      fileName: upload.name,
      fileSize: upload.size,
      contentType: upload.type || null,
    });

    let entries;
    try {
      entries = await collectDocxEntries(upload.name, await upload.arrayBuffer());
    } catch (error) {
      const { code, reason } = describeDocxImportError(error);
      logImportEvent({
        importId,
        stage: "rejected",
        fileName: upload.name,
        fileSize: upload.size,
        code,
        reason,
        error,
      });
      return NextResponse.json({ importId, error: reason, code }, { status: 400 });
    }

    const db = await getDBFromContext();
    const [rootRow] = await db
      .insert(topicStarterItems)
      .values({
        title: rootName,
        isFolder: true,
        tags: JSON.stringify(["topic-starter"]),
        published,
      })
      .returning();
    const root = requireRow(rootRow, "root folder");

    const folders = new Map<string, number>([["", root.id]]);
    const failures: DocxImportFailure[] = [];
    let imported = 0;

    for (const entry of entries) {
      try {
        // Convert before touching the database so a bad file leaves no
        // half-created folder rows behind.
        const content = await docxBytesToHtml(entry.bytes);
        const parts = entry.path.split("/").filter(Boolean);
        let parentId = root.id;
        for (let index = 0; index < parts.length - 1; index++) {
          const path = parts.slice(0, index + 1).join("/");
          const existing = folders.get(path);
          if (existing !== undefined) {
            parentId = existing;
            continue;
          }
          const [folder] = await db
            .insert(topicStarterItems)
            .values({
              title: parts[index]!,
              parentId,
              isFolder: true,
              tags: JSON.stringify(["folder"]),
              published,
            })
            .returning();
          const folderId: number = requireRow(folder, "folder").id;
          folders.set(path, folderId);
          parentId = folderId;
        }

        await db.insert(topicStarterItems).values({
          title: parts.at(-1)!.replace(/\.docx$/i, ""),
          parentId,
          content,
          tags: JSON.stringify(["docx", published ? "public" : "private"]),
          published,
        });
        imported++;
      } catch (error) {
        const { code, reason } = describeDocxImportError(error);
        failures.push({ path: entry.path, code, reason });
        logImportEvent({
          importId,
          stage: "file-failed",
          fileName: entry.path,
          fileSize: entry.bytes.byteLength,
          code,
          reason,
          error,
        });
      }
    }

    // An import where every file failed leaves an empty folder that only
    // confuses the library, so drop the root we speculatively created.
    if (imported === 0) {
      await db.delete(topicStarterItems).where(eq(topicStarterItems.id, root.id));
    }

    const summary = summarizeImportOutcome(imported, failures);
    logImportEvent({
      importId,
      stage: imported === 0 ? "failed" : failures.length > 0 ? "partial" : "succeeded",
      fileName: upload.name,
      fileSize: upload.size,
      reason: summary,
      counts: { found: entries.length, imported, failed: failures.length },
      durationMs: Date.now() - startedAt,
    });

    return NextResponse.json(
      {
        importId,
        root: imported === 0 ? null : root,
        found: entries.length,
        imported,
        failures,
        summary,
        limits: {
          maxFiles: DOCX_IMPORT_LIMITS.maxFiles,
          maxFileSize: formatBytes(DOCX_IMPORT_LIMITS.maxFileBytes),
        },
        ...(imported === 0 ? { error: summary, code: failures[0]?.code ?? "unknown" } : {}),
      },
      { status: imported === 0 ? 422 : 201 },
    );
  } catch (error) {
    const { code, reason } = describeDocxImportError(error);
    logImportEvent({ importId, stage: "crashed", code, reason, error });
    return NextResponse.json(
      {
        importId,
        code,
        error: `The import failed before it could run: ${reason} (import ${importId})`,
      },
      { status: 500 },
    );
  }
}

/**
 * Asserts that an insert returned the row it was supposed to.
 *
 * Drizzle types `.returning()` as a possibly-empty array; a silent `undefined`
 * here would surface much later as an unexplained null parent id.
 */
function requireRow<T>(row: T | undefined, label: string): T {
  if (!row) throw new Error(`The database did not return the inserted ${label} row.`);
  return row;
}

/** Logs and returns an early rejection in the same shape as a run failure. */
function failure(importId: string, code: string, error: string, status: number) {
  logImportEvent({ importId, stage: "rejected", code, reason: error });
  return NextResponse.json({ importId, code, error }, { status });
}
