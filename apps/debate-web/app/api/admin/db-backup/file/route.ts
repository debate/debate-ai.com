import { NextResponse } from "next/server";
import { getAdminAccess } from "@/lib/auth/admin";
import { describeError } from "@/lib/database/errors";
import { deleteBackups, getBackupBucket, getBackupKv, isBackupKey } from "@/lib/admin/db-backup-r2";

/**
 * A stored backup. Both stores are private; this admin-only route is the link
 * the admin panel hands out.
 *
 * GET    ?key=db-backups/….sql.gz — download the gzip from R2
 * GET    ?key=db-backups/….sql.7z — download the 7z copy from KV
 * DELETE ?key=db-backups/….sql.gz — remove it and its 7z copy
 */
async function resolve(request: Request) {
  const { isAdmin } = await getAdminAccess();
  if (!isAdmin) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };

  const bucket = getBackupBucket();
  if (!bucket) return { error: NextResponse.json({ error: "R2 is not configured" }, { status: 503 }) };

  const key = new URL(request.url).searchParams.get("key") ?? "";
  if (!isBackupKey(key)) return { error: NextResponse.json({ error: "Invalid backup key" }, { status: 400 }) };

  return { bucket, key };
}

export async function GET(request: Request) {
  const resolved = await resolve(request);
  if ("error" in resolved) return resolved.error;
  const fileName = resolved.key.split("/").pop() ?? "backup.sql.gz";

  if (resolved.key.endsWith(".7z")) {
    const kv = getBackupKv();
    if (!kv) return NextResponse.json({ error: "KV is not configured" }, { status: 503 });
    const body = await kv.get(resolved.key, "stream");
    if (!body) return NextResponse.json({ error: "Backup not found" }, { status: 404 });
    return new Response(body, {
      headers: {
        "Content-Type": "application/x-7z-compressed",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const object = await resolved.bucket.get(resolved.key);
  if (!object) return NextResponse.json({ error: "Backup not found" }, { status: 404 });

  return new Response(object.body, {
    headers: {
      "Content-Type": object.httpMetadata?.contentType ?? "application/gzip",
      "Content-Length": String(object.size),
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}

export async function DELETE(request: Request) {
  const resolved = await resolve(request);
  if ("error" in resolved) return resolved.error;

  try {
    await deleteBackups(resolved.bucket, [resolved.key], getBackupKv());
    return NextResponse.json({ ok: true, key: resolved.key });
  } catch (error) {
    console.error("Error deleting R2 backup:", error);
    return NextResponse.json({ error: "Delete failed", details: describeError(error) }, { status: 500 });
  }
}
