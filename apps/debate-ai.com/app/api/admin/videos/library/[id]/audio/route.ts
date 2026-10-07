import { NextResponse, type NextRequest } from "next/server";
import { getStaffAccess } from "@/lib/auth/admin";
import {
  AUDIO_FORMATS,
  AudioExtractError,
  fetchVideoAudio,
  getAudioExtractStatus,
  transcribeVideoAudio,
  type AudioFormat,
} from "@/lib/youtube/audio-extract";
import { writeCachedTranscript } from "@/lib/youtube/transcript-cache";

/**
 * One video's audio track, for the videos YouTube has no captions for — see
 * `lib/youtube/audio-extract.ts` for the media API and Whisper behind it.
 *
 * - `GET ?status=1` — which halves are configured, so the dialog can say why
 *   a button is off.
 * - `GET ?format=mp3|m4a|webm` — the audio file itself, streamed through, for
 *   an editor to transcribe by hand or run elsewhere.
 * - `POST { language? }` — downloads and transcribes it, answering the same
 *   `{ snippets }` shape as `/api/transcript` so the dialog's caption import
 *   can fill the transcript box from it. The snippets are also stored as the
 *   video's timed captions, so the player's synced captions work for a video
 *   YouTube never captioned.
 */

const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;

function failure(error: unknown, fallback: string) {
  if (error instanceof AudioExtractError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error(`${fallback}:`, error);
  return NextResponse.json(
    { error: fallback, details: (error as Error)?.message ?? String(error) },
    { status: 500 },
  );
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { canEditContent } = await getStaffAccess();
  if (!canEditContent) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  if (searchParams.has("status")) {
    return NextResponse.json(getAudioExtractStatus());
  }

  const { id } = await params;
  if (!VIDEO_ID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid video id" }, { status: 400 });
  }
  const format = (searchParams.get("format") ?? "mp3") as AudioFormat;
  if (!AUDIO_FORMATS.includes(format)) {
    return NextResponse.json({ error: `format must be one of ${AUDIO_FORMATS.join(", ")}` }, { status: 400 });
  }

  try {
    const upstream = await fetchVideoAudio(id, { format });
    const headers = new Headers({
      "Content-Type": upstream.headers.get("content-type") ?? "application/octet-stream",
      "Content-Disposition":
        upstream.headers.get("content-disposition") ?? `attachment; filename="${id}.${format}"`,
      "Cache-Control": "no-store",
    });
    const length = upstream.headers.get("content-length");
    if (length) headers.set("Content-Length", length);
    return new Response(upstream.body, { status: 200, headers });
  } catch (error) {
    return failure(error, "Failed to download audio");
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { canEditContent } = await getStaffAccess();
  if (!canEditContent) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  if (!VIDEO_ID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid video id" }, { status: 400 });
  }

  const body = (await req.json().catch(() => ({}))) as { language?: unknown };
  const language =
    typeof body.language === "string" && /^[a-z]{2,3}$/i.test(body.language)
      ? body.language.toLowerCase()
      : "en";

  try {
    const result = await transcribeVideoAudio(id, { language });
    if (result.snippets.length === 0) {
      return NextResponse.json(
        { error: "The transcription came back empty — the audio may have no speech." },
        { status: 422 },
      );
    }
    await writeCachedTranscript(id, language, result.snippets);
    return NextResponse.json({ videoId: id, ...result });
  } catch (error) {
    return failure(error, "Failed to transcribe audio");
  }
}
