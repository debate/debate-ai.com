/**
 * @fileoverview Fetches a YouTube video's timed captions without a browser.
 *
 * The public `/api/timedtext` URLs scraped from a watch page now come back
 * empty (HTTP 200, zero bytes) for non-browser callers, which is why the
 * transcript route used to 404 for every video. Asking InnerTube's `player`
 * endpoint as a mobile client still returns caption tracks whose `baseUrl`
 * serves real content, so that is what this uses. Plain `fetch` only, so it
 * runs unchanged on the Cloudflare Worker.
 */

/** One timed caption line. */
export interface TranscriptSnippet {
  /** Caption text with HTML entities decoded. */
  text: string;
  /** Offset from the start of the video, in seconds. */
  start: number;
  /** How long the line stays on screen, in seconds. */
  duration: number;
}

/** Public InnerTube key — the same one youtube.com ships in its own page source. */
const INNERTUBE_KEY = "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8";

/**
 * Mobile InnerTube clients, in the order they are tried. Desktop clients
 * ("WEB", "MWEB") answer UNPLAYABLE without a PO token, so they are skipped.
 */
const CLIENTS = [
  {
    userAgent: "com.google.ios.youtube/20.10.4 (iPhone16,2; U; CPU iOS 18_3_2 like Mac OS X)",
    client: {
      clientName: "IOS",
      clientVersion: "20.10.4",
      deviceMake: "Apple",
      deviceModel: "iPhone16,2",
      osName: "iPhone",
      osVersion: "18.3.2.22D82",
      hl: "en",
      gl: "US",
    },
  },
  {
    userAgent: "com.google.android.youtube/20.10.38 (Linux; U; Android 11) gzip",
    client: {
      clientName: "ANDROID",
      clientVersion: "20.10.38",
      androidSdkVersion: 30,
      osName: "Android",
      osVersion: "11",
      hl: "en",
      gl: "US",
    },
  },
] as const;

interface CaptionTrack {
  baseUrl: string;
  languageCode?: string;
  kind?: string;
}

/** YouTube's rate-limit response, which is transient rather than video-specific. */
const BOT_CHECK_RE = /not a bot|LOGIN_REQUIRED/i;

/** Thrown when no usable captions could be read for a video. */
export class TranscriptUnavailableError extends Error {
  constructor(videoId: string, reason: string) {
    super(`No transcript available for ${videoId}: ${reason}`);
    this.name = "TranscriptUnavailableError";
  }
}

/** Ask InnerTube for `videoId`'s caption track list as `client`. */
async function fetchCaptionTracks(
  videoId: string,
  clientConfig: (typeof CLIENTS)[number],
): Promise<{ tracks: CaptionTrack[]; status?: string }> {
  const response = await fetch(
    `https://www.youtube.com/youtubei/v1/player?key=${INNERTUBE_KEY}&prettyPrint=false`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": clientConfig.userAgent,
        "Accept-Language": "en-US,en",
      },
      body: JSON.stringify({
        videoId,
        context: { client: clientConfig.client },
        contentCheckOk: true,
        racyCheckOk: true,
      }),
    },
  );

  if (!response.ok) return { tracks: [], status: `HTTP ${response.status}` };

  const data = (await response.json()) as {
    playabilityStatus?: { status?: string; reason?: string };
    captions?: {
      playerCaptionsTracklistRenderer?: { captionTracks?: CaptionTrack[] };
    };
  };

  return {
    tracks: data.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [],
    status: data.playabilityStatus?.reason || data.playabilityStatus?.status,
  };
}

/**
 * Order caption tracks by usefulness: the requested language first, human
 * captions ahead of auto-generated ("asr") ones, then everything else.
 */
function rankTracks(tracks: CaptionTrack[], lang: string): CaptionTrack[] {
  const score = (track: CaptionTrack) => {
    const matchesLang = (track.languageCode ?? "").toLowerCase().startsWith(lang.toLowerCase());
    const isAuto = track.kind === "asr";
    if (matchesLang && !isAuto) return 0;
    if (matchesLang) return 1;
    if (!isAuto) return 2;
    return 3;
  };
  return [...tracks].sort((a, b) => score(a) - score(b));
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  "#39": "'",
  nbsp: " ",
};

/** Decode the (small) set of HTML entities YouTube emits in caption text. */
function decodeEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity: string) => {
    if (ENTITIES[entity]) return ENTITIES[entity];
    if (entity.startsWith("#x") || entity.startsWith("#X")) {
      return String.fromCodePoint(parseInt(entity.slice(2), 16));
    }
    if (entity.startsWith("#")) return String.fromCodePoint(parseInt(entity.slice(1), 10));
    return match;
  });
}

/** Parse the `fmt=json3` caption payload. */
function parseJson3(body: string): TranscriptSnippet[] {
  const data = JSON.parse(body) as {
    events?: Array<{ tStartMs?: number; dDurationMs?: number; segs?: Array<{ utf8?: string }> }>;
  };
  const snippets: TranscriptSnippet[] = [];
  for (const event of data.events ?? []) {
    const text = (event.segs ?? [])
      .map((seg) => seg.utf8 ?? "")
      .join("")
      .replace(/\s+/g, " ")
      .trim();
    if (!text || event.tStartMs == null) continue;
    snippets.push({
      text: decodeEntities(text),
      start: event.tStartMs / 1000,
      duration: (event.dDurationMs ?? 0) / 1000,
    });
  }
  return snippets;
}

/** Parse the legacy/`srv3` XML caption payload (`<p t="…" d="…">` or `<text start="…">`). */
function parseXml(body: string): TranscriptSnippet[] {
  const snippets: TranscriptSnippet[] = [];
  const lineRe = /<(?:p|text)\b([^>]*)>([\s\S]*?)<\/(?:p|text)>/g;
  let match: RegExpExecArray | null;
  while ((match = lineRe.exec(body)) !== null) {
    const [, attrs, inner] = match;
    const startMs = attrs.match(/\bt="(-?[\d.]+)"/)?.[1];
    const startSec = attrs.match(/\bstart="(-?[\d.]+)"/)?.[1];
    const durMs = attrs.match(/\bd="([\d.]+)"/)?.[1];
    const durSec = attrs.match(/\bdur="([\d.]+)"/)?.[1];
    if (startMs == null && startSec == null) continue;

    const text = decodeEntities(inner.replace(/<[^>]*>/g, ""))
      .replace(/\s+/g, " ")
      .trim();
    if (!text) continue;

    snippets.push({
      text,
      start: startMs != null ? Number(startMs) / 1000 : Number(startSec),
      duration: durMs != null ? Number(durMs) / 1000 : durSec != null ? Number(durSec) : 0,
    });
  }
  return snippets;
}

/** Download and parse one caption track, preferring the JSON payload. */
async function fetchTrack(track: CaptionTrack, userAgent: string): Promise<TranscriptSnippet[]> {
  const url = new URL(track.baseUrl);
  url.searchParams.set("fmt", "json3");

  const response = await fetch(url.toString(), {
    headers: { "User-Agent": userAgent, "Accept-Language": "en-US,en" },
  });
  if (!response.ok) return [];

  const body = (await response.text()).trim();
  if (!body) return [];
  // Some tracks ignore `fmt` and answer with srv3 XML regardless.
  if (body.startsWith("{")) {
    try {
      return parseJson3(body);
    } catch {
      return [];
    }
  }
  return parseXml(body);
}

/**
 * Fetch `videoId`'s transcript, preferring `lang` captions.
 *
 * @throws {TranscriptUnavailableError} when the video has no readable captions.
 */
export async function fetchYouTubeTranscript(
  videoId: string,
  lang = "en",
): Promise<TranscriptSnippet[]> {
  let lastReason = "no captions found";

  // A bot check is probabilistic rather than a verdict on the video, so one
  // short retry is worth it before giving up.
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) {
      if (!BOT_CHECK_RE.test(lastReason)) break;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    for (const clientConfig of CLIENTS) {
      let tracks: CaptionTrack[] = [];
      try {
        const result = await fetchCaptionTracks(videoId, clientConfig);
        tracks = result.tracks;
        if (result.status && result.status !== "OK") lastReason = result.status;
      } catch (error) {
        lastReason = error instanceof Error ? error.message : String(error);
        continue;
      }

      for (const track of rankTracks(tracks, lang)) {
        try {
          const snippets = await fetchTrack(track, clientConfig.userAgent);
          if (snippets.length > 0) return snippets;
        } catch (error) {
          lastReason = error instanceof Error ? error.message : String(error);
        }
      }
    }
  }

  throw new TranscriptUnavailableError(videoId, lastReason);
}
