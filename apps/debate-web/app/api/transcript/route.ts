/**
 * @fileoverview Serves a YouTube video's transcript for the transcript modal
 * and the player's synced captions panel.
 *
 * Three layers sit in front of YouTube, because YouTube bot-checks server IPs
 * at random and a blocked fetch has no fallback: the edge cache, then the
 * `video_transcripts` table (every transcript ever fetched, kept because a
 * video's captions don't change), then the fetcher itself — whose result is
 * written back to the table.
 *
 * Nothing here answers with an error status. A video with no captions, a
 * YouTube bot check, a database hiccup — each is an empty transcript with a
 * reason, logged as a warning, because the worker logs count every 5xx as an
 * exception and none of these is a fault in this app. A video that has no
 * captions (as opposed to a bot check, which comes and goes) is also filed
 * for the admin Reports panel as needing a transcript — see
 * `lib/youtube/transcript-needed.ts`.
 */

import { NextResponse } from "next/server";
import {
  fetchYouTubeTranscript,
  TranscriptUnavailableError,
} from "@/lib/youtube/transcript";
import { readCachedTranscript, writeCachedTranscript } from "@/lib/youtube/transcript-cache";
import { flagMissingTranscript } from "@/lib/youtube/transcript-needed";

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

/** An empty transcript with the reason the viewer is shown. */
function emptyTranscript(videoId: string, reason: string, cacheControl = "no-store") {
  return NextResponse.json(
    { videoId, snippets: [], unavailable: reason },
    { headers: { "Cache-Control": cacheControl } },
  );
}

export async function GET(request: Request) {
  try {
    return await serveTranscript(request);
  } catch (error) {
    // Anything the layers below did not already catch — a malformed cache
    // entry, a runtime quirk — still must not reach the logs as a 500.
    const videoId = new URL(request.url).searchParams.get("videoId") ?? "";
    console.warn(`Transcript request failed for ${videoId}:`, error);
    return emptyTranscript(videoId, "No transcript available for this video");
  }
}

async function serveTranscript(request: Request) {
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
  // Responses from the Cache API have immutable headers; Next.js's runtime
  // needs to write to the response headers, so re-wrap it first.
  if (cached) return new Response(cached.body, cached);

  const stored = await readCachedTranscript(videoId, lang);
  if (stored) {
    const response = NextResponse.json(
      { videoId, snippets: stored },
      { headers: { "Cache-Control": "public, max-age=86400, s-maxage=604800" } },
    );
    await cache?.put(cacheKey, response.clone()).catch(() => undefined);
    return response;
  }

  try {
    const snippets = await fetchYouTubeTranscript(videoId, lang);
    // Keep what YouTube gave us, so this video never has to be fetched again.
    await writeCachedTranscript(videoId, lang, snippets);
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
    // short cache window instead of a sticky one.
    const rateLimited = unavailable && /not a bot|LOGIN_REQUIRED/i.test(error.message);

    // Some videos simply have no transcript, and YouTube's bot check comes and
    // goes. Neither is a server fault, so answer 200 with an empty transcript
    // and a reason instead of a 4xx/5xx the worker logs flag as errors.
    if (unavailable) {
      console.warn(
        `Transcript unavailable for ${videoId} (${rateLimited ? "rate limited" : "no captions"})`,
      );
    } else {
      console.warn(`Transcript unavailable for ${videoId} (fetch failed):`, error);
    }

    // A bot check says nothing about the video; anything else means viewers
    // are getting no transcript for it, which an editor can fix.
    if (!rateLimited) {
      await flagMissingTranscript(
        videoId,
        unavailable
          ? "YouTube has no captions for this video."
          : `Fetching YouTube's captions failed: ${error instanceof Error ? error.message : String(error)}`.slice(0, 500),
      );
    }

    return emptyTranscript(
      videoId,
      rateLimited
        ? "YouTube is temporarily blocking transcript requests. Try again shortly."
        : "No transcript available for this video",
      rateLimited || !unavailable ? "no-store" : "public, max-age=3600",
    );
  }
}
