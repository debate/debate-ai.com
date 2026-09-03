/**
 * @fileoverview Fetches a YouTube video's transcript (via `extract-youtube`)
 * for the transcript modal's synced captions panel.
 */

import { NextResponse } from "next/server";
import { YouTubeTranscriptApi } from "extract-youtube";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const videoId = searchParams.get("videoId");

  if (!videoId) {
    return NextResponse.json({ error: "Missing videoId" }, { status: 400 });
  }

  try {
    const api = new YouTubeTranscriptApi();
    const transcript = await api.fetchTranscript(videoId);
    const snippets = transcript.snippets.map((s) => ({
      text: typeof s.text === "string" ? s.text : "",
      start: s.start,
      duration: s.duration,
    }));

    return NextResponse.json(
      { videoId, snippets },
      { headers: { "Cache-Control": "public, max-age=86400" } },
    );
  } catch (error: any) {
    console.error(`Failed to fetch transcript for ${videoId}:`, error);
    return NextResponse.json(
      { error: error?.message || "No transcript available for this video" },
      { status: 404 },
    );
  }
}
