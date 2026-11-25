import { NextResponse } from "next/server";
import { getDBFromContext } from "@/lib/database/context";
import { getUserId } from "@/lib/auth/session";
import { ensureRebuttalRedoTables } from "@/lib/rebuttal-redos/ensure-tables";
import { getRedoRow, setRedoAudio, viewerRoleFor } from "@/lib/rebuttal-redos/store";
import { MAX_UPLOAD_BYTES, getRoundRecordingsBucket } from "@/lib/round-recordings/storage";

/**
 * A rebuttal redo's recording, kept in the private ROUND_RECORDINGS bucket
 * under `rebuttal-redos/<redoId>/take`.
 *
 * PUT — the debater uploads (or replaces) their take while the redo is
 *   assigned or turned in but not yet reviewed. Body is the audio.
 * GET — streams it back to the redo's debater or judge; nobody else.
 */

const AUDIO_TYPES = /^audio\/(webm|ogg|mp4|mpeg|wav)(;.*)?$/i;

const redoAudioKey = (redoId: string) => `rebuttal-redos/${redoId}/take`;

type Params = { params: Promise<{ redoId: string }> };

export async function PUT(request: Request, context: Params) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Sign in to upload your redo." }, { status: 401 });
  const bucket = getRoundRecordingsBucket();
  if (!bucket) return NextResponse.json({ error: "Recording storage is not configured." }, { status: 503 });

  const { redoId } = await context.params;
  const db = await getDBFromContext();
  await ensureRebuttalRedoTables(db);
  const row = await getRedoRow(db, redoId);
  if (!row || viewerRoleFor(row, userId) !== "student") return NextResponse.json({ error: "Redo not found." }, { status: 404 });
  if (row.status !== "assigned" && row.status !== "submitted") {
    return NextResponse.json({ error: "This redo can't take a new recording now." }, { status: 409 });
  }

  const contentType = request.headers.get("content-type");
  if (!contentType || !AUDIO_TYPES.test(contentType)) return NextResponse.json({ error: "Upload an audio recording." }, { status: 415 });
  if (Number(request.headers.get("content-length") ?? "0") > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "Recording too large." }, { status: 413 });
  }
  const body = await request.arrayBuffer();
  if (body.byteLength === 0) return NextResponse.json({ error: "Empty recording." }, { status: 400 });
  if (body.byteLength > MAX_UPLOAD_BYTES) return NextResponse.json({ error: "Recording too large." }, { status: 413 });

  const key = redoAudioKey(redoId);
  await bucket.put(key, body, { httpMetadata: { contentType } });
  await setRedoAudio(db, redoId, key, Math.floor(Date.now() / 1000));
  return NextResponse.json({ ok: true });
}

export async function GET(_request: Request, context: Params) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Sign in to listen." }, { status: 401 });
  const bucket = getRoundRecordingsBucket();
  if (!bucket) return NextResponse.json({ error: "Recording storage is not configured." }, { status: 503 });

  const { redoId } = await context.params;
  const db = await getDBFromContext();
  await ensureRebuttalRedoTables(db);
  const row = await getRedoRow(db, redoId);
  if (!row || !row.audioKey || !viewerRoleFor(row, userId)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const object = await bucket.get(row.audioKey);
  if (!object) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return new Response(object.body, {
    headers: {
      "Content-Type": object.httpMetadata?.contentType ?? "audio/webm",
      "Content-Length": String(object.size),
      "Cache-Control": "private, no-store",
    },
  });
}
