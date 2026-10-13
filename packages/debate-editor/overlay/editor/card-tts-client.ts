/**
 * @fileoverview The model voices behind the card hover **Read aloud** button
 * (`card-hover-actions.ts`): fetches the card's speech as audio from a
 * text-to-speech model instead of the browser's built-in `speechSynthesis`.
 *
 * - **The site first.** `POST /api/tts` (apps/debate-ai.com) speaks through
 *   QwkSearch's Kokoro / Deepgram voices or Cloudflare Workers AI, whichever
 *   the server has and the voice prefers.
 * - **QwkSearch straight from the browser** when the site answers `429`
 *   (its shared QwkSearch guest allowance, 10 a day, is spent) or has no
 *   `/api/tts` (the editor embedded somewhere else): the visitor then uses
 *   their own guest allowance.
 * - **`null`** when neither gave audio — the caller falls back to the
 *   browser's built-in speech, so Read aloud always reads.
 *
 * @module editor/card-tts-client
 */

export type ModelVoiceProvider = 'kokoro' | 'deepgram';

/** A model voice the reader can pick in the Read aloud settings. */
export interface ModelVoice {
  provider: ModelVoiceProvider;
  /** The provider's voice id; `''` lets the provider choose. */
  voice: string;
}

/** The voice setting: a model voice, or the browser's own speech. */
export type ReadVoiceChoice = ModelVoice | 'browser';

/** The choices the settings list offers, Kokoro first (the default). */
export const READ_VOICE_OPTIONS: ReadonlyArray<{ id: string; label: string; choice: ReadVoiceChoice }> = [
  { id: 'kokoro:af_heart', label: 'Kokoro · Heart', choice: { provider: 'kokoro', voice: 'af_heart' } },
  { id: 'kokoro:af_bella', label: 'Kokoro · Bella', choice: { provider: 'kokoro', voice: 'af_bella' } },
  { id: 'kokoro:am_michael', label: 'Kokoro · Michael', choice: { provider: 'kokoro', voice: 'am_michael' } },
  { id: 'deepgram:aura-asteria-en', label: 'Deepgram · Asteria', choice: { provider: 'deepgram', voice: 'aura-asteria-en' } },
  { id: 'deepgram:aura-orion-en', label: 'Deepgram · Orion', choice: { provider: 'deepgram', voice: 'aura-orion-en' } },
  { id: 'browser', label: 'Browser built-in', choice: 'browser' },
];

export const DEFAULT_READ_VOICE_ID = 'kokoro:af_heart';

/** The choice for a stored id; unknown ids get the default (Kokoro). */
export function readVoiceChoice(id: string | null | undefined): ReadVoiceChoice {
  const found = READ_VOICE_OPTIONS.find((o) => o.id === id) ?? READ_VOICE_OPTIONS.find((o) => o.id === DEFAULT_READ_VOICE_ID)!;
  return found.choice;
}

export const DEFAULT_QWKSEARCH_VOICE_URL = 'https://qwksearch.com/api/agent/voice';

export interface FetchModelSpeechOptions {
  /** The site's TTS route. */
  siteEndpoint?: string;
  /** QwkSearch's voice endpoint, called from the browser as a fallback. */
  qwksearchEndpoint?: string;
  signal?: AbortSignal;
}

function isAudio(res: Response): boolean {
  return res.ok && /^audio\//i.test(res.headers.get('content-type') ?? '');
}

/** Speech audio for `text` in `voice`, or null when no model could give it (see the module doc). */
export async function fetchModelSpeech(
  text: string,
  voice: ModelVoice,
  options: FetchModelSpeechOptions = {},
): Promise<Blob | null> {
  const { siteEndpoint = '/api/tts', qwksearchEndpoint = DEFAULT_QWKSEARCH_VOICE_URL, signal } = options;
  const payload: Record<string, string> = { text, provider: voice.provider };
  if (voice.voice) payload['voice'] = voice.voice;
  const init = (): RequestInit => ({
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  });

  let tryDirect = false;
  try {
    const res = await fetch(siteEndpoint, init());
    if (isAudio(res)) return await res.blob();
    // 429: the site's shared QwkSearch guest allowance is spent. 404/405: no
    // site route here. Either way the visitor's own allowance may still work.
    tryDirect = res.status === 429 || res.status === 404 || res.status === 405;
  } catch (error) {
    if (signal?.aborted) throw error;
    tryDirect = true;
  }
  if (!tryDirect) return null;
  try {
    const res = await fetch(qwksearchEndpoint, init());
    return isAudio(res) ? await res.blob() : null;
  } catch (error) {
    if (signal?.aborted) throw error;
    return null;
  }
}
