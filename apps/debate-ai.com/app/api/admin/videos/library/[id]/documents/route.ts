import { NextResponse, type NextRequest } from "next/server";
import { isVideoDocumentKind } from "debate-videos";
import { getAdminAccess } from "@/lib/auth/admin";
import { getDBFromContext } from "@/lib/database/context";
import {
  deleteVideoDocument,
  getVideoDocuments,
  saveVideoDocument,
} from "@/lib/videos/video-content";

/**
 * The long-form documents beside one video: the speech-by-speech transcript,
 * the AI summary, the written analysis.
 *
 * Kept off `/api/admin/videos/library/[id]` because these bodies run to tens
 * of thousands of words — the metadata editor should not carry a transcript
 * in and out of every one-field correction.
 */

/** Longest document body accepted, in characters. */
const MAX_BODY_LENGTH = 400_000;

/** Lists every document stored for this video. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { isAdmin } = await getAdminAccess();
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    return NextResponse.json({ documents: await getVideoDocuments(id) });
  } catch (error) {
    console.error("Failed to list video documents:", error);
    return NextResponse.json(
      { error: "Failed to load documents", details: (error as Error).message },
      { status: 500 },
    );
  }
}

/**
 * Writes one document, creating it when this video has none of that kind.
 *
 * The body is stored as given — markdown, whose `##` headings name the
 * speeches — and its word count is recomputed server-side so the tab strip
 * can never disagree with what is stored.
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { isAdmin, email } = await getAdminAccess();
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  let payload: { kind?: unknown; title?: unknown; body?: unknown; author?: unknown; model?: unknown };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!isVideoDocumentKind(payload?.kind)) {
    return NextResponse.json(
      { error: "kind must be one of transcript, summary, analysis" },
      { status: 400 },
    );
  }

  const body = typeof payload.body === "string" ? payload.body : "";
  if (body.length > MAX_BODY_LENGTH) {
    return NextResponse.json(
      { error: `Document is too long (${body.length} of ${MAX_BODY_LENGTH} characters)` },
      { status: 413 },
    );
  }

  try {
    const db = await getDBFromContext();
    const document = await saveVideoDocument(
      db,
      id,
      payload.kind,
      {
        title: typeof payload.title === "string" ? payload.title : null,
        body,
        author: typeof payload.author === "string" ? payload.author : null,
        model: typeof payload.model === "string" ? payload.model : null,
      },
      email,
    );
    return NextResponse.json({ ok: true, document });
  } catch (error) {
    console.error("Failed to save video document:", error);
    return NextResponse.json(
      { error: "Failed to save document", details: (error as Error).message },
      { status: 500 },
    );
  }
}

/** Removes one document — `?kind=transcript`. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { isAdmin } = await getAdminAccess();
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const kind = new URL(req.url).searchParams.get("kind");

  if (!isVideoDocumentKind(kind)) {
    return NextResponse.json(
      { error: "kind must be one of transcript, summary, analysis" },
      { status: 400 },
    );
  }

  try {
    const db = await getDBFromContext();
    const removed = await deleteVideoDocument(db, id, kind);
    if (!removed) {
      return NextResponse.json({ error: "No such document" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, kind });
  } catch (error) {
    console.error("Failed to delete video document:", error);
    return NextResponse.json(
      { error: "Failed to delete document", details: (error as Error).message },
      { status: 500 },
    );
  }
}
