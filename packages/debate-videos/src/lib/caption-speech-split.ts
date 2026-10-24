/**
 * @fileoverview A round's speeches placed from its caption pauses alone — no
 * model call.
 *
 * The caption track shows where people talked and where nobody did. The
 * speech timer's "Select YouTube Start" already lines a format's speeches up
 * against those spoken stretches by rule length (`suggestSpeechSegments` in
 * `@debate-ai/timer`); this turns that placement into a
 * {@link SpeechSegmentation} the watch page reads like the model's.
 *
 * It does two jobs for "Detect speeches":
 *   - the **pause guess** in the prompt, which the model corrects from what
 *     is said, and
 *   - the **fallback** when the model can't be asked (signed out, no AI key,
 *     daily limit) or its reply can't be read.
 *
 * Pure: no I/O.
 * @module lib/caption-speech-split
 */

// The pure segment maths, not the package entry: that pulls in the recorder UI,
// and the admin Speech AI job runs this on the server.
import { suggestSpeechSegments, type CaptionSnippet } from "@debate-ai/timer/src/recorder/youtube-speech-segments";
import { AUDIO_SPLIT_TEMPLATES, audioSplitFormatForStyle } from "./audio-speech-split";
import type { SegmentationCaption, SpeechSegmentation } from "./speech-segmentation";

/**
 * The format's speeches placed on the captions by length and pauses.
 *
 * @param style The video's numeric `DebateStyle`; unknown styles are read as
 *   high school policy, the most common round on the site.
 * @returns `null` when the captions have fewer spoken stretches than the
 *   format has speeches (a clip, or captions with no timing).
 */
export function captionPauseSegmentation(
  captions: SegmentationCaption[],
  style: number | null | undefined,
): SpeechSegmentation | null {
  const template = AUDIO_SPLIT_TEMPLATES[audioSplitFormatForStyle(style)];
  const snippets: CaptionSnippet[] = captions.map((caption) => ({
    text: caption.text,
    start: caption.start,
    duration: caption.duration ?? 0,
  }));
  const segments = suggestSpeechSegments(
    snippets,
    template.speeches.map(({ name, minutes }) => ({ name, time: minutes })),
  );
  if (!segments) return null;
  return {
    format: template.format,
    speeches: segments.map((segment) => ({
      name: segment.name,
      startSeconds: Math.floor(segment.start),
      endSeconds: Math.ceil(segment.end) > Math.floor(segment.start) ? Math.ceil(segment.end) : null,
    })),
  };
}
