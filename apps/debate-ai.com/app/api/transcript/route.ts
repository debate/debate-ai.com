/**
 * @fileoverview Fetches a YouTube video's transcript for the transcript
 * modal's synced captions panel.
 */

import { NextResponse } from "next/server";
import {
  fetchYouTubeTranscript,
  TranscriptUnavailableError,
} from "@/lib/youtube/transcript";

/** `videoId` values are 11-character YouTube ids — reject anything else outright. */
const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;

/**
 * Edge cache handle. YouTube bot-checks server IPs at random, so a transcript
 * that was fetched once is worth keeping: later viewers of the same video are
 * then served from cache instead of racing the rate limiter.
 */
function edgeCache(): Cache | undefined {
  return (globalThis as { caches?: { default?: Cache } }).caches?.default;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const videoId = searchParams.get("videoId");
  const lang = searchParams.get("lang") || "en";

  if (!videoId) {
    return NextResponse.json({ error: "Missing videoId" }, { status: 400 });
  }
  if (!VIDEO_ID_RE.test(videoId)) {
    return NextResponse.json({ error: "Invalid videoId" }, { status: 400 });
  }

  const cache = edgeCache();
  const cacheKey = new Request(request.url, { method: "GET" });
  const cached = await cache?.match(cacheKey).catch(() => undefined);
  if (cached) return cached;

  try {
    const snippets = await fetchYouTubeTranscript(videoId, lang);
    const response = NextResponse.json(
      { videoId, snippets },
      { headers: { "Cache-Control": "public, max-age=86400, s-maxage=604800" } },
    );
    await cache?.put(cacheKey, response.clone()).catch(() => undefined);
    return response;
  } catch (error) {
    const unavailable = error instanceof TranscriptUnavailableError;
    // YouTube rate-limits server IPs with a bot check; that is a transient
    // upstream problem rather than "this video has no captions", so it gets a
    // 503 and a short cache window instead of a sticky 404.
    const rateLimited = unavailable && /not a bot|LOGIN_REQUIRED/i.test(error.message);

    if (!unavailable) {
      console.error(`Failed to fetch transcript for ${videoId}:`, error);
    }

    return NextResponse.json(
      {
        error: rateLimited
          ? "YouTube is temporarily blocking transcript requests. Try again shortly."
          : "No transcript available for this video",
      },
      {
        status: rateLimited ? 503 : 404,
        headers: { "Cache-Control": rateLimited ? "no-store" : "public, max-age=3600" },
      },
    );
  }
}
