"use client";

import { useEffect, useRef, useState } from "react";
import {
  AUDIO_SPLIT_FORMATS,
  AUDIO_SPLIT_TEMPLATES,
  audioSplitFormatForStyle,
  audioSplitTranscriptMarkdown,
  formatTimecode,
  groupIntoSentences,
  splitSpeechAudio,
  type AudioSplitFormat,
  type CaptionCue,
  type SpeechClip,
} from "@debate-ai/videos";
import { Button } from "../ui/primitives/button";
import { Label } from "../ui/primitives/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/primitives/select";

/**
 * "Split speeches from audio" — the Speeches tab's button that finds a
 * round's speeches in its sound rather than its captions.
 *
 * 1. **Download.** The audio comes from the same media API as "Download MP3"
 *    (the Worker can't run a downloader), asked for as small mono MP3 since
 *    only its loudness matters. Where that API isn't configured, or YouTube
 *    blocks it, the editor downloads the file with the `grab-url` CLI (which
 *    pulls YouTube through yt-dlp) and picks it here instead.
 * 2. **Split, here in the browser.** `splitSpeechAudio` decodes it with the
 *    `mpg123-decoder` WASM build, finds the pauses, and lines the sound up
 *    with the format's speech times to name every speech and time its start
 *    and end. `@debate-ai/videos`' `split-speech-audio.ts` explains why this
 *    can't run in the Worker.
 * 3. **Save.** Each speech's MP3 clip goes to R2, and the timing goes into
 *    the transcript document as `## 1AC (0:42–8:51)` headings — with the
 *    captions of each speech under its heading when the video has any — so
 *    the watch page's speech tabs and timeline pick it up.
 */

/** What the dialog is handed once a split is done, to put in the transcript and save. */
export interface SpeechAudioSplit {
  markdown: string;
  /** `youtube` when the speeches carry caption text, `editor` when they are headings alone. */
  author: "youtube" | "editor";
  /** One line for the dialog's notice. */
  summary: string;
}

interface StoredClip {
  fileName: string;
  size: number;
  url: string;
}

interface SpeechAudioSplitterProps {
  videoId: string;
  /** `videos.style`, to preselect the format. */
  style?: number | null;
  /** Whether the server can fetch the audio itself (`YOUTUBE_AUDIO_SERVICE_URL`). */
  audioService: boolean;
  /** Asked before a split replaces the transcript box; `false` cancels. */
  confirmReplace: () => boolean;
  onSplit: (split: SpeechAudioSplit) => Promise<void>;
  disabled?: boolean;
}

/** Mono and small: the splitter measures loudness, and the clips are speech. */
const SPLIT_AUDIO_QUERY = "format=mp3&bitrate=48&mono=1&rate=24000";

/** Reads a download to the end, reporting megabytes as they arrive. */
async function readBytes(response: Response, onBytes: (received: number) => void): Promise<Uint8Array> {
  const reader = response.body?.getReader();
  if (!reader) return new Uint8Array(await response.arrayBuffer());
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    onBytes(received);
  }
  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}

async function errorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string; details?: string };
    return body.error || body.details || fallback;
  } catch {
    return fallback;
  }
}

const megabytes = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

export function SpeechAudioSplitter({
  videoId,
  style,
  audioService,
  confirmReplace,
  onSplit,
  disabled = false,
}: SpeechAudioSplitterProps) {
  const [format, setFormat] = useState<AudioSplitFormat>(() => audioSplitFormatForStyle(style));
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stored, setStored] = useState<StoredClip[]>([]);
  /** Clips from this session that R2 didn't take, played from memory instead. */
  const [localClips, setLocalClips] = useState<Array<{ fileName: string; url: string }>>([]);
  const [copied, setCopied] = useState(false);
  const fileInput = useRef<HTMLInputElement | null>(null);

  const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const grabCommand = `npx grab-url "${youtubeUrl}" -a mp3`;

  useEffect(() => setFormat(audioSplitFormatForStyle(style)), [style, videoId]);

  useEffect(() => {
    let live = true;
    setStored([]);
    fetch(`/api/admin/videos/library/${videoId}/speech-audio`)
      .then((res) => (res.ok ? (res.json() as Promise<{ clips?: StoredClip[] }>) : null))
      .then((body) => live && body?.clips && setStored(body.clips))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [videoId]);

  useEffect(
    () => () => {
      for (const clip of localClips) URL.revokeObjectURL(clip.url);
    },
    [localClips],
  );

  /** Puts the new clips in R2, replacing the old set; `false` when R2 isn't bound. */
  const uploadClips = async (clips: SpeechClip[]): Promise<boolean> => {
    const base = `/api/admin/videos/library/${videoId}/speech-audio`;
    const cleared = await fetch(base, { method: "DELETE" });
    if (!cleared.ok) throw new Error(await errorMessage(cleared, "Could not clear the old clips"));
    const uploaded: StoredClip[] = [];
    for (const [index, clip] of clips.entries()) {
      setProgress(`Uploading clip ${index + 1} of ${clips.length} (${clip.fileName})…`);
      const res = await fetch(`${base}?file=${encodeURIComponent(clip.fileName)}`, {
        method: "PUT",
        headers: { "Content-Type": "audio/mpeg" },
        body: clip.bytes as BodyInit,
      });
      if (res.status === 501) return false;
      if (!res.ok) throw new Error(await errorMessage(res, `Could not upload ${clip.fileName}`));
      uploaded.push((await res.json()) as StoredClip);
    }
    setStored(uploaded);
    return true;
  };

  /** Each speech's caption sentences, when the video has captions; empty otherwise. */
  const loadCaptions = async () => {
    try {
      const res = await fetch(`/api/transcript?videoId=${encodeURIComponent(videoId)}`);
      if (!res.ok) return [];
      const body = (await res.json()) as { snippets?: CaptionCue[] };
      return groupIntoSentences((body.snippets ?? []).filter((cue) => cue.text?.trim()));
    } catch {
      return [];
    }
  };

  const split = async (getAudio: () => Promise<Uint8Array>) => {
    if (!confirmReplace()) return;
    setRunning(true);
    setError(null);
    try {
      const mp3 = await getAudio();
      setProgress("Decoding the audio…");
      const result = await splitSpeechAudio(mp3, {
        format,
        onProgress: (fraction) => setProgress(`Finding the speeches… ${Math.round(fraction * 100)}%`),
      });
      if (result.speeches.length === 0) {
        throw new Error("No speeches found — the recording may be silent or one long stretch of sound.");
      }

      let clipNote: string;
      try {
        const saved = await uploadClips(result.clips);
        for (const clip of localClips) URL.revokeObjectURL(clip.url);
        if (saved) {
          setLocalClips([]);
          clipNote = `${result.clips.length} clips saved`;
        } else {
          setLocalClips(
            result.clips.map((clip) => ({
              fileName: clip.fileName,
              url: URL.createObjectURL(new Blob([clip.bytes as BlobPart], { type: "audio/mpeg" })),
            })),
          );
          clipNote = "clips kept in this browser only (no SPEECH_AUDIO bucket is bound)";
        }
      } catch (err) {
        clipNote = `clips not saved: ${(err as Error).message}`;
      }

      setProgress("Saving the speeches…");
      const captions = await loadCaptions();
      const markdown = audioSplitTranscriptMarkdown(result.segmentation, captions);
      const label = AUDIO_SPLIT_TEMPLATES[format].label;
      await onSplit({
        markdown,
        author: captions.length > 0 ? "youtube" : "editor",
        summary: `Split ${formatTimecode(result.durationSeconds)} of audio into ${result.speeches.length} speeches (${label}); ${clipNote}. Check the times against the video.`,
      });
      setProgress(null);
    } catch (err) {
      setProgress(null);
      setError((err as Error).message);
    } finally {
      setRunning(false);
    }
  };

  const downloadFromServer = () =>
    split(async () => {
      setProgress("Downloading the audio…");
      const res = await fetch(`/api/admin/videos/library/${videoId}/audio?${SPLIT_AUDIO_QUERY}`);
      if (!res.ok) throw new Error(await errorMessage(res, "Could not download the audio"));
      return readBytes(res, (received) => setProgress(`Downloading the audio… ${megabytes(received)}`));
    });

  const splitFile = (file: File) =>
    split(async () => {
      setProgress(`Reading ${file.name}…`);
      return new Uint8Array(await file.arrayBuffer());
    });

  const copyCommand = async () => {
    try {
      await navigator.clipboard.writeText(grabCommand);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked; the command is on screen to select by hand.
    }
  };

  const clips = localClips.length > 0 ? localClips : stored;

  return (
    <div className="flex flex-col gap-2 rounded-md border p-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="split-format">Split speeches from audio</Label>
          <Select value={format} onValueChange={(value) => setFormat(value as AudioSplitFormat)}>
            <SelectTrigger id="split-format" className="w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AUDIO_SPLIT_FORMATS.map((option) => (
                <SelectItem key={option} value={option}>
                  {AUDIO_SPLIT_TEMPLATES[option].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={downloadFromServer}
          disabled={running || disabled || !audioService}
          title={
            audioService
              ? "Download the audio, find each speech in it by its pauses, and save the speeches and their clips"
              : "Set YOUTUBE_AUDIO_SERVICE_URL to download here, or use grab-url and pick the file"
          }
        >
          {running ? "Splitting…" : "Download & split speeches"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => fileInput.current?.click()}
          disabled={running || disabled}
          title="Split an MP3 you downloaded yourself"
        >
          Split an MP3 file…
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept="audio/mpeg,.mp3"
          className="hidden"
          aria-label="MP3 file to split"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void splitFile(file);
          }}
        />
      </div>

      <p className="text-muted-foreground text-xs">
        Finds the {AUDIO_SPLIT_TEMPLATES[format].speeches.length} speeches by the pauses between them
        and their allotted times, then writes each one&apos;s start and end into the transcript
        below. To download the audio yourself:{" "}
        <code className="bg-muted rounded px-1 py-0.5 select-all">{grabCommand}</code>{" "}
        <button type="button" className="underline" onClick={copyCommand}>
          {copied ? "Copied" : "Copy"}
        </button>
      </p>

      {progress && <p className="text-muted-foreground text-xs tabular-nums">{progress}</p>}
      {error && <p className="text-destructive text-xs">{error}</p>}

      {clips.length > 0 && (
        <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
          {clips.map((clip) => (
            <li key={clip.fileName}>
              <a href={clip.url} target="_blank" rel="noreferrer" download={clip.fileName} className="underline">
                {clip.fileName}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
