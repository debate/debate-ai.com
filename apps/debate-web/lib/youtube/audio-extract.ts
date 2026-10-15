/**
 * @fileoverview Pulls a video's audio track and turns it into timed captions,
 * for the videos YouTube has no captions for.
 *
 * Downloading YouTube media needs `cloud-ytdl` (signature decoding over Node
 * sockets) and ffmpeg for MP3 — neither runs on this Worker. So the download
 * is done by the `extract-youtube/download` media API hosted on a Node box
 * (`npx extract-youtube serve-media`), and this file only talks HTTP to it:
 * `YOUTUBE_AUDIO_SERVICE_URL` is that API's base URL, and
 * `YOUTUBE_AUDIO_SERVICE_KEY` the `MEDIA_API_KEY` it was started with.
 *
 * Transcription goes to an OpenAI-compatible `/audio/transcriptions`
 * endpoint: Groq's Whisper when `GROQ_API_KEY` is set (fast, cheap), else
 * OpenAI's when `OPENAI_API_KEY` is. Both cap uploads at 25 MB, which is why
 * the audio is requested as 32 kbps mono 16 kHz MP3 — about 14 MB an hour,
 * so rounds up to ~1h45 fit, and Whisper resamples to 16 kHz mono anyway.
 */

import { getEnv } from "@/lib/env";
import type { TranscriptSnippet } from "@/lib/youtube/transcript";

/** Audio containers the media API serves. */
export type AudioFormat = "mp3" | "m4a" | "webm";

export const AUDIO_FORMATS: readonly AudioFormat[] = ["mp3", "m4a", "webm"];

/** Whisper's upload limit on both Groq and OpenAI. */
export const MAX_TRANSCRIPTION_BYTES = 25 * 1024 * 1024;

/** The MP3 settings a transcription download asks for — see the file comment. */
export const TRANSCRIPTION_AUDIO = { bitrate: 32, mono: true, rate: 16000 } as const;

/** A failure with the HTTP status the admin route should answer with. */
export class AudioExtractError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "AudioExtractError";
  }
}

interface TranscriptionProvider {
  name: "groq" | "openai";
  url: string;
  key: string;
  model: string;
}

/** The configured media API, or null when the feature is off. */
export function getAudioServiceConfig(): { url: string; key: string | undefined } | null {
  const url = getEnv("YOUTUBE_AUDIO_SERVICE_URL")?.trim();
  if (!url) return null;
  return { url: url.replace(/\/+$/, ""), key: getEnv("YOUTUBE_AUDIO_SERVICE_KEY") || undefined };
}

/** The speech-to-text provider to use, or null when no key is set. */
export function getTranscriptionProvider(): TranscriptionProvider | null {
  const groq = getEnv("GROQ_API_KEY");
  if (groq) {
    return {
      name: "groq",
      url: "https://api.groq.com/openai/v1/audio/transcriptions",
      key: groq,
      model: "whisper-large-v3-turbo",
    };
  }
  const openai = getEnv("OPENAI_API_KEY");
  if (openai) {
    return {
      name: "openai",
      url: "https://api.openai.com/v1/audio/transcriptions",
      key: openai,
      model: "whisper-1",
    };
  }
  return null;
}

/** What the admin dialog needs to know to enable its buttons. Names no secret. */
export function getAudioExtractStatus() {
  const provider = getTranscriptionProvider();
  return {
    audioService: getAudioServiceConfig() !== null,
    transcription: provider ? { provider: provider.name, model: provider.model } : null,
  };
}

export interface AudioRequest {
  format?: AudioFormat;
  /** MP3 bitrate in kbps. */
  bitrate?: number;
  mono?: boolean;
  /** MP3 sample rate in Hz. */
  rate?: number;
}

/** Builds the media API's `/audio` URL for `videoId`. Exported for tests. */
export function audioServiceUrl(base: string, videoId: string, request: AudioRequest = {}): string {
  const url = new URL(`${base}/audio`);
  url.searchParams.set("v", videoId);
  url.searchParams.set("format", request.format ?? "mp3");
  if (request.bitrate) url.searchParams.set("bitrate", String(request.bitrate));
  if (request.mono) url.searchParams.set("mono", "1");
  if (request.rate) url.searchParams.set("rate", String(request.rate));
  return url.toString();
}

/**
 * Asks the media API for `videoId`'s audio. Resolves with the upstream
 * response — its body still unread, so a download can be streamed straight
 * through to the admin's browser.
 */
export async function fetchVideoAudio(videoId: string, request: AudioRequest = {}): Promise<Response> {
  const service = getAudioServiceConfig();
  if (!service) {
    throw new AudioExtractError(
      "Audio extraction is not configured: set YOUTUBE_AUDIO_SERVICE_URL to an extract-youtube media API.",
      501,
    );
  }

  let response: Response;
  try {
    response = await fetch(audioServiceUrl(service.url, videoId, request), {
      headers: service.key ? { Authorization: `Bearer ${service.key}` } : {},
    });
  } catch (error) {
    throw new AudioExtractError(`The audio service could not be reached: ${(error as Error).message}`, 502);
  }

  if (!response.ok) {
    const detail = await response
      .json()
      .then((body: { error?: string }) => body?.error)
      .catch(() => undefined);
    throw new AudioExtractError(
      `The audio service answered ${response.status}${detail ? `: ${detail}` : ""}`,
      response.status === 404 ? 404 : 502,
    );
  }
  return response;
}

interface WhisperSegment {
  start?: number;
  end?: number;
  text?: string;
}

/** Turns Whisper's `verbose_json` segments into the caption shape the player reads. */
export function segmentsToSnippets(segments: WhisperSegment[] | undefined): TranscriptSnippet[] {
  return (segments ?? [])
    .map((segment) => {
      // Round the endpoints, not the length, so consecutive lines still tile.
      const start = Math.round((Number(segment.start) || 0) * 100);
      const end = Math.round((Number(segment.end) || 0) * 100);
      return {
        text: (segment.text ?? "").trim(),
        start: start / 100,
        duration: Math.max(0, end - start) / 100,
      };
    })
    .filter((snippet) => snippet.text.length > 0);
}

/** Sends one audio file to the transcription provider. */
export async function transcribeAudio(
  audio: Blob,
  filename: string,
  { language = "en" }: { language?: string } = {},
): Promise<{ snippets: TranscriptSnippet[]; provider: string; model: string }> {
  const provider = getTranscriptionProvider();
  if (!provider) {
    throw new AudioExtractError(
      "Transcription is not configured: set GROQ_API_KEY or OPENAI_API_KEY.",
      501,
    );
  }
  if (audio.size > MAX_TRANSCRIPTION_BYTES) {
    throw new AudioExtractError(
      `The audio is ${(audio.size / 1024 / 1024).toFixed(1)} MB, over the 25 MB transcription limit. ` +
        "Download the MP3 and transcribe it in parts instead.",
      413,
    );
  }

  const form = new FormData();
  form.append("file", audio, filename);
  form.append("model", provider.model);
  form.append("response_format", "verbose_json");
  form.append("language", language);

  const response = await fetch(provider.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${provider.key}` },
    body: form,
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new AudioExtractError(
      `Transcription failed (${provider.name} ${response.status}): ${detail.slice(0, 300)}`,
      502,
    );
  }

  const body = (await response.json()) as { segments?: WhisperSegment[]; text?: string; duration?: number };
  let snippets = segmentsToSnippets(body.segments);
  // A provider that ignored verbose_json still sent the text; keep it as one line.
  if (snippets.length === 0 && body.text?.trim()) {
    snippets = [{ text: body.text.trim(), start: 0, duration: Number(body.duration) || 0 }];
  }
  return { snippets, provider: provider.name, model: provider.model };
}

/**
 * Downloads `videoId`'s audio at transcription quality and transcribes it.
 * Throws `AudioExtractError` for every failure the admin can act on.
 */
export async function transcribeVideoAudio(videoId: string, options: { language?: string } = {}) {
  const response = await fetchVideoAudio(videoId, { format: "mp3", ...TRANSCRIPTION_AUDIO });
  const declared = Number(response.headers.get("content-length"));
  if (declared > MAX_TRANSCRIPTION_BYTES) {
    await response.body?.cancel();
    throw new AudioExtractError("The audio is over the 25 MB transcription limit.", 413);
  }
  const audio = await response.blob();
  return transcribeAudio(new Blob([audio], { type: "audio/mpeg" }), `${videoId}.mp3`, options);
}
