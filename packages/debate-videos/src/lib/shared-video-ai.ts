/**
 * @fileoverview The rules for the watch page's shared AI results: what one
 * viewer's run of "Detect speeches", a speech's LLM summary or its Outcomes
 * simulation looks like once it is saved for every viewer of that video.
 *
 * Every one of those buttons costs a model call, and the answer depends only
 * on the video (its captions, its title, the speech and the judge panel), not
 * on who pressed it. So the first good answer is saved server-side, keyed by
 * YouTube id, and served to everyone — signed out included — and a video is
 * analyzed once instead of once per browser.
 *
 * This module is pure so the app's `/api/video-ai-results` route and the
 * client store (`state/sharedVideoAi.ts`) agree on one shape: the route
 * re-validates a write with the same parsers that read the model's reply, so
 * a client can only save what the model could have produced.
 * @module lib/shared-video-ai
 */

import { parseSpeechSegmentationResponse, type SpeechSegmentation } from "./speech-segmentation";
import {
  JUDGE_LENSES,
  MAX_ALTERNATIVES,
  normalizePanel,
  panelKey,
  parseSpeechOutcomeResponse,
  type JudgeLens,
  type SpeechOutcomeSimulation,
} from "./speech-outcomes";

/** The three kinds of AI result a video can share. */
export type SharedVideoAiKind = "segmentation" | "summary" | "outcome";

export const SHARED_VIDEO_AI_KINDS: readonly SharedVideoAiKind[] = ["segmentation", "summary", "outcome"];

/** Longest saved speech outline, in characters. */
export const MAX_SHARED_SUMMARY_CHARS = 20_000;
/** Largest saved result of any kind, as JSON. */
export const MAX_SHARED_RESULT_BYTES = 64_000;

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
// eslint-disable-next-line no-control-regex
const SPEECH_KEY = /^[^\u0000-\u001f]{1,80}$/;

export function isSharedVideoId(value: unknown): value is string {
  return typeof value === "string" && VIDEO_ID.test(value);
}

/** One saved result, as the route stores and returns it. */
export type SharedVideoAiItem =
  | { kind: "segmentation"; key: ""; data: SpeechSegmentation }
  | { kind: "summary"; key: string; data: string }
  | { kind: "outcome"; key: string; data: SpeechOutcomeSimulation };

/** Everything shared for one video, as `GET /api/video-ai-results` answers. */
export interface SharedVideoAi {
  segmentation: SpeechSegmentation | null;
  /** LLM outlines by speech key. */
  summaries: Record<string, string>;
  /** Outcome runs by {@link outcomeKey}. */
  outcomes: Record<string, SpeechOutcomeSimulation>;
}

export const EMPTY_SHARED_VIDEO_AI: SharedVideoAi = { segmentation: null, summaries: {}, outcomes: {} };

/** An outcome run's key: the speech and the judge panel (`panelKey`). */
export function outcomeKey(speechKey: string, lens: string): string {
  return `${speechKey}::${lens}`;
}

/** The row id a result is stored under — one per video, kind and key. */
export function sharedVideoAiId(videoId: string, kind: SharedVideoAiKind, key: string): string {
  return `${videoId}::${kind}::${key}`;
}

/** A `panelKey` back to its judges, or `null` when it isn't one `panelKey` could have made. */
export function lensPanel(lens: string): JudgeLens[] | null {
  const ids = lens.split("+");
  const known = new Set<string>(JUDGE_LENSES.map((judge) => judge.id));
  if (ids.some((id) => !known.has(id))) return null;
  const panel = normalizePanel(ids);
  return panelKey(panel) === lens ? panel : null;
}

/** Re-runs a segmentation through the reply parser, so only what it accepts is kept. */
function validSegmentation(value: unknown): SpeechSegmentation | null {
  if (typeof value !== "object" || value === null) return null;
  const raw = value as { format?: unknown; speeches?: unknown };
  if (!Array.isArray(raw.speeches)) return null;
  const speeches = raw.speeches.map((speech) => {
    const entry = (typeof speech === "object" && speech !== null ? speech : {}) as Record<string, unknown>;
    return { name: entry.name, start: entry.startSeconds, end: entry.endSeconds, confidence: entry.confidence };
  });
  return parseSpeechSegmentationResponse(JSON.stringify({ format: raw.format, speeches }));
}

function validOutcome(value: unknown, panel: JudgeLens[]): SpeechOutcomeSimulation | null {
  if (typeof value !== "object" || value === null) return null;
  const raw = value as { actual?: unknown; alternatives?: unknown; keyClash?: unknown };
  // A saved run has its panel already aggregated; a lone ballot per option
  // reads the same through the parser, and a panel's ballots are re-read
  // from each option's `ballot.judges`.
  const reshape = (decision: unknown) => {
    const ballot = (typeof decision === "object" && decision !== null ? decision : {}) as { judges?: unknown };
    return Array.isArray(ballot.judges) && ballot.judges.length > 0 ? { ballots: ballot.judges } : { ballot };
  };
  const actual = (typeof raw.actual === "object" && raw.actual !== null ? raw.actual : {}) as Record<string, unknown>;
  const alternatives = Array.isArray(raw.alternatives) ? raw.alternatives : [];
  const reply = {
    actual: { assessment: actual.assessment, ...reshape(actual.ballot) },
    alternatives: alternatives.map((alternative) => {
      const entry = (typeof alternative === "object" && alternative !== null ? alternative : {}) as Record<
        string,
        unknown
      >;
      return { ...entry, ...reshape(entry.ballot) };
    }),
    keyClash: raw.keyClash,
  };
  return parseSpeechOutcomeResponse(JSON.stringify(reply), MAX_ALTERNATIVES, panel);
}

export type SharedVideoAiWrite = { videoId: string; replace: boolean } & SharedVideoAiItem;

/**
 * Reads a `POST /api/video-ai-results` body.
 *
 * `{ videoId, kind, key, data, replace? }` — `key` is empty for a
 * segmentation, the speech key for a summary, and {@link outcomeKey} for an
 * outcome run. `data` is re-parsed the way the model's reply was, so the
 * stored copy is exactly what the parsers accept.
 */
export function parseSharedVideoAiWrite(
  body: unknown,
): { ok: true; value: SharedVideoAiWrite } | { ok: false; error: string } {
  if (typeof body !== "object" || body === null) return { ok: false, error: "Expected a JSON object." };
  const raw = body as Record<string, unknown>;
  if (!isSharedVideoId(raw.videoId)) return { ok: false, error: "`videoId` must be a YouTube video id." };
  const videoId = raw.videoId;
  const replace = raw.replace === true;
  const key = typeof raw.key === "string" ? raw.key : "";
  if (JSON.stringify(raw.data ?? null).length > MAX_SHARED_RESULT_BYTES) {
    return { ok: false, error: "That result is too large to share." };
  }

  switch (raw.kind) {
    case "segmentation": {
      const data = validSegmentation(raw.data);
      if (!data) return { ok: false, error: "That isn't a speech segmentation." };
      return { ok: true, value: { videoId, replace, kind: "segmentation", key: "", data } };
    }
    case "summary": {
      if (!SPEECH_KEY.test(key)) return { ok: false, error: "`key` must be a speech key." };
      const data = typeof raw.data === "string" ? raw.data.trim() : "";
      if (!data) return { ok: false, error: "A summary can't be empty." };
      if (data.length > MAX_SHARED_SUMMARY_CHARS) return { ok: false, error: "That summary is too long to share." };
      return { ok: true, value: { videoId, replace, kind: "summary", key, data } };
    }
    case "outcome": {
      const split = key.lastIndexOf("::");
      const speechKey = split > 0 ? key.slice(0, split) : "";
      const panel = split > 0 ? lensPanel(key.slice(split + 2)) : null;
      if (!SPEECH_KEY.test(speechKey) || !panel) return { ok: false, error: "`key` must be `speechKey::panel`." };
      const data = validOutcome(raw.data, panel);
      if (!data) return { ok: false, error: "That isn't an outcome simulation." };
      return { ok: true, value: { videoId, replace, kind: "outcome", key, data } };
    }
    default:
      return { ok: false, error: "`kind` must be segmentation, summary or outcome." };
  }
}

/**
 * Folds stored rows back into the {@link SharedVideoAi} shape, skipping any
 * that no longer parse (a row saved by an older version, say).
 */
export function collectSharedVideoAi(
  rows: ReadonlyArray<{ kind: string; key: string; data: string }>,
): SharedVideoAi {
  const shared: SharedVideoAi = { segmentation: null, summaries: {}, outcomes: {} };
  for (const row of rows) {
    let data: unknown;
    try {
      data = JSON.parse(row.data);
    } catch {
      continue;
    }
    if (row.kind === "segmentation") shared.segmentation = validSegmentation(data) ?? shared.segmentation;
    else if (row.kind === "summary" && typeof data === "string" && data) shared.summaries[row.key] = data;
    else if (row.kind === "outcome" && typeof data === "object" && data !== null) {
      shared.outcomes[row.key] = data as SpeechOutcomeSimulation;
    }
  }
  return shared;
}
