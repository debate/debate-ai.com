import { NextResponse, type NextRequest } from "next/server";
import { getStaffAccess } from "@/lib/auth/admin";
import { describeError } from "@/lib/database/errors";
import {
  MAX_SPEECH_CLIP_BYTES,
  deleteSpeechClips,
  getSpeechAudioBucket,
  isSpeechClipName,
  isVideoId,
  listSpeechClips,
  speechClipKey,
  speechClipUrl,
} from "@/lib/videos/speech-audio-store";

/**
 * One round's per-speech MP3 clips — see `lib/videos/speech-audio-store.ts`.
 *
 * - `GET` — `{ configured, clips }`, the clips stored for the video.
 * - `GET ?file=01-1AC.mp3` — that clip, streamed.
 * - `PUT ?file=01-1AC.mp3` — stores the request body (`audio/mpeg`) as that clip.
 * - `DELETE` — removes every clip of the video, before a new split uploads its own.
 */

type Params = { params: Promise<{ id: string }> };

async function resolve(req: NextRequest, { params }: Params) {
  const { canEditContent } = await getStaffAccess();
  if (!canEditContent) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  const { id } = await params;
  if (!isVideoId(id)) return { error: NextResponse.json({ error: "Invalid video id" }, { status: 400 }) };
  const file = new URL(req.url).searchParams.get("file");
  if (file !== null && !isSpeechClipName(file)) {
    return { error: NextResponse.json({ error: "Invalid clip name" }, { status: 400 }) };
  }
  return { id, file, bucket: getSpeechAudioBucket() };
}

const NOT_CONFIGURED = "Speech clips need an R2 bucket bound as SPEECH_AUDIO.";

export async function GET(req: NextRequest, context: Params) {
  const resolved = await resolve(req, context);
  if ("error" in resolved) return resolved.error;
  const { id, file, bucket } = resolved;

  if (!file) {
    if (!bucket) return NextResponse.json({ configured: false, clips: [] });
    try {
      return NextResponse.json({ configured: true, clips: await listSpeechClips(bucket, id) });
    } catch (error) {
      return NextResponse.json({ error: "Failed to list clips", details: describeError(error) }, { status: 500 });
    }
  }

  if (!bucket) return NextResponse.json({ error: NOT_CONFIGURED }, { status: 501 });
  const object = await bucket.get(speechClipKey(id, file));
  if (!object) return NextResponse.json({ error: "Clip not found" }, { status: 404 });
  return new Response(object.body, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Content-Length": String(object.size),
      "Content-Disposition": `inline; filename="${id}-${file}"`,
      "Cache-Control": "private, max-age=300",
    },
  });
}

export async function PUT(req: NextRequest, context: Params) {
  const resolved = await resolve(req, context);
  if ("error" in resolved) return resolved.error;
  const { id, file, bucket } = resolved;
  if (!file) return NextResponse.json({ error: "Name the clip with ?file=" }, { status: 400 });
  if (!bucket) return NextResponse.json({ error: NOT_CONFIGURED }, { status: 501 });

  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_SPEECH_CLIP_BYTES) {
    return NextResponse.json({ error: "That clip is too large." }, { status: 413 });
  }
  const bytes = new Uint8Array(await req.arrayBuffer());
  if (bytes.length === 0) return NextResponse.json({ error: "The clip is empty." }, { status: 400 });
  if (bytes.length > MAX_SPEECH_CLIP_BYTES) {
    return NextResponse.json({ error: "That clip is too large." }, { status: 413 });
  }

  try {
    await bucket.put(speechClipKey(id, file), bytes, { httpMetadata: { contentType: "audio/mpeg" } });
    return NextResponse.json({ fileName: file, size: bytes.length, url: speechClipUrl(id, file) });
  } catch (error) {
    return NextResponse.json({ error: "Failed to store the clip", details: describeError(error) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: Params) {
  const resolved = await resolve(req, context);
  if ("error" in resolved) return resolved.error;
  const { id, bucket } = resolved;
  if (!bucket) return NextResponse.json({ removed: 0 });
  try {
    return NextResponse.json({ removed: await deleteSpeechClips(bucket, id) });
  } catch (error) {
    return NextResponse.json({ error: "Failed to remove clips", details: describeError(error) }, { status: 500 });
  }
}
