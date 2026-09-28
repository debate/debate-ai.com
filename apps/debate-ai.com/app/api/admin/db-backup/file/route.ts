import { NextResponse } from "next/server";
import { getAdminAccess } from "@/lib/auth/admin";
import { describeError } from "@/lib/database/errors";
import { getBackupBucket, isBackupKey } from "@/lib/admin/db-backup-r2";

/**
 * A backup stored in R2. The bucket is private; this admin-only route is the
 * link the admin panel hands out.
 *
 * GET    ?key=db-backups/… — download the `.sql.gz`
 * DELETE ?key=db-backups/… — remove it
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

  const object = await resolved.bucket.get(resolved.key);
  if (!object) return NextResponse.json({ error: "Backup not found" }, { status: 404 });

  const fileName = resolved.key.split("/").pop() ?? "backup.sql.gz";
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
    await resolved.bucket.delete(resolved.key);
    return NextResponse.json({ ok: true, key: resolved.key });
  } catch (error) {
    console.error("Error deleting R2 backup:", error);
    return NextResponse.json({ error: "Delete failed", details: describeError(error) }, { status: 500 });
  }
}
