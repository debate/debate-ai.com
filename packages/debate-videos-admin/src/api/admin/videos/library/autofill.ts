import { NextResponse, type NextRequest } from "next/server";
import { getStaffAccess } from "@/lib/auth/admin";
import { autofillVideo } from "@/lib/videos/video-autofill";

/** A YouTube video id: 11 URL-safe base64 characters. */
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

/**
 * Suggests metadata for the admin video form ("Auto-fill with AI").
 *
 * Body: `{ videoId, title?, channel?, description? }` — what the form holds
 * now. Returns `{ fields, fromYouTube, fromAi, warnings }`; writes nothing.
 * See `lib/videos/video-autofill.ts`.
 */
export async function POST(req: NextRequest) {
  const { canEditContent } = await getStaffAccess();
  if (!canEditContent) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const videoId = body?.videoId;
  if (typeof videoId !== "string" || !VIDEO_ID.test(videoId)) {
    return NextResponse.json({ error: "`videoId` must be a YouTube video id" }, { status: 400 });
  }
  const optional = (value: unknown) => (typeof value === "string" ? value : null);

  try {
    const result = await autofillVideo({
      videoId,
      title: optional(body.title),
      channel: optional(body.channel),
      description: optional(body.description),
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 502 },
    );
  }
}
