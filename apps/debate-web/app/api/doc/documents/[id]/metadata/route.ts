import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { parseFileMetadata } from "@debate-ai/file-market";
import { getDBFromContext } from "@/lib/database/context";
import { documents } from "@/lib/database/schema";
import { getUserId } from "@/lib/auth/session";
import { withRouteErrors } from "@/lib/api/route-errors";
import { getFileMetadata, saveFileMetadata } from "@/lib/market/publishers";
import { PurchaseRefused } from "@/lib/market/queries";

/**
 * A file's publication details: author, publisher, research group, student
 * authors, seasons and publication date.
 *
 * GET — the details, the publisher they name, and the viewer's own
 *   publishers for the edit dialog's picker.
 * PUT — saves them. The publisher, when set, must be one the viewer runs.
 *
 * Only the file's owner may read or edit them here; the public side of a
 * published file is the publisher's page (`/api/market/publishers/<slug>`).
 */

async function ownedDocument(id: number, userId: string | null) {
  const db = await getDBFromContext();
  const [doc] = await db
    .select({ id: documents.id, userId: documents.userId, isFolder: documents.isFolder })
    .from(documents)
    .where(eq(documents.id, id))
    .limit(1);
  if (!doc) return { db, error: NextResponse.json({ error: "Document not found" }, { status: 404 }) };
  if (doc.userId && doc.userId !== userId) {
    return { db, error: NextResponse.json({ error: "Unauthorized" }, { status: 403 }) };
  }
  if (doc.isFolder) return { db, error: NextResponse.json({ error: "Folders have no details." }, { status: 400 }) };
  return { db, error: null };
}

export const GET = withRouteErrors(
  "GET /api/doc/documents/[id]/metadata",
  async (_req: Request, context: { params: Promise<{ id: string }> }) => {
    const id = Number((await context.params).id);
    const userId = await getUserId();
    const { db, error } = await ownedDocument(id, userId);
    if (error) return error;
    return NextResponse.json(await getFileMetadata(db, id, userId));
  },
);

export const PUT = withRouteErrors(
  "PUT /api/doc/documents/[id]/metadata",
  async (req: Request, context: { params: Promise<{ id: string }> }) => {
    const id = Number((await context.params).id);
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: "Sign in to edit this file's details." }, { status: 401 });
    const { db, error } = await ownedDocument(id, userId);
    if (error) return error;

    let payload: unknown;
    try {
      payload = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }
    const parsed = parseFileMetadata(payload);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

    try {
      return NextResponse.json(await saveFileMetadata(db, id, userId, parsed.value));
    } catch (err) {
      if (err instanceof PurchaseRefused) return NextResponse.json({ error: err.message }, { status: err.status });
      throw err;
    }
  },
);
